+++
title = 'Kafka Actor Model'
date = 2026-08-13T10:30:03+01:00
draft = false
tags = ['Kafka', 'concurrency', 'actor model', 'multithread']
+++

Working with lower-level languages comes with the assumption that you are dealing with high load. When I say high load, I mean something in the order of thousands of operations a second. If the operations are not simply computations (CPU bound), but reads and writes (I/O), you quickly reach a point where you should introduce concurrency.

Concurrency, alongside naming, is considered one of the hardest problems in software design. The problem is the same as you have with synchronization in distributed systems. The spectrum runs from accurate-and-slow to fast-but-inconsistent: synchronize and wait, or proceed async and accept eventual consistency. Picking the right model requires a deep understanding of both the problem and the available solutions.

As software developers we quickly jump to assumptions on the problem, and we often have a partial understanding of the solution, not fully grasping all the pros and cons. There is a reason most senior engineers start with a thorough investigation of trade-offs rather than jumping straight to a solution.

## Problem

Let's start by understanding the way Kafka works to have a full grasp on the problem, before proposing a solution.

Kafka is built to serve very high throughput. Not necessarily low latency, but high throughput. Whether this was a requirement or is a consequence of its design is questionable, but given we're simply recreating Kafka, we can start by defining that requirement: throughput > latency. Prioritizing disk over memory comes with a trade-off. I/O operations are slower than memory — each one requires a round-trip through the kernel. We should **avoid copying** at all costs.

Gathering our requirements, we have:
- reads are immutable
- high throughput over latency
- disk over memory
- avoid copying as much as possible (because it involves disk I/O)


## Options

### Mutex

Let's start by analysing the easiest option and the one we usually default to when writing in Rust: `Mutex`. It wraps data behind an exclusive lock. Only one thread holds the lock at a time, for either a read or a write.

**Pros:** simple to reason about, prevents data races, and the Rust compiler enforces correct usage through the type system — you cannot access the inner data without holding the lock. No need to think about memory `Ordering`. No multiple variables in conflict for ownership.

**Cons:** no concurrent reads — even two threads that only want to read must take turns. Under high contention, threads queue up waiting for the lock to release. When a thread is blocked waiting for a `Mutex`, the OS typically puts it to sleep and wakes it when the lock is free, which involves a kernel context switch. This overhead adds up fast.

The way it works is: it locks across threads on every access, because it must synchronize state across all CPU cores. If you have high contention, you end up blocking all your parallel threads waiting for a single lock holder to finish. This somewhat defeats the purpose of concurrency.

**Does this suit Kafka requirements?** Recall that reads in Kafka are immutable. Multiple consumers can safely read from the same partition at the same time — the data never changes underneath them. A `Mutex` makes this impossible. Every read blocks every other read. For a system designed around high read throughput, this is a non-starter.

### RWLock

`RwLock` is a natural upgrade from `Mutex`. The contract changes: multiple readers can hold the lock simultaneously, but a writer requires exclusive access — no readers, no other writers.

**Pros:** concurrent reads don't block each other, so read-heavy workloads scale much better than with `Mutex`. The API is almost as simple, and the Rust compiler still enforces correct usage.

**Cons:** every write still blocks all readers. More importantly, writer starvation is a real risk — if there is a constant stream of readers, a writer may wait indefinitely, depending on the scheduler. There is still OS-level synchronization overhead for any contended access.

**For Kafka:** this is a better fit than `Mutex`, since immutable reads no longer serialize against each other. But writes — appends to the log — still block all active readers. Given our requirement for high write throughput, this remains a bottleneck. And because Kafka producers send batches continuously, reads and writes will contend constantly.

### Atomics

Atomics take a different approach entirely: they delegate synchronization to the CPU itself rather than the OS. CPU instructions like `load`, `store`, `fetch_add`, and `compare_exchange` are guaranteed to execute without interruption, with no kernel involvement.

This removes the overhead of sleeping and waking threads. Atomic operations are lock-free — a thread never blocks waiting for another. They are also composable without deadlock risk, since there are no locks to acquire.

The hard part is **memory ordering**. Modern CPUs and compilers reorder instructions aggressively for performance. Without explicit ordering constraints, two threads may observe writes in different orders. Rust exposes this through the `Ordering` enum:

- **`Relaxed`**: no synchronization with other threads. Only the atomicity of the individual operation is guaranteed. Useful for counters where you only care about the final value, not the relative order of surrounding reads and writes.
- **`Release`**: all writes in the current thread that happened _before_ this store become visible to any thread that subsequently does an `Acquire` load on the same atomic. Think of it as publishing a result.
- **`Acquire`**: all reads in the current thread that happen _after_ this load will see everything the publishing thread had written before its `Release` store. Think of it as subscribing to a result.
- **`AcqRel`**: both `Acquire` and `Release` in a single operation. Used for read-modify-write operations like `fetch_add` or `compare_exchange` that sit in the middle of a publish/subscribe handoff.
- **`SeqCst`**: total sequential consistency across all threads and all atomic operations. The safest but most expensive option, as it prevents all reordering globally.

