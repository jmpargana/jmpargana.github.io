+++
title = 'Bitmap Leaser: Efficient IP Allocation with Bitmap Data Structures'
date = 2026-06-09T13:32:46+01:00
draft = false
tags = ["Go", "Backend", "Networking", "Bit", "Data Structures", "NAT"]
+++

I've become interested in implementing backend infrastructure components we often take for granted: connection pools, circuit breakers, rate limiters, semaphores, resource allocators, etc.. These are typically provided by standard libraries (like `net/http`) or third-party services (like Envoy), but understanding their internals is valuable.

This is the first post in a series where I'll implement key algorithms from scratch, exploring different data structures and their trade-offs in terms of performance and scalability.

We'll start with an **IP allocator** implemented using a bitmap leaser. A bitmap is simply a compact, bit-wise representation of boolean states—yes/no for each element. Here's a basic bitmap:

```go
type Bitmap []bool
```

While conceptually clean, this approach has a critical inefficiency: most architectures store a `bool` as a full byte (8 bits) in memory due to CPU addressing constraints. For a range containing millions of addresses, this wastes 87.5% of memory.

A better approach packs multiple bits into larger data types (typically `uint64`), achieving dramatic memory savings while maintaining O(1) allocation and deallocation operations. 

## Problem Statement

Consider allocating IPs from a large IPv6 range like `2001:db8::/80`. Each IPv6 address requires 16 bytes to store. However, if we maintain a base address, we only need to track an offset index relative to that base—a massive optimization.

Instead of storing each IP as a full `uint128` (16 bytes), we store a single bit representing allocation status. This yields a **128× storage reduction**.

Math:
- IPv6 /80 range = 2^(128-80) = 2^48 addresses ≈ 281 trillion IPs

Storage comparison:
- **Full IPv6 storage**: 281 trillion × 16 bytes ≈ **4.5 PiB** (impractical)
- **Bitmap storage**: 281 trillion × 1 bit ≈ **35 TiB RAM** (still large, but feasible)

For real-world systems managing CIDR blocks, this difference is transformative. 


For production IPv6 systems, more sophisticated approaches (range compression, interval trees) exist. However, when you only need binary allocation status and can work with fixed IP ranges, bitmaps provide an excellent balance of simplicity and efficiency. 


## Go Implementation

In Go, bitmaps typically use `uint64` arrays:

```go
type Bitmap []uint64
```

Each `uint64` is called a **word** and holds 64 bits. Here's our allocator structure:

```go
type Allocator struct {
	base uint32              // Starting IP address
	bitmap []uint64          // Bit array (1 = allocated, 0 = free)
	leases map[uint32]*Lease // Track active leases with TTL
}
```

To initialize the bitmap, we first parse the CIDR block and calculate the word count:

```go
_, ipNet, _ := net.ParseCIDR(prefix)
ones, bits := ipNet.Mask.Size()
hostBits := bits - ones           // Number of host bits in the range
size := 1 << hostBits              // Total addresses (2^hostBits)
words := (size + 63) >> 6          // Number of uint64 words needed
```

The expression `(size + 63) >> 6` efficiently rounds up: it's equivalent to `(size + 63) / 64`, but using bit shifting (left shift by 6 = multiply by 2^6 = 64) avoids expensive division. Adding 63 ensures we allocate enough words even if the bit count doesn't divide evenly.

## Allocation and Release

The core challenge is finding the first available bit (O(n/64) where n is the bitmap size) and updating it atomically.

### Allocation

```go
for i, word := range a.bitmap {
	free := ^word                      // Invert: 0s become 1s, 1s become 0s
	if free == 0 {                     // All bits occupied, skip word
		continue
	}
	
	bit := bits.TrailingZeroes64(free) // Position of first free bit
	idx := (i << 6) + bit               // i << 6 = i * 64 (word offset + bit position)
	a.bitmap[i] |= 1 << bit             // Set bit (mark as allocated)
	
	ip := a.base + uint32(idx)         // Convert to IP
	return ip
}
```

How it works:
1. Iterate through each `uint64` word
2. Invert the word (`^word`): free bits become 1, allocated become 0
3. Use `bits.TrailingZeroes64()` to find the first 1-bit (first free slot)
4. Calculate absolute index: word index × 64 + bit offset
5. Set the bit using OR (`|`): `1 << bit` creates a mask with single bit set
6. Return allocated IP

### Release

```go
idx := ip - a.base              // Convert IP back to index
wordIdx := idx >> 6             // idx >> 6 = idx / 64 (which word)
bitIdx := idx & 63              // idx & 63 = idx % 64 (which bit in word)
a.bitmap[wordIdx] &^= 1 << bitIdx // Clear bit (mark as free)
```

Deallocation reverses the process:
1. Calculate index from IP: `ip - base`
2. Extract word index: `>> 6` is bitwise division by 64
3. Extract bit position: `& 63` is bitwise modulo 64 (checks lowest 6 bits only)
4. Clear the bit using AND-NOT (`&^`): zeros out that specific bit

The `&^` operator is Go's "bit clear"—it AND's with the inverted mask, efficiently toggling a bit to 0.

## API Design

Beyond allocation/deallocation, production allocators need:

- **`Renew(ip)`**: Extend lease TTL for an active allocation
- **`Release(ip)`**: Explicitly free an IP
- **Concurrency control**: Use `sync.Mutex` to protect bitmap access in concurrent environments
- **Cleanup**: Implement a background goroutine that releases expired leases based on TTL

For full implementation details, see the [bitmap-leaser repository](https://github.com/jmpargana/bitmap-leaser), which includes a complete REST API wrapper. This article focused on the core bit manipulation and data structure fundamentals.


## Extending to IPv6

While this example uses IPv4 (32-bit), IPv6 requires `uint128` or a custom big integer type. The bitmap approach still works perfectly—only the index calculation changes.

For IPv4, conversion utilities are straightforward:

```go
func ipToUint32(ip net.IP) uint32 {
	return binary.BigEndian.Uint32(ip.To4())
}

func uint32ToIp(n uint32) net.IP {
	ip := make([]byte, 4)
	binary.BigEndian.PutUint32(ip, n)
	return ip
}
```

Key detail: **network byte order is always Big Endian** (most significant byte first), regardless of CPU architecture. These conversions are safe on any platform.

For IPv6 ranges, you'd use similar logic but with 128-bit integers or manual byte manipulation for larger indices.