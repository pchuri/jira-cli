# Agents Release Playbook

## Purpose
Capture fallback release steps for situations where a recent bug fix skipped automation because the commit missed the Conventional Commits format.

## Option 1: Trigger semantic-release with an empty commit
1. Branch from the latest `main` or `beta`.
2. Confirm the fix is already on that branch and CI is green, then create the empty commit.
   ```bash
   git commit --allow-empty -m "fix: trigger release after hotfix"
   ```
3. Open a PR; once checks pass, merge into `main` or `beta`.
4. The merge runs the Release workflow and bumps the patch version.

## Option 2: Manual version bump (last resort)
1. Use when semantic-release fails or an emergency demands an immediate release.
2. Update the `version` field in both `package.json` and `package-lock.json`.
3. Commit the changes.
   ```bash
   git commit -am "chore(release): 1.0.1"
   ```
4. Tag and push.
   ```bash
   git tag v1.0.1
   git push origin HEAD --tags
   ```
5. Draft the GitHub release manually or run `gh release create`.
6. Publish to npm manually if required via `npm publish`.

> Default approach: land real code changes with Conventional Commit messages so semantic-release keeps working. Reserve these manual steps for break-glass moments and return to automated releases afterward.
