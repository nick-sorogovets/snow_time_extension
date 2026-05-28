---
name: snow-release-branching
description: Enforces SNOW Screenshot extension release workflow — version bump, feature branch, draft PR to master, no direct master commits. Use when planning or implementing changes, fixing bugs, bumping version, preparing CWS release, or when the user mentions Deploy.md, branch, PR, or release.
---

# SNOW Screenshot — release & branching

## Hard rules

- **Never commit or push directly to `master`.**
- **Every change** starts on a version branch and goes to `master` only via PR.
- On the **first change** for a release: create the branch, bump version if needed, open a **draft PR** to `master`.
- **All follow-up fixes** for that release: commit and push to the **same branch** (same PR) until merged.
- Read [Deploy.md](../../../Deploy.md) for build, CWS, OAuth, picker, and CI details.

## When to start (decision tree)

Before writing code:

1. **Is there already an open PR branch for this release?**
   - Yes → checkout that branch; do not create a duplicate branch or PR.
   - No → continue.

2. **Does this work need a new published version?**
   - User-facing fix, new feature, manifest/permission change, or anything that ships in CWS zip → **yes**, bump version.
   - Docs-only / internal tooling with no extension artifact change → version bump optional; still use a branch + PR (no master).

3. **Choose next version** (semver patch for fixes, minor for features):
   - Read current: `src/manifest.json` and `package.json` (must match).
   - CWS rejects zip if `version` ≤ last published ([Deploy.md §5](../../../Deploy.md)).

## Branch & PR workflow

### First change on a new release

```bash
git checkout master && git pull origin master
git checkout -b v<X.Y.Z>    # e.g. v0.1.2
```

Bump version in **both** (CI enforces match):

- `src/manifest.json` → `"version"`
- `package.json` → `"version"`
- `package-lock.json` → top-level `"version"` (and nested package entry if present)
- UI footers if shown: `src/popup.html`, `src/options.html` (`vX.Y.Z`)
- `README.md` → current version + short changelog bullet when user-facing

Make the change, then:

```bash
npm run i18n          # if i18n JSON changed
npm run build         # requires .env with PROD_OAUTH_CLIENT_ID
git add …
git commit -m "…"
git push -u origin HEAD
gh pr create --draft --base master --head v<X.Y.Z> \
  --title "vX.Y.Z — <short title>" \
  --body "$(cat <<'EOF'
## Summary
- …

## Test plan
- [ ] …

EOF
)"
```

Use **draft** until ready for review. Return the PR URL to the user.

### Subsequent fixes (same release)

- Stay on `v<X.Y.Z>` (or the existing PR branch name).
- Commit and push; **do not** open a new PR.
- **Do not** bump version again unless the previous bump was wrong or release was already merged/published.

### After merge to `master`

- GitHub Actions [`.github/workflows/release.yml`](../../../.github/workflows/release.yml) runs on push to `master`.
- If `src/manifest.json` **version increased** vs previous commit → build zip, upload CWS, tag `v<version>`, GitHub Release ([Deploy.md §7.5](../../../Deploy.md)).
- If version unchanged → no CWS publish.

Operator checklist after merge: [Deploy.md §7](../../../Deploy.md) (store listing, privacy, picker on Pages if `picker/` changed).

## Version & build checklist

Before marking PR ready:

- [ ] `src/manifest.json` and `package.json` versions identical
- [ ] `npm run build` succeeds locally
- [ ] Install from `build/` or `dist/*.zip` — smoke tests ([Deploy.md §4](../../../Deploy.md))
- [ ] If `picker/` changed → deploy GitHub Pages (`picker/` is **not** in extension zip)
- [ ] No secrets in commits (`.env`, `.keys/*.pem`, service account JSON)
- [ ] i18n: edit `src/i18n/*.json`, run `npm run i18n`

## Files that define “a release”

| Area | Files |
|------|--------|
| Version | `src/manifest.json`, `package.json`, `package-lock.json` |
| UI version label | `src/popup.html`, `src/options.html` |
| Changelog | `README.md` (What's new) |
| Prod build | `webpack.config.js`, `.env` / `PROD_OAUTH_CLIENT_ID` |
| Hosted picker | `picker/index.html`, `picker/picker.js` (GitHub Pages) |
| CI release | `.github/workflows/release.yml` |

## Git safety (agent)

- Do **not** `git push --force` to `master`.
- Do **not** amend commits already pushed to the shared PR branch unless user explicitly asks.
- Create commits only when the user asks; for this workflow, opening the PR may imply permission to commit on the release branch.
- Use `gh` for GitHub PR operations per user rules.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Committed to `master` | Move commits to `vX.Y.Z` branch via cherry-pick or reset (user approval) |
| Version only in manifest | Sync `package.json`; CI fails on mismatch |
| Opened second PR for same release | Close duplicate; push to original branch |
| Changed `picker/` but only reloaded extension | Push `master` / Pages deploy for hosted picker |
| Unpacked ID ≠ picker `ext` | Use Pick from Settings (passes `chrome.runtime.id`) or add manifest `key` ([Deploy.md §8](../../../Deploy.md)) |

## Reference

Full operator guide: [Deploy.md](../../../Deploy.md) — sections 3 (local dev), 5 (prod build), 7 (CWS update), 7.5 (Actions), 8 (`key`), 9 (troubleshooting), 10 (pre-submission).
