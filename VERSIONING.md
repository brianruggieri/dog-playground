# Versioning

This project uses Semantic Versioning (`MAJOR.MINOR.PATCH`) and git tags.

## Rules

- `MAJOR`: breaking changes.
- `MINOR`: backwards-compatible features.
- `PATCH`: backwards-compatible fixes.
- Tags are created as `vX.Y.Z` (example: `v0.2.1`).
- `package.json` is the source of truth for the current version.

## Release flow

1. Merge changes to `main`.
2. In GitHub Actions, run the `Release Version` workflow.
3. Choose `patch`, `minor`, or `major`.
4. Workflow updates version files, creates a release commit, creates a tag, and pushes both.
5. The `Deploy GitHub Pages` workflow runs on the resulting `main` push and publishes the update.

## Local release command (optional)

Use this if you want to bump locally instead of the workflow:

```bash
source ~/.nvm/nvm.sh && nvm use
npm version patch -m "chore(release): %s"
git push --follow-tags
```
