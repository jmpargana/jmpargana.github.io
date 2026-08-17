+++
title = 'Kafka Protocol'
date = 2026-08-14T07:33:38+01:00
draft = false
tags = ['Kafka', 'Rust', 'Network', 'Protocol', 'SSL']
+++

This post is part of my Kafka series. If you're new make sure to check the other posts first.

## Network Layer

Surprisingly, Kafka's network layer is its simplest aspect. It's designed like an RPC. A message, or in Kafka's terms, a _Frame_, is just like a network envelope: header + payload. 

![original](/images/kafka/frame.png)

The header carries standard metadata fields found in most protocols. The most relevant is `api_key` — despite its name, this is not an authentication key but the RPC verb that defines how the payload is decoded. 

Here's a list of the currently supported verbs in my version of Kafka (more coming soon). For a comprehensive list, check the [docs](hint comes here).

## Payload

We'll look at the `Fetch` Request and Response as examples to understand how the bytes are structured and how versioning is handled.

```yaml
Fetch Request (Version: 18) => { max_wait_ms min_bytes max_bytes isolation_level session_id session_epoch (topics) (forgotten_topics_data) rack_id cluster_id<tag: 0> replica_state<tag: 1> }
  max_wait_ms => INT32
  min_bytes => INT32
  max_bytes => INT32
  isolation_level => INT8
  session_id => INT32
  session_epoch => INT32
  topics => { topic_id (partitions) }
    topic_id => UUID
    partitions => { partition current_leader_epoch fetch_offset last_fetched_epoch log_start_offset partition_max_bytes replica_directory_id<tag: 0> high_watermark<tag: 1> }
      partition => INT32
      current_leader_epoch => INT32
      fetch_offset => INT64
      last_fetched_epoch => INT32
      log_start_offset => INT64
      partition_max_bytes => INT32
      replica_directory_id<tag: 0> => UUID
      high_watermark<tag: 1> => INT64
  forgotten_topics_data => { topic_id (partitions) }
    topic_id => UUID
    partitions => INT32
  rack_id => COMPACT_STRING
  cluster_id<tag: 0> => COMPACT_NULLABLE_STRING
  replica_state<tag: 1> => { replica_id replica_epoch }
    replica_id => INT32
    replica_epoch => INT64
```

```yaml
Fetch Response (Version: 18) => { throttle_time_ms error_code session_id (responses) node_endpoints<tag: 0> }
  throttle_time_ms => INT32
  error_code => INT16
  session_id => INT32
  responses => { topic_id (partitions) }
    topic_id => UUID
    partitions => { partition_index error_code high_watermark last_stable_offset log_start_offset ?(aborted_transactions) preferred_read_replica records diverging_epoch<tag: 0> current_leader<tag: 1> snapshot_id<tag: 2> }
      partition_index => INT32
      error_code => INT16
      high_watermark => INT64
      last_stable_offset => INT64
      log_start_offset => INT64
      aborted_transactions => { producer_id first_offset }
        producer_id => INT64
        first_offset => INT64
      preferred_read_replica => INT32
      records => COMPACT_NULLABLE_RECORDS
      diverging_epoch<tag: 0> => { epoch end_offset }
        epoch => INT32
        end_offset => INT64
      current_leader<tag: 1> => { leader_id leader_epoch }
        leader_id => INT32
        leader_epoch => INT32
      snapshot_id<tag: 2> => { end_offset epoch }
        end_offset => INT64
        epoch => INT32
  node_endpoints<tag: 0> => { node_id host port rack }
    node_id => INT32
    host => COMPACT_STRING
    port => INT32
    rack => COMPACT_NULLABLE_STRING
```

## Simple

You might be thinking: this is not interesting at all. It feels like you just need auto-generated boilerplate to encode and decode each `api_key`, right?

There are still some interesting questions worth answering:
- How is this compatible with SSL?
- How do we efficiently work with the Protocol in Rust?

## SSL

**How is this compatible with SSL?** This might seem like a stupid question. _Why wouldn't it be compatible with SSL?_ Well, Kafka's philosophy, if you've read other posts in this series, is really this:
- Bytes over encoding formats.
- Sequential data in disk over memory.
- **Avoid copy wherever possible**.

Kafka's initial broker design was to rely on syscalls like `sendfile` to transfer data from disk directly to the network socket, bypassing user space entirely. The motivation is straightforward: relying on user space as an intermediary at least doubles the I/O work — data must be read from disk into a user-space buffer and then written from that buffer to the socket. More than that, excessive memory use is the first point of failure for a JVM application. If you have had experience with Java or other JVM languages, you'll know that peaks of memory usage, especially spikes in heap, quickly summon _Unexpected Behavior_ Demons — a no-go for a high-performance application.

