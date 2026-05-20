# Disabled workflows (parked from MCSTranscriptViewer import)

These workflow files were copied wholesale from the original
[`rafalcaraz/MCSTranscriptViewer`](https://github.com/rafalcaraz/MCSTranscriptViewer)
repo when it was folded into this monorepo. They are **intentionally inactive**
— GitHub Actions only scans `.github/workflows/*.yml`, so anything in this
folder will never run.

> `release.yml` is no longer parked — it's been refactored for the shared
> `MCSHelperCodeApps` solution and lives at [`.github/workflows/release.yml`](../workflows/release.yml).

## Why parked?

In the source repo, these workflows assumed a single-app layout (run from the
repo root). To live in `.github/workflows/` here they need:

- `defaults.run.working-directory: <app>` (or per-step) — each is per-app
- `on.push.paths: ['<app>/**', '.github/workflows/<app>-*.yml']`
  so the other app's changes don't trigger them
- Renaming to `<app>-<purpose>.yml` for clarity once there are several
  per-app workflows side-by-side

`dependabot.yml` is here for the same reason — it has to live at exactly
`.github/dependabot.yml` to be active, and the version in the source repo only
watched a single root `package.json`. Replacement should enumerate both
`/AgentEvalsViewer` and `/MCSTranscriptViewer`.

## What's here

| File             | Purpose in source repo                                  |
|------------------|---------------------------------------------------------|
| `ci.yml`         | Lint + Vitest on push/PR                                |
| `e2e.yml`        | Playwright e2e (smoke / stress / rbac) on schedule + PR |
| `codeql.yml`     | CodeQL security analysis                                |
| `dependabot.yml` | npm dependency updates                                  |

## Activating

When ready to wire them in:

1. Refactor for monorepo (path filters + working-directory + per-app name).
2. Move (or rename + copy) the `.yml` into `.github/workflows/`.
3. For `dependabot.yml`, replace with a new `.github/dependabot.yml` that
   lists both apps under `package-ecosystem: npm`.
4. Delete the parked copy from this folder.

The just-activated `release.yml` is intentionally **shared** (not per-app)
because the underlying Dataverse solution is shared — see its
[workflow file](../workflows/release.yml) for the pattern.
