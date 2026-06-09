+++
title = 'MiniTube - PKI & rootCA + LB Setup'
date = 2026-03-05T22:03:54+01:00
draft = false
tags = ["kubernetes", "tls", "pki", "ca", "lb", "load balancer", "cloud", "gateway api", "cert-manager"]
+++

This post is part of my _MiniTube_ series. Check out other related posts if you find this content useful.

## Problem

Let's start with the problem. The [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) is only available in secure contexts (HTTPS) or localhost. 

While developing the frontend for my MiniTube application, the function I was using to generate a random UUID (`crypto.randomUUID()`) stopped working once I deployed the container in Kubernetes. 

## Solution

The solution wasn't really a solution, but rather an opportunity to understand how to set up TLS locally. 

Like OAuth, TLS is something I've used for a long time. It's part of every production deployment. It's part of internal pod communication in Kubernetes if you have a service mesh. It's ubiquitous. 

Yet, I've never really spent time truly understanding how it works. This prompted me on a journey to understand something that seemed like one thing (_TLS_) but turned out to involve many other things, because _TLS_ is really just part of a cryptography ecosystem standardized in how we communicate over the internet. 

## Scope

I'll use different posts to dive deeper into TLS (cryptography, the protocol itself, versions, and flows).

This post focuses on PKI, certificate setup options, and the easiest way to set up a load balancer with TLS.

## PKI

To set up a secure environment, you need _trust_. In distributed systems with many moving parts, trust requires some centralized entity (or better, multiple) to provide confidence that an actor is trustworthy. 

Certificates can be fake, tampered with, invalid, or misused. PKI (public key infrastructure) was created to define trustworthy organizations that could delegate validation to others they trust, creating a chain of trust. 

PKI has a flow to generate and validate certificates. The nomenclature and process of each actor matters less than understanding how certificates are passed and validated. 

When you perform a TLS handshake before submitting an HTTP request to a server, the server responds with a certificate and a chain of certificates extending to a root CA (certification authority). 

Locally, you're expected to have the missing CA, either in your browser or operating system. You then compute the signature of the chain using the public key you have locally. All these computations happen quickly and before you start encrypting the content with the temporary server/client secret. 

These root CAs include public keys for well-known entities: Let's Encrypt, DigiCert, Apple, etc.

Should you create a certificate from an existing CA (not your own) or create your own root CA? 

The answer is _it depends_. Creating your own root CA has limitations because it won't be automatically trusted by other clients unless you add it to their root stores. However, it's incredibly useful for internal-only _trust_ setups. 

## Requesting a certificate

First, let's explore getting a certificate from an existing CA that you don't own. This used to be expensive until Let's Encrypt created the ACME (Automatic Certificate Management Environment) protocol, a dance over HTTP that automates certificate generation. 

This protocol involves requesting a certificate with a validation type that the ACME server will use to prove you own the domain. You don't need to implement the interaction flow yourself. Great tools exist, like [cert-manager](https://cert-manager.io/docs/), that implement the protocol with full infrastructure automation.

The issue is, if you don't own the domain yet or can't expose a client on it to prove ownership, you won't get a certificate (unless in non-production environments).

## Custom root CA

Moving to custom root CA. If you only intend to use a domain locally (and trust yourself), creating a root CA might suffice. 

[mkcert](https://mkcert.org/) is an amazing tool that does exactly that. It generates a local root CA for creating certificates by and for yourself.


Start by installing the CA on your system:

```sh
> mkcert -install
```

Then generate the certificate:

```sh
> mkcert your-domain.com
```

Finally, navigate to the certificate location to use them.

```sh
> mkcert -CAROOT
```

## Using the certificates

For each certificate, you'll have the public and private key, both encoded with X.509 format. If you configured `cert-manager` previously, you can leverage it by pointing to files or full strings instead of configuring the ACME flow.

Create a secret with the certificates first:

```sh
mkcert -install
CA=$(mkcert -CAROOT)
kubectl create secret tls minitube-tls --cert="$CA/rootCA.pem" --key="$CA/rootCA-key.pem" --namespace cert-manager
```

With that in place, create a `ClusterIssuer`, which is a simple payload when it doesn't need ACME configuration.

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  ca:
    secretName: minitube-tls
```

Then, using the new Gateway API, create a `Gateway` (I'll cover the missing `GatewayClass` creation later):

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: minitube-gateway
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-staging
spec:
  gatewayClassName: eg
  listeners:
  - name: https
    tls:
      mode: Terminate
      certificateRefs:
      - name: minitube-tls
    hostname: minitube.local
    port: 443
    protocol: HTTPS
    allowedRoutes:
      namespaces:
        from: All
```

Finally, add the domain to your static DNS configuration so your browser translates the TLS-secured domain to an IP:

```sh
> sudo cat $(kubectl get gateway minitube-gateway -o jsonpath='{.status.addresses[0].value}') >> /etc/hosts
```

## Load Balancing

The final step is creating a load balancer so you can access your cluster externally. This example is for [kind](https://kind.sigs.k8s.io/) users. There's a tool that creates a tunnel to your cluster running inside Docker, letting you replicate a cloud provider without external services: [cloud-provider-kind](https://github.com/kubernetes-sigs/cloud-provider-kind).

Once running, install any service for load balancing or acting as an API Gateway. One of my go-to tools is [Envoy](https://gateway.envoyproxy.io/).

Running this command sets up a `GatewayClass` you can use to attach an external IP to the Gateway you configured earlier:

```sh
> helm install eg oci://docker.io/envoyproxy/gateway-helm --version v1.7.1 -n envoy-gateway-system --create-namespace --skip-crds
```

## Conclusion

That covers how I configured my MiniTube project to be accessible with TLS and use the Web Crypto API locally. I hope you gained some knowledge on how PKI works and how to set it up.

I'll create a future post explaining certificate contents and how the TLS protocol itself works.