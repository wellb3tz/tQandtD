# Release Checklist

Use this checklist before publishing a package version.

## Required

- Run `npm run verify:release`.
- Confirm `npm run build:verify` reports the expected public exports.
- Run `npm run verify:package` after a fresh build.
- Review `CHANGELOG.md` for the target version.
- Confirm `package.json` version matches the changelog entry.

## Optional

- Run `npm pack --dry-run` when the local npm cache is writable.
- Inspect the interactive app manually if viewer behavior changed.
- Capture a browser screenshot for UI-facing changes.

## Package Scope

The npm package includes:

- `dist`
- public `docs/*.md`
- `examples`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`

Historical planning files under `docs/superpowers` are intentionally excluded.