Going back to the question. Why is this a problem? `sendfile` copies raw bytes from a file descriptor straight to a socket in the kernel — there is no opportunity for encryption in this path. TLS/SSL encryption must happen in user space, inside the SSL library running in your process. So when a consumer fetches data over a TLS connection, Kafka cannot use `sendfile`: it must read the data into a user-space buffer, encrypt it for that specific session, then write the ciphertext to the socket. 

The Kafka developers solved this pragmatically: when SSL is enabled, the zero-copy path is simply unavailable. Kafka detects the channel type at connection setup and falls back to a standard user-space loop — read from disk into a buffer, encrypt with the SSL library, write ciphertext to the socket. The same applies in reverse for producers sending data in. This is a known and accepted trade-off: SSL-enabled clusters have measurably lower throughput than plaintext ones, partly because of this. The upside is that the separation is clean — the choice between the `sendfile` path and the SSL path is made once, not scattered throughout the codebase.


## Rust

This is quite an interesting question for a low-level language like Rust, which promises efficient byte management. There are a few options, and I see these approaches not as competing solutions to the same problem but as an evolution of how Rust handles I/O — each one solving a slightly different aspect of it. 

### Byte slice

We can start by looking at how to parse from a `&[u8]` byte slice.

### Custom Reader

In Go, parsing typically builds around `io.Reader`: you wrap a `net.Conn` in a `bufio.Reader` and call `Read` or `io.ReadFull`. In Rust, the equivalent is implementing `std::io::Read` — a `fn read(&mut self, buf: &mut [u8]) -> io::Result<usize>` on a struct wrapping the TCP stream. The advantage is genericity: the same parser works against a real socket, a file, or a `Cursor<&[u8]>` in tests. The problem is that `std::io::Read` is synchronous. Using it inside an async Tokio runtime means blocking the executor thread, which defeats the purpose of async I/O entirely.

### Generic R: Read 

The idiomatic Rust step is to make the parsing function generic: `fn parse<R: Read>(reader: &mut R) -> Result<Frame, ParseError>`. Any type implementing `Read` works — real sockets, files, or in-memory `Cursor<Vec<u8>>` for tests. For async code, the equivalent is `R: AsyncRead + Unpin` using Tokio's `AsyncReadExt`. This is more flexible than a concrete custom reader, but the same synchronous-vs-async tension remains: `std::io::Read` and `tokio::io::AsyncRead` are separate traits and don't compose without an explicit bridge.

### Stream

Now you say, isn't a network buffer asynchronous in nature? Shouldn't we opt for something concurrency friendly, that doesn't expect the payload to be complete? Shouldn't we opt for viewing the buffer as a stream and continuously consume bytes until we have successfully parsed the whole Payload? I won't explain this option in depth, because Kafka's protocol avoids the stream with a clever trick.

### Bytes

Tokio ships a crate called `bytes`, which has become the standard for handling network byte streams in async Rust. It provides two types: `BytesMut` — a contiguous, growable buffer — and `Bytes`, its immutable counterpart. Calling `.freeze()` on a `BytesMut` converts it to `Bytes`. The key feature is cheap cloning and slicing: `Bytes::clone()` and `Bytes::split_to()` never copy underlying data — they increment a reference count and adjust the internal offset and length. You fill one `BytesMut` from the socket, freeze it, then hand off sub-slices to different parts of your parser with no extra allocations. Methods like `get_u32()` and `get_i16()` advance an internal read cursor, making sequential parsing a matter of calling methods in field order — exactly what you see in `parse_fetch` above.

## Final Solution

With this whole context, I'll present the entire flow of how I fill a network buffer, decode the message and do the reverse. 

### Accept loop

As with any server, the starting point is a `TcpStream` created for each connection where you pass it to a handler:

```rs
async fn accept_loop(&self, ln: TcpListener) {
    loop {
        let (stream, peer_addr) = ln.accept().await.unwrap();
        debug!(%peer_addr, "Received connection from");
        let conn = Connection {
            stream,
            broker: self.broker.clone(),
            read_buf: BytesMut::new(),
        };
        tokio::spawn(async move {
            conn.handle().await;
        });
    }
}
```

The handler loops, reading frames and writing back the responses the broker returns:

```rs
pub async fn handle(mut self) {
    loop {
        let request = match self.read_frame().await {
            Ok(r) => r,
            Err(ConnectionError::Io(_)) => break,
            Err(ConnectionError::Protocol(e)) => {
                tracing::warn!("protocol error: {e:?}");
                break;
            }
        };
        info!(
            api_key = ?request.header.api_key,
            "Handling request for caller"
        );
        let response = match self.broker.handle(request).await {
            Ok(r) => r,
            Err(_) => unreachable!(
                "broker errors should be encoded as ErrorCode in the response body"
            ),
        };
        if let Err(e) = self.write_frame(response).await {
            tracing::warn!("write failed: {e:?}");
            break;
        }
    }
}
```

