# Release Process

Uses [hatch-vcs](https://github.com/ofek/hatch-vcs) - versions from git tags.

## Creating a Release

1. Merge changes to `main`
2. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. Create a GitHub Release from the tag
4. The `build-wheel.yml` workflow auto-builds and attaches the wheel

## PR Prereleases

PRs against `main` auto-create a prerelease with a built wheel.
Install link is posted as a PR comment. Cleaned up on PR close.
