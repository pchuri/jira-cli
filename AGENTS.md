# Agents Release Playbook

## Purpose
Capture fallback release steps for situations where a recent bug fix skipped automation because the commit missed the Conventional Commits format.

## ✅ Best Practice: Use Conventional Commits
Always use proper Conventional Commit messages to let semantic-release work automatically:
- `feat:` → MINOR version bump (e.g., 1.0.0 → 1.1.0)
- `fix:` → PATCH version bump (e.g., 1.0.0 → 1.0.1)
- `BREAKING CHANGE:` → MAJOR version bump (e.g., 1.0.0 → 2.0.0)

**Recent success example**: PR #7 used `feat: support token-only authentication without username` and automatically released v1.1.0 ✨

---

## Fallback Options (when automation fails)

### Option 1: Trigger semantic-release with an empty commit
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

---

## 📝 Summary

**Default approach**: Land real code changes with Conventional Commit messages so semantic-release keeps working automatically. Reserve manual steps above for break-glass moments only, and return to automated releases afterward.

**Commit Format Reference**:
- `feat: description` → new feature (MINOR bump)
- `fix: description` → bug fix (PATCH bump)
- `docs: description` → documentation only (no release)
- `chore: description` → maintenance (no release)
- Add `BREAKING CHANGE:` in body for MAJOR bump