A common pattern is to write data behind a pointer, then do a `Release` store on the pointer. Readers do an `Acquire` load on that pointer — this guarantees they see the fully written data, not a partial state. This is the foundation of lock-free data structures.

**Pros:** no blocking, very low overhead, no deadlocks, no kernel involvement.

**Cons:** atomics only work for simple types — integers, booleans, pointers. You cannot atomically update a struct or a file. Composing multiple atomic operations into a larger logical transaction is error-prone. Ordering bugs are subtle, architecture-dependent, and notoriously hard to reproduce or test.

**For Kafka:** atomics are useful for individual counters — tracking the current write offset, watermarks, reference counts. But the log itself involves file writes, index updates, and metadata changes that cannot all be expressed as a single atomic operation. We need something that coordinates around ownership of entire subsystems, not individual integers.

### Better option

All three options above share the same root problem: they try to protect *shared* mutable state. Threads share access to the same data and use locks or atomic operations to coordinate access. The actor model flips this on its head.

In the actor model, no state is shared. Each actor owns its state exclusively and is the only entity that ever reads or writes it. Actors don't reach into each other's memory. Instead, they communicate by passing messages through channels.

## Actor model

A quick disclaimer: my implementation of the _actor model_ is not the classic pattern and is not exactly how Kafka implements it in its source code. Instead, it provides a simpler abstraction — writes are managed by a single process that clients cannot access directly. Actors are instantiated with a channel, and read-only data is exposed as an immutable reference that the actor silently replaces on each write, with no input from the client. 

Here's a graphical representation of my implementation:

![original](/images/kafka/actor.png)

### Components

