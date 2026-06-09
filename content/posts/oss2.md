+++
title = 'OpenSource - 2 - First Contribution'
date = 2024-08-30T22:03:54+01:00
draft = false
tags = ["Open Source", "OSS", "containerd", "go"]
+++

## Getting started

I should've called this _My Second Contribution_ for accuracy. The first contribution can be quite easy, so I'll call that one step zero and this as my first. It even fits better with software engineering counting habits.

## Finding your target

Contributing to an open source project isn't that different from your daily job (assuming you follow industry standards). You go through the same setup steps. You'll read documentation about the organization, the team, tools needed, and how to set them up. 

Every open source project is different, but they tend to follow similar principles. You need:
- Code of conduct
- Contributing guide
- License
- Security guide
- README 

Sometimes it's all in the README. Sometimes in different markdown files. Sometimes in a Wiki section. Other times as a GitHub Pages site. If it's not there, that's a contribution opportunity right there.

Whatever you choose, you should be confident you can find information on:
- How to run code and tests
- What tools to use (linting, generating, etc.)
- What style to follow
- How to document and communicate changes

## Step zero

If you look at big projects on GitHub, you'll find extremely complex source code, extensive documentation with guidelines, thousands of issues with many comments. If you investigate commenters and maintainers, you'll sometimes spot people from big tech companies, principal engineers, community giants. In short, it's intimidating. 

Don't be frightened. For your first step—let's call it step zero—there's a single repository called [First Contributions](https://github.com/firstcontributions/first-contributions) that simplifies navigating code.

## Actual contribution

Now that you've completed your first contribution, I'll share my experience rather than tell you exactly which repository to contribute to.

I've been reading code from tools I use regularly. Since getting the idea to contribute to open source, I've also visited issues and the `/org/repo/contribute` pages.

> NOTE: If you didn't know, searching for `/contribute` in any repository automatically lists issues labeled as `good first issue`.


Inside the `containerd` organization, I learned about the tool `nerdctl`—a CLI compatible with Docker but wired for the containerd runtime. 

By chance, I found a good first issue that was actually a small feature request, not just documentation or a bug fix. [The issue](https://github.com/containerd/nerdctl/issues/2835) was to add multiple build contexts to an image build, allowing files from different folders.

I cloned the repository and explored the code to understand how it worked. After some experimentation, I figured out how to pass that flag down to [BuildX](https://github.com/docker/buildx).

Before opening the PR, I read all available documentation to understand how tests should look and what documentation was needed for the new CLI flag.

[Here's the result.](https://github.com/containerd/nerdctl/pull/2861)

During review, I realized there was another [potential PR](https://github.com/containerd/nerdctl/pull/2869) I could do: refactoring a test API to use `t.TempDir()` for generating ephemeral directories. 

## Conclusion

My first open source contribution turned into a fast track to a second for the same project and showed me that the hardest part of joining any project's contributor community is the onboarding process. Once you understand the code and have experienced the contribution process, it becomes much easier to iterate. 

With that, I invite you: if you want to join the open source community but doubt your abilities, start by exploring the code. This is something you likely already do in your daily work. Starting is the hardest part.