+++
title = 'OAuth2 Explained'
date = 2026-03-05T22:03:54+01:00
draft = false
tags = ["architecture", "backend", "oauth2", "authorisation", "authentication", "oidc"]
+++

I've recently integrated a provider and consumer service with Azure AD and B2C. Setting up the scopes was confusing and since I've felt that although I've been using OAuth in my systems for a long time, I haven't really understood it well, I decided to invest some time and really learn how it works under the hood. 

I could claim that reading the various RFCs offered clarity, but that wouldn't be accurate. The key reason they didn't is that there's no single cohesive document explaining the core concepts. It's spread around multiple ones:
- RFC 6750 defines how tokens are actually used
- RFC 7636 patches a major authorization code vulnerability
- RFC 8252 redefines best practices for mobile and desktop
- RFC 8414 adds discovery
- RFC 6819 explains security assumptions after the fact


## OAuth2 in Action

After some research I landed on [this book](https://www.manning.com/books/oauth-2-in-action). It does a good job explaining the fundamentals, giving clear implementation details on all entities and a complete set of security issues and gaps in the framework.

I'll explain these concepts simply so the code examples below make more sense.

## Basics

OAuth2 isn't a protocol; it's a framework of protocols. Since it's an abstraction, it has different implementations, each focused on a particular use case. 

The abstraction revolves around **delegating authorization** to obtain **limited access** to a _resource server_ on behalf of _resource owner_ without sharing credentials.

Let's unpack this. 

OAuth2 is **not** about authentication. A commonly misunderstood aspect is that developers often try to use OAuth2 for authentication because of its flexibility, and libraries now exist that support this pattern (more on this later).

Let's pick a simple example. You have some photos stored in a server. You have your credentials to access that server. Now another service—say a printer—wants to access _your_ photos to print them. You could download them and provide them to the printer. You could share your storage credentials so the printer downloads them for you, _or_ you could use OAuth. You generate a _token_ to allow the printer service to download those photos.

This represents the **primary authorization pattern OAuth2 is designed for**.

## Actors

OAuth2 is designed around four actors:
- Resource owner
- Protected resource
- Authorization manager
- Client

The resource owner can be anything—usually a user, but could also be a service. The protected resource sits behind a service and is sometimes called the _resource server_. The client can be a server as well.

The flow is straightforward:
1. Client requests resource owner authorization to access protected resource
2. Resource owner informs authorization manager that he allows that access
3. Authorization manager issues _token_ and shares it with client
4. Client requests protected resource with _token_



## Token

The whole framework revolves around a _token_—a representation of something with limited access, issued per client per resource owner per protected resource. But what is a _token_ exactly?

The OAuth2 specification doesn't define exactly what a token should be. It defines principles such as: tokens should not be easily guessable, they should be short-lived, and so on.

We'll get to JWT later in this article, but for now let's focus on the flows, despite of token implementation.

## Grants

As the actors can be different things, there are predefined flows, also called grant types, to represent the most usual ones. In some of them not all actors are there. In other multiple actors are the same one. We'll start looking at those cases first, as they have the easiest flow.

For each flow, a specific `grant_type` value is passed in the payload.

### Client credentials

`grant_type: client`

When the resource owner isn't important, your grant doesn't need to dance between resource owner, client, and authorization manager. It can call the authorization manager directly with its credentials to request token generation. The authorization manager validates the credentials and generates a token, which is then used to call the protected resource.

Steps:
1. Client calls authorization server with `client_id` and `client_secret`
2. Authorization server responds with token
3. Client calls resource server with token
4. Resource server validates token

The client credentials can be passed in multiple ways. Either in the body or as an auth header. The auth header with base64 encoding seems to be the prefered version (documented in cloud providers).

### Implicit

`grant_type: implicit`

When the resource owner and client are the same—your client application lives in the browser and represents the user—you can use this grant type. 

This grant was created as a simplification of the authorization code grant but has been deemed insecure and is only relevant in few situations. We'll skip it for now.

### Assertion

`grant_type: assertion`

Also known as the _On Behalf Of_ flow. The resource owner is already represented by the client, which wants to propagate that to another resource server. 

You call the authorization server with the token you're carrying so it generates a new one based on that. 

### Resource Owner

`grant_type: password`

This one was created as a stepping stone for OAuth2 adopters relying on basic `user:password` headers. It's not recommended since it involves passing the password in the payload, defeating the purpose of limited, short-lived tokens.

### Authorization code

`grant_type: code`

This is the main flow—the most complete and the one you should favor when implementing OAuth2 on a frontend service. 

The flow is as follows:
1. Client generates `code_challenge`, `code_verifier`, and `state`
2. Client calls authorization server with `redirect_uri`, the challenge, state, and `client_id`
3. Authorization server returns a redirect URI where the user is asked for **authorization**
4. After logging in, the user consents to the limited scope of access (permissions)
5. Authorization server calls client on the provided `redirect_uri` (if it matches configuration) with the `state` and a `code`
6. Client validates `state` and exchanges `code` for a _token_, providing the `code_verifier`
7. Authorization server validates the verifier against the challenge and generates a _token_
8. Client calls resource server with _token_

There are several security measures that come with it to prevent CSRF attacks, namely a `nonce` and `PKCE` (pronounced "pixie"). 

All these moving parts complement different parts of the system and tackle different vulnerabilities. In the implementation post you'll see that it's actually pretty straight forward.

## Scope

For all these JSON requests, include `scope`, which represents the _limited_ access the resource owner is granting on the resource server. Like the _token_, this is just a vague specification. You can implement your own rules as needed. OIDC uses words like `email profile pictures`, but you can have `read:files write:photos` on your API. Azure AD uses tenant IDs or API URIs. The only requirement is to pass each scope space-separated inside that string, and the client must be registered in the authorization server with each of the scopes being requested on behalf of the resource owner.

## Token

Now for the fun part. The token can be any string. I won't detail why short strings or meaningful ones are problematic, nor why sharing a database for the resource owner to validate tokens with the authorization server is a bad idea (though the framework doesn't forbid it).

