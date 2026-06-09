+++
title = 'OpenSource - 3 - Humbled by AI'
date = 2026-03-19T22:03:54+01:00
draft = false
tags = ["Open Source", "OSS", "TypeScript", "GHA", "GitHub Actions"]
+++

I found another project I could contribute to.

In the last weeks of December, while a team at my company was migrating from Azure DevOps Pipelines to GitHub Actions, a colleague reached out. One of the actions we developed for company-wide reuse wasn't working. It was the CI workflow responsible for building, running, and publishing unit and integration tests, with security scans running in parallel. 

This workflow failed in their runtime because the runners didn't have Docker Compose installed, and the [compose-action](https://github.com/hoverkraft-tech/compose-action) crashed with an unexpected error. 

Navigating the code exposed a quick bug to fix, so I opened my laptop and got to work. 

## The Bug

The bug was very easy to fix but hidden in several layers of if/else logic with 3 flags. It took a while to find the cleanest boolean expression without refactoring too much of the code. 

This is the kind of setup where, no matter how you look at it, it always seems improvable. You'll understand once you see this snippet:

```typescript
async install({ composeVersion, cwd, githubToken }: InstallInputs): Promise<string> {
    const currentVersion = await this.getInstalledVersion(cwd);

    const needsInstall = !currentVersion || (composeVersion && composeVersion !== currentVersion);
    if (!needsInstall) {
      return currentVersion;
    }

    let targetVersion = composeVersion || COMPOSE_VERSION_LATEST;

    if (targetVersion === COMPOSE_VERSION_LATEST) {
      if (!githubToken) {
        throw new Error("GitHub token is required to install the latest version");
      }
      targetVersion = await this.getLatestVersion(githubToken);
    }

    await this.installVersion(targetVersion);

    return this.version({ cwd });
  }
```

## Pushing changes

Before submitting the PR, I filed a [bug report](https://github.com/hoverkraft-tech/compose-action/issues/232), documenting the issue as requested in the code of conduct. Then, minutes later, I opened the [PR](https://github.com/hoverkraft-tech/compose-action/pull/234).

Everything went well, and the maintainer merged the changes within minutes. 

## Humbling experience

Here's why I'm writing this article. 

Between filing the bug and opening the PR (minutes apart), Copilot had already created a branch and opened a draft PR with a plan to identify the issue. It correctly identified it and submitted a similar PR with comparable refactoring of boolean logic and the same testing style. All this in ~5 minutes compared to the 2–3 hours it took me to clone code, read documentation, study tests, setup my laptop, run tests, and document the PR. 

This wasn't the state-of-the-art we see today with impressive coding agents and cheap models like Gemma. It was January, and it was already insanely powerful, making it compelling for maintainers to stop relying on contributors for small tasks.