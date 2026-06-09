+++
title = 'Graceful Shutdown'
date = 2026-03-05T22:03:54+01:00
draft = false
tags = ["go", "backend", "fault tolerance", "error handling", "concurrency"]
+++

Graceful shutdown is critical for production readiness. It ensures that in-flight requests complete or are properly handled, and that dependent services can cleanly release resources during rolling updates or maintenance windows.

In a distributed, multi-instance system, instances go up and down continuously. Starting up is straightforward: configure health probes and optimize startup time. Shutting down gracefully is more complex. 

At scale, when your system processes multiple concurrent requests, you must ensure work either completes or is properly delegated before shutdown.

## Go

The following examples use Go and its concurrency-first design. However, these principles apply equally to Spring Boot, Node.js, and other platforms.

## Waiting

The idea is simple. You have a process running and you need to leverage the underlying operating system to coordinate signaling to actual stopping.

Your flow looks like this:
1. Event triggers stopping sequence against supervisor (we'll get to that later)
2. Operating system emits signal to process
3. Your process delays stopping until confirmation

### Signals

On Linux systems, two signal types exist:
- Catchable: `SIGTERM`, `SIGINT`, `SIGHUP`
- Non-catchable: `SIGKILL`, `SIGSTOP`

### Shutdown coordination

Your application typically subscribes to signals, wires them with shared, concurrency-friendly global data (usually `context.Context`), and defines cleanup routines.

```go
    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()
    
    go func(){
        // ... your logic
    }()
    
    <-ctx.Done()
    
    // cleanup work
    server.Shutdown()
    dependencyA.Cleanup()
```

You'll want to wire up your cleanup either in your caller (like `main`) or accept `context.Context` as a function argument. 


#### Delaying

##### Server handlers

With `http.Server`, you must call `server.Shutdown()` manually after receiving the signal.

```go
    server := &http.Server{
        Addr:    port,
        Handler: mux,
    }
    go func() {
        if err := server.ListenAndServe(); err != nil {
            // ... handle error
            done()
        }
    }()
    
    <-ctx.Done()
    server.Shutdown()
```

#### Worker pools

For worker pools, whether custom or from a library, a well-designed library needs only `ctx` passed. It should regularly check `ctx.Done()` and handle cleanup accordingly. 

Here's an example of such a library:

```go
    // caller
    go worker.Start(ctx)
    
    // worker
    func Start(ctx context.Context) {
        select {
            // ...
            case <-ctx.Done():
                // or other Shutdown methods
                close(jobs)
                return
        }
    }
```

### Design considerations

Notice the worker pool both stops receiving work and orchestrates cancellation of ongoing tasks. 

This comes at a cost. You might want to split it into two phases since they're different, and you might distinguish between waiting for a signal versus setting a deadline to stop work. 

Here's a better, more idiomatic Go design:

```go
func (wp *WorkerPool) Start(ctx context.Context) {
    for i := 0; i < p.workers; i++ {
        p.wg.Add(1)
        go func(ctx context.Context) {
            defer p.wg.Done()

            for {
                select {
                    case <-ctx.Done():
                        return
                }    
            }
        }(ctx)
    }
}

// Called after you know you want to stop to handle timeouts
func (wp *WorkerPool) Shutdown(ctx context.Context) error {
    close(p)
}
```

This achieves the following:
- Context is used for cancellation of in-flight work
- Explicit methods handle lifecycle

You see the `http.Server` example above implementing this exact pattern.

### Container orchestration

This behavior heavily depends on your deployment environment. In ephemeral container systems like Kubernetes, the control plane may not wait for you to emit an exit code. Kubernetes escalates from catchable signal `SIGTERM` to non-catchable `SIGKILL`. You can only influence the grace period. 

To do so, use:

```sh
> kubectl explain pod.spec.terminationGracePeriodSeconds
KIND:       Pod
VERSION:    v1

FIELD: terminationGracePeriodSeconds <integer>


DESCRIPTION:
    Optional duration in seconds the pod needs to terminate gracefully. May be
    decreased in delete request. Value must be non-negative integer. The value
    zero indicates stop immediately via the kill signal (no opportunity to shut
    down). If this value is nil, the default grace period will be used instead.
    The grace period is the duration in seconds after the processes running in
    the pod are sent a termination signal and the time when the processes are
    forcibly halted with a kill signal. Set this value longer than the expected
    cleanup time for your process. Defaults to 30 seconds.
```

## Conclusion

Graceful shutdown involves tradeoffs that depend heavily on your deployment environment. In some cases, you might prefer to simply close all channels instead. Weighing these options is essential before wiring up your application correctly.