Token design should simplify two things: passing context and simplifying validation. Enter JWT. 

The JWT contains a header, a payload, and a signature. The three parts are base64-encoded and `.`-separated. 

Why is it so powerful? Well, the signature enables many approaches. You can use symmetric signing (where resource server and authorization server share a private key) or asymmetric (where you have public and private key pairs). You can add encryption on top of the signature. By signing the token, you allow it to carry context that you know was only included by your authorization server. It also prevents you from needing to share a database or call the server for validation (via an introspection endpoint). With encryption on top, you could even include sensitive information.

Signing is a powerful solution for removing extra network calls from your flow. Here's how JWT signing is standardized:
1. Authorization server has multiple public/private key pairs for signing tokens (or a shared private key, if agreed with the resource server)
2. It serves the public keys at a `.well-known/keys` endpoint, which resource servers can regularly check for non-expired keys
3. When generating a token, it's signed by a particular key, and the key ID (`kid`) is included in the token header
4. The resource owner computes the signature with the public key that matches the `kid`


The JWT can include various information in the payload, though keep it short since it's passed as a header. Some common fields (called _registered_ claims) are recommended but not mandatory:
- `iss`: issuer
- `sub`: subject
- `aud`: audience (identifies the recipients)
- `exp`: expiration time
- `iat`: issued at time
- `nbf`: not before time
- `jti`: unique JWT identifier

Besides the registered claims you also have public and private claims. 


## Client registration

Finally, client registration. It can be static or dynamic, though you'll often see manual provisioning for dynamic registration. 

## Extras

Repeating an important point: OAuth2 does not handle **authentication**. To cover that, an extension protocol called OpenID Connect was created on top of it. It relies on the authorization server also being an identity provider. When that's the case, you can add an authentication layer by using a second token called the ID token and serving a `/userinfo` endpoint. 

The OIDC protocol is more complex and deserves its own post. I'll cover some details in the implementation post.