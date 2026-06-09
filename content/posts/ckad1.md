+++ 
draft = false
date = 2024-08-14T15:05:23+01:00
title = "CKAD - 1 - Foundations"
description = ""
slug = ""
authors = []
tags = ["certification", "kubernetes"]
categories = []
externalLink = ""
series = []
+++

Welcome! In this series, you'll read along my journey to CKAD certification. Expect high-level knowledge sharing and hopefully some useful tips.

## Picking the course

Visiting the [Linux Foundation](https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/) site, you'll see a suggested package that includes a course, annual subscription, and more. 

After getting advice from colleagues who are already certified, I decided to follow a different course instead on [Udemy](https://www.udemy.com/course/certified-kubernetes-application-developer/learn/lecture/28376970#overview). 

Not only does this have close to 5-star reviews, it's significantly cheaper. I purchased it at an 80% discount (around $11).

## First impressions

I've just started. After completing _Section 2: Core Concepts_, I'm already very impressed with the instructor. Even though I've been using Kubernetes professionally and dealing with it daily—debugging, deploying, securing—this course is the first time I've truly understood core concepts that make documentation and manifest development much clearer. 

Since the course focuses heavily on `kubectl`, I've stopped relying on `k9s` as a daily dependency and am now comfortable using `kubectl` directly.

### Manifest skeleton

```yaml
apiVersion: string
kind: Kind
metadata: map[string]any
spec: any
```

Each manifest always has these 4 components. 

`Kind` can be anything available in the Kubernetes API (like `Pod`, `Service`, `ReplicaSet`, etc.) or something custom (a _CRD_).

`spec`, the most important field, is strongly typed and must match its `kind`. 

> NOTE: In future posts I'll dive deeper into `apiVersion`, `kind`, and `spec`. Understanding these fields is really about understanding how Kubernetes exposes its API and how you can extend it.


### Kubernetes API References

My motivation to explore the documentation splits into 2 points.

#### LLMs

In my quest to become a better software engineer, I want to resist the constant urge to find the _easy_ solution. For most questions, instead of searching StackOverflow, guides, or articles, I end up taking the easy route: asking the latest powerful model. 

This is sadly becoming a recurring issue—far more serious than relying on `k9s`. 

One way I'm breaking out of this cycle is to find information from 2 sources: either the official documentation or the source code directly. 

#### Certificate

My second motivation is that during certification, you only have access to documentation. Ideally, you should become well versed in its structure to navigate it quickly.

#### Reference

Well, the docs are massive—over 1000 pages—but the API reference, being automatically generated, is quite intuitive and feels like navigating code.

You start in the [References > Kubernetes API](https://kubernetes.io/docs/reference/kubernetes-api/) section. If you can't find it immediately in the categories, you can search by title (like `Pods`).

Every documentation page (except references) has an API reference link in the top-right corner labeled `X API`. Clicking it shows exactly what's expected in the spec.

Here's the example for `Pod`:

```yaml
PodSpec:
  Containers:
    - Name: string
      Image: string
      // ... plenty more
  Volumes:
  Scheduling:
  // ... plenty more
```

You can understand exactly what the required fields are and what data type is expected. 

### Imperative commands

The 3rd valuable lesson is using _imperative commands_ to quickly generate YAML manifest boilerplate. While you can use flags for complete resource definitions, you can quickly generate templates for common debugging scenarios. 

Before listing all this information, there are 2 important flags that are helpful when using imperative commands.

1. `--dry-run=client` → outputs the result without creating resources
2. `-o yaml` → outputs the exact YAML manifest needed

#### Pods

Since pods are working resources, you can _run_ them:

```sh
$ kubectl run nginx --image nginx --dry-run=client -o yaml
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: nginx
  name: nginx
spec:
  containers:
  - image: nginx
    name: nginx
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
```

For `Deployments`, you need to _create_. You can use the short form:

```sh
$ kubectl create deploy nginx-deploy --image nginx --replicas 4 --dry-run=client -o yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  creationTimestamp: null
  labels:
    app: nginx-deploy
  name: nginx-deploy
spec:
  replicas: 4
  selector:
    matchLabels:
      app: nginx-deploy
  strategy: {}
  template:
    metadata:
      creationTimestamp: null
      labels:
        app: nginx-deploy
    spec:
      containers:
      - image: nginx
        name: nginx
        resources: {}
status: {}
```

As you can see, the selector labels and pod metadata match, so that's one less thing to verify.

For services, here's an alternative to `create`:

```sh
$ kubectl expose pod redis --port=6379 --name redis-svc --dry-run=client -o yaml
apiVersion: v1
kind: Service
metadata:
  creationTimestamp: null
  labels:
    run: redis
  name: redis-svc
spec:
  ports:
  - port: 6379
    protocol: TCP
    targetPort: 6379
  selector:
    run: redis
status:
  loadBalancer: {}
```

For namespaces, you can also create them quickly:

```sh
$ kubectl create ns ns-test --dry-run=client -o yaml
apiVersion: v1
kind: Namespace
metadata:
  creationTimestamp: null
  name: ns-test
spec: {}
status: {}
```

You can always pipe YAML to files for further editing before applying, or skip file output if you just want to validate typing. A `--dry-run` provides feedback on type correctness.


## Conclusion

You'll remember these learnings best through the practice labs included with the Udemy course.

Experiment with quickly creating different resource types and debug pods on your dev cluster.