### Parsing

The interesting part is `read_frame`, which reads the frame size, resizes a reusable buffer to fit, then calls `read_exact` to fill it — blocking until all bytes arrive:

```rs
async fn read_frame(&mut self) -> Result<Frame, ConnectionError> {
    let size = self.stream.read_u32().await.map_err(ConnectionError::Io)?;
    self.read_buf.resize(size as usize, 0);
    self.stream
        .read_exact(&mut self.read_buf)
        .await
        .map_err(ConnectionError::Io)?;
    Frame::decode(&self.read_buf.split().freeze(), size).map_err(ConnectionError::Protocol)
}
```

Then, we can decode by parsing the full buffer with a custom decoder:

```rs
pub fn decode(buf: &Bytes, size: u32) -> Result<Self, ParseError> {
    let mut decoder = RequestDecoder;
    let mut buf = buf.clone();
    decoder.parse(&mut buf, size)
}
```

```rs
impl RequestDecoder {
    pub fn parse(&mut self, buf: &mut Bytes, size: u32) -> Result<Frame, ParseError> {
        let api_key = buf.get_u32();
        let api_version = buf.get_u32();
        let correlation_id = buf.get_u32();

        let client_id_len = buf.get_i16();
        let client_id = if client_id_len >= 0 {
            Some(
                String::from_utf8(buf.split_to(client_id_len as usize).to_vec())
                    .map_err(|_| ParseError::InvalidClientId)?,
            )
        } else {
            None
        };

        let api_key: ApiKey = api_key.try_into().map_err(|_| ParseError::InvalidApiKey)?;

        let header = RequestHeader {
            api_key,
            api_version,
            correlation_id,
            client_id,
        };

        let body: FrameBody = match api_key {
            ApiKey::Produce => self.parse_produce(buf)?,
            ApiKey::Fetch => self.parse_fetch(buf)?,
            ApiKey::Metadata => self.parse_metadata(buf)?,
            ApiKey::CreateTopics => self.parse_create_topics(buf)?,
        };

        Ok(Frame { size, header, body })
    }

    fn parse_fetch(&self, buf: &mut Bytes) -> Result<FrameBody, ParseError> {
        let replica_id = buf.get_i32();
        let max_bytes = buf.get_u32();
        let topics_len = buf.get_u32();

        let mut topics = Vec::new();
        for _ in 0..topics_len {
            let topic_name_len = buf.get_u16();
            let topic = buf.split_to(topic_name_len as usize);
            let topic = String::from_utf8_lossy(&topic).to_string();
            let partitions_len = buf.get_u32();

            let mut partitions = Vec::new();
            for _ in 0..partitions_len {
                let partition = buf.get_u32();
                let fetch_offset = buf.get_u64();
                let partition_max_bytes = buf.get_u32();
                let high_watermark = buf.get_u64();
                partitions.push(FetchPartition {
                    partition,
                    fetch_offset,
                    partition_max_bytes,
                    high_watermark,
                });
            }
            topics.push(FetchTopic { topic, partitions });
        }
        Ok(FrameBody::Fetch(FetchRequest {
            replica_id,
            max_bytes,
            topics,
        }))
    }
}
```

This function could be cleaner, but the main logic is there. You match the `api_key` with another method, which then creates the entire payload by reading sets of bytes with `&mut Bytes`.

### Handling

The broker will handle the request and return a `Frame` which can then be encoded into a response. This is an **important design decision**. We could convert parsed frames to domain-specific structs before passing them to the broker, but that would require an extra copy of the record data. By keeping raw `Bytes` slices inside the `Frame` and passing it through, record batches can reach disk without being read or copied in user space — preserving Kafka's **zero-copy** goal.


### Encoding

Once we have a response, we encode it back to bytes. 

```rs
async fn write_frame(&mut self, res: Frame) -> Result<(), ConnectionError> {
    let bytes = res.encode();
    self.stream
        .write_all(&bytes)
        .await
        .map_err(ConnectionError::Io)
}
```

This calls `Frame::encode`, which builds a byte buffer by serializing each field in order. 

```rs
FrameBody::Fetch(req) => {
    buf.put_i32(req.replica_id);
    buf.put_u32(req.max_bytes);
    buf.put_u32(req.topics.len() as u32);
    for t in &req.topics {
        buf.put_u16(t.topic.len() as u16);
        buf.put_slice(t.topic.as_bytes());
        buf.put_u32(t.partitions.len() as u32);
        for p in &t.partitions {
            buf.put_u32(p.partition);
            buf.put_u64(p.fetch_offset);
            buf.put_u32(p.partition_max_bytes);
            buf.put_u64(p.high_watermark);
        }
    }
}
```

## Conclusion

That's all on the Kafka protocol and its Rust implementation. If you have questions, look at the code and try replicating it with a simpler protocol to see it in action.