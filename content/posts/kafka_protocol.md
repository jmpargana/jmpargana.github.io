+++
title = 'Kafka Protocol'
date = 2026-08-14T07:33:38+01:00
draft = true
tags = ['Kafka', 'Rust', 'Network', 'Protocol', 'SSL']
+++

This post is part of my Kafka series. If Rust and Kafka interest you, make sure to glance over other posts in this series.

## Network Layer

Surprisingly, Kafka's Network Layer is it's simplest aspect. It's design like an RPC. A message, or in Kafka's terms, a _Frame_, is just like a network envelop: Header + Payload. 

-> Excalidraw Picture

The Header has standard Metadata information you'll find in other protocols. The most relevant field is `api_key`. Unlike what your intuition suggests, this is the actual RPC verb. The `api_key` defines how the Payload shall be decoded. 

Here's a list of the currently supported verbs in my version of Kafka (more coming soon). For a comprehensive list, check the [docs](hint comes here).

## Payload

We'll look at the `Fetch` Request and Response as examples to understand how the bytes are structured and how versioning is handled.



## Simple

You might be thinking. This is not interesting at all. It feels like you just need automatically generated boilerplate to encode and decode each `api_key` and we are done, right?

There are still some interesting questions worth answering:
- How is this compatible with SSL?
- How do we efficiently work with the Protocol in Rust?

## SSL

**How is this compatible with SSL?** This might seem like a stupid question. _Why wouldn't it be compatible with SSL?_ Well, Kafka's philosophy if you've read other posts in this series is really this:
- Bytes over encoding formats.
- Sequential data in disk over memory.
- **Avoid copy wherever possible**.

Kafka's initial Broker design was to rely on `syscall`'s like `sendfile` to delegate copying network bytes to disk to the OS kernel. The motivation is quite simple. Relying on User-space as intermediary at least duplicates the amount of I/O work needed. More than that, overuse of memory will be the first point of failure for a JVM application. If you have had experience with Java or other JVM languages you'll know that peeks of memory usage, specially spikes in heap usage quickly summon _Unexpected Behavior_ Demons, which is a no-go for a high-performance application.

Going back to the question. Why is this a problem? If the design is to simply trust the producer to send the correct bytes and simply copy them to disk we have a conflict with the way SSL works. SSL works on User-space, which means, unless the data we are writing on disk will be read by the same user, aka. entity that generated the secret pair, **AND** session, the data will be lost in encryption-land forever. 

The way the Kafka developers decided to solve this is by...


## Rust

This is quite an interesting question to answer on a low level language like Rust, that promises efficient byte management. We have as always, a few options. I believe these different designs are not simply competing solutions to the same problem, but both evolutions of how the language handles I/O, as well as different problems that each approach solves. 

### Byte slice

We can start by looking how to parse from `&[u8]` a byte slice...

### Custom Reader

Then we can think if we can implement our own `Read`er, how we would do in Go...

### Generic R: Read 

Next, instead of having a custom `Read`er, how about just having a function that takes any Reader and works for all of them...

### Stream

Now you say, isn't a network buffer asynchronous in nature? Shouldn't we opt for something concurrency friendly, that doesn't expect the payload to be complete? Shouldn't we opt for viewing the buffer as a stream and continuously consume bytes until we have successfully parsed the whole Payload?

### Bytes

Tokio ships a library called `bytes`, which upon me looking seems to be the standard to efficiently handle network streams of bytes. The way it works is by keeping...

## Final Solution

With this whole context, I'll presend the entire flow of how I fill a network buffer, decode the message and do the reverse. 