- **State**: Treated as immutable, the state can only be updated via the [Read-Copy-Update (RCU) mechanism](https://en.wikipedia.org/wiki/Read-copy-update). A good fit for this is the [`arc_swap` lib in Rust](https://docs.rs/arc-swap/latest/arc_swap/).
- **Actor**: Runs a loop on a dedicated thread (in this case, a Tokio task) — the only place where state is updated. Spawned once, it exposes a single channel sender that all Handles share, so commands are never processed concurrently.
- **Handle**: Can be instantiated as many times as needed. Each incoming request handler creates a Handle to perform reads or dispatch write commands. Writes go through the sender channel; reads use a shared immutable reference to the state.


## Examples

Let's get to the code examples. I've reused this pattern in multiple implementations where a single write and RCU reads are a good fit.

### Log Segment

Starting with the actual log. As we've discussed before, the log is almost entirely a read-only sequence of bytes. I'll cover memory mapping — the technique Kafka's original implementation uses, also common in high-performance Rust projects — but first let me explain how the RCU works. 

We have the following memory layout:

![original](/images/kafka/memap.png)

There is a contiguous region of memory, where the log gets written. The kernel exposes the file through a file descriptor, which we can think of as a byte array, as shown in the diagram above. Since the log is append-only, almost all data is immutable — reads load bytes at a specific position using `std::os::unix::fs::FileExt::read_at`. Under the hood, it uses the `pread` syscall which does not modify the file descriptor by updating the seek position. This is particularly useful, because you can have multiple simultaneous readers never racing each other.

When a RCU is performed, `with_metadata` allocates a new `SegmentView` with updated `index_count` and `size`, while the `Arc<File>` and `Arc<Mmap>` fields are simply cloned — only their reference counts increment, no file descriptor is duplicated or re-opened. The `ArcSwap` then atomically replaces the old snapshot with the new one. Readers already holding a reference to the old `Arc<SegmentView>` continue safely and simply drop it when done. We are able to address the correct byte position because before calling `read_at`, we find the location on the `.index` file using binary search over the memory map. Since the index is memory-mapped as a `&[u8]` byte slice, the only value we need to track is `index_count` — the count of valid index entries that exist — which is cheap to swap via RCU.

#### memmap

A memory map (`mmap` syscall) maps a file directly into the process's virtual address space. Instead of going through `read()` and `write()` syscalls with intermediate kernel buffers, the kernel exposes the file's pages as plain memory. Accessing a mapped address triggers a page fault on first touch — the kernel fetches the page from disk — and subsequent accesses are pure memory reads with no syscall overhead.

For the index file this is particularly useful. The index is a sequence of fixed-size entries: in this implementation each entry is two 8-byte integers — the offset and the physical byte position in the log — totalling 16 bytes per entry. Memory-mapping the entire index lets us treat it as a `&[u8]` byte slice and perform binary search with simple pointer arithmetic, at memory speed. No file cursor to manage, no syscall per lookup.

Writes work the same way in reverse. `MmapMut` maps the file with write permissions. Writing to the mapped addresses is equivalent to writing to the file — the kernel flushes dirty pages to disk asynchronously, or you can force a flush with `flush()`/`msync()`.

The log file itself is **not** memory-mapped, even though it might seem like the obvious choice. The log grows continuously. Memory-mapping a growing file requires remapping the address space every time the file extends, which is expensive and complex to manage correctly. Instead, the log uses `pread` — positioned reads at a specific byte offset — which avoids the file cursor entirely and is safe for concurrent readers with no synchronization needed. The index, being small, fixed-entry, and bounded per segment, is the right candidate for `mmap`.

So, the resulting code looks something like this:

```rs
pub struct SegmentView {
    pub base_offset: u64,

    log: Arc<File>,
    index: Arc<Mmap>,
    time_index: Arc<Mmap>,

    pub index_count: usize,
    pub size: usize,
}
```

This is the immutable view, holding references to the log file and index. It is only used for reads — the binary search and linear search covered in the previous post. `read_at` is called once the matching index entry is located. To find that entry, we address the memory-mapped index directly as a `&[u8]` byte slice, so the only value that changes on each write is `index_count`, which is cheap to update via RCU. This is why we only need this one extra method.

```rs
pub fn with_metadata(&self, index_count: usize, size: usize) -> Arc<Self> {
    Arc::new(Self {
        base_offset: self.base_offset,
        log: self.log.clone(),
        index: self.index.clone(),
        size,
        index_count,
    })
}
```

Then we have the mutable object, which looks like this:

```rs
pub struct LogSegment {
    segment: Arc<SegmentView>,

    log_file: File,
    index_file: memmap::MmapMut,
    time_index_file: memmap::MmapMut,

    index_write_pos: usize,

    pub size: usize,
    index_count: usize,

    bytes_since_last_index: usize,
    index_threshold_bytes: usize,
}

impl LogSegment {
    pub fn publish(&mut self) -> Arc<SegmentView> {
        let new = self.segment.with_metadata(self.index_count, self.size);
        self.segment = new.clone();
        new
    }
}
```

Here the `append_batch` method writes new bytes to `log_file` (a regular `File`) and appends new index entries to `index_file` (a `MmapMut`). The `SegmentView`, which is the immutable reference readers hold, gets updated only by the caller by manually replacing it via RCU. 

### Partition

This brings us to the partition, where the actor model components described above come together. 

Starting with the state:

```rs
pub struct PartitionState {
    pub segments: Arc<Vec<Arc<SegmentView>>>,
    pub log_end_offset: u64,
    pub high_watermark: u64,
    pub replicas: Arc<Vec<ReplicaMetadata>>,
}
```

Every field is cheap to clone. The heavy data sits behind `Arc` pointers — as we've seen, segments are mostly file references and numerical metadata. 

Next, we have the actor:

```rs
pub struct PartitionActor {
    rx: mpsc::Receiver<PartitionCommand>,
    base_dir: String,
    partition_id: u16,
    broker_id: u16,
    segment_bytes: usize,
    active: LogSegment,
    snapshot: Arc<ArcSwap<PartitionState>>,
    acks_pending_replication: VecDeque<PendingResponse>,
}
```

There is more going on here, but I'll focus on the actor model aspects. The `active` field holds the mutable `LogSegment`, and `snapshot` wraps the `PartitionState` in an `ArcSwap`. The actor owns the receiver end of the channel (`rx`), which all `Handle` instances share. 

The `Actor` then runs a loop matching all commands:

```rs
impl PartitionActor {
    pub async fn run(&mut self) {
        while let Some(c) = self.rx.recv().await {
            match c {
                PartitionCommand::Append { mut record, acks, done } => {

                    // ...
                    // abbreviated

                    let current_active = self.active.publish();
                    let state = self.snapshot.load_full();

                    let mut segments = state.segments.as_ref().to_vec();
                    *segments.last_mut().unwrap() = current_active;

                    let next = Arc::new(PartitionState {
                        segments: segments.into(),
                        high_watermark: hw,
                        log_end_offset: leo,
                        replicas: state.replicas.clone(),
                    });

                    self.snapshot.store(next);
                }
            }
        }
    }
}
```

State is replaced exclusively inside this loop — no `Mutex` or other synchronization primitives needed.

Finally, the `Handle` looks like this:

```rs
pub struct PartitionHandle {
    id: u32,
    tx: mpsc::Sender<PartitionCommand>,
    pub state: Arc<ArcSwap<PartitionState>>,
    join: Mutex<Option<JoinHandle<()>>>,
}
```

You can clone a handle as many times as needed. Each clone shares the same channel to the actor loop, and reads never race because they rely on `pread` — no mutable seek position involved.

## Conclusion

This solution is more complex and introduces subtleties that require careful testing. It is not a replacement for `Mutex` in quick prototypes, nor for `Atomic*` when you need fine-grained control over individual shared values.

What it offers is a different mental model for concurrency — one built around ownership and message passing rather than locks, and applicable regardless of the language you're working in. 