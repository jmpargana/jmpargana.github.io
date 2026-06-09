+++
title = 'Canonical Logging'
date = 2026-03-20T22:03:54+01:00
draft = false
tags = ["Go", "Backend", "Observability", "Monitoring", "Logging", "Context", "On-Call", "Operations", "Costs"]
+++

Since reading [loggingsucks](https://loggingsucks.com/), I've focused on implementing canonical logging across my applications. 

I highly recommend reading the full article there. It's a great read, interactive, complete, and makes a compelling case for why you should prefer it. I will try to give a very simple explanation so the code examples below make more sense.

Imagine each server call: whatever happens gets logged once with all relevant context for that single request. No complex [Loki](https://grafana.com/oss/loki/) queries. No guessing what _ERROR: something went wrong_ means. No searching across timestamps in different microservices to trace failures. That's canonical logging—the single log you've always wanted. 

In microservices and large-scale systems, canonical logging is essential. You simply add all necessary context to a single log.

## Setting up in go

Fortunately, Go developers have a great library: [ucarion/log](https://github.com/ucarion/log). It's compatible with any logging library you use, like [uber-go/zap](https://github.com/uber-go/zap).

It works by leveraging Go's `context.Context`. You pass along all key-value pairs you want in your logs, and once done, you call `log.Log`. 

Here's a simple example showing how to create middleware that sets up the logger using the standard library.

```go
package main

import (
    _ "github.com/ucarion/log/loggers/zap"
	"go.uber.org/zap"
)

func init() {
    zap.ReplaceGlobals(zap.NewExample())
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /endpoint", handler)
    loggedAppHandler := logger(mux)
    
    // ...
}

func logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := log.NewContext(r.Context())
		log.Set(ctx, "start_time", time.Now())
		
		correlationID := r.Header.Get("X-Correlation-Id")
		log.Set(ctx, "correlationId", correlationID)

		r = r.WithContext(ctx)
		next.ServeHTTP(w, r)

		log.Set(ctx, "end_time", time.Now())
		if r.Method == http.MethodOptions {
			return
		}
		log.Log(ctx, "request")
	})
}

func handler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	log.Set(ctx, "handler", "handler")
    
    // ...

	log.Set(ctx, "status_code", 200)
	w.WriteHeader(200)
}
```

## Keep in mind

While canonical logging is extremely useful, including all context in a single log can result in very large entries. If you've used services like Grafana Cloud, you know it can incur significant costs. Heavy logging, even with low retention, can become expensive.

My recommendation is to have a code review identify whether the extra context provides real value. It's easy to add everything (like _metadata columns_). In practice, you'll likely only need core fields that should always be present:
- correlationId
- error code (if using efficient representations for long string explanations)
- trace and span IDs (to match with traces)
- result
- userId (if GDPR compliant)
- sessionId
- essential business context