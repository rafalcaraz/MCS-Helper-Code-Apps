# Disabled workflows (parked from MCSTranscriptViewer import)

These workflow files were copied wholesale from the original
[`rafalcaraz/MCSTranscriptViewer`](https://github.com/rafalcaraz/MCSTranscriptViewer)
repo when it was folded into this monorepo. They are **intentionally inactive**
— GitHub Actions only scans `.github/workflows/*.yml`, so anything in this
folder will never run.

## Why parked?

In the source repo, these workflows assumed a single-app layout (run from the
repo root). To live in `.github/workflows/` here they need:

- `defaults.run.working-directory: MCSTranscriptViewer` (or per-step)
- `on.push.paths: ['MCSTranscriptViewer/**', '.github/workflows/mcs-transcript-viewer-*.yml']`
  so AgentEvalsViewer changes don't trigger them
- A tag-prefix scheme for `release.yml` (e.g. `mcs-transcript-viewer-v*`) so
  app A's release doesn't fire app B's
- Renaming to `mcs-transcript-viewer-<purpose>.yml` for clarity alongside any
  future per-app workflows

`dependabot.yml` is here for the same reason — it has to live at exactly
`.github/dependabot.yml` to be active, and the version in the source repo only
watched a single root `package.json`. Replacement should enumerate both
`/AgentEvalsViewer` and `/MCSTranscriptViewer`.

## What's here

| File             | Purpose in source repo                                  |
|------------------|---------------------------------------------------------|
| `ci.yml`         | Lint + Vitest on push/PR                                |
| `e2e.yml`        | Playwright e2e (smoke / stress / rbac) on schedule + PR |
| `release.yml`    | Tag-driven solution pack + GitHub Release               |
| `codeql.yml`     | CodeQL security analysis                                |
| `dependabot.yml` | npm dependency updates                                  |

## Activating

When ready to wire them in:

1. Refactor for monorepo (path filters + working-directory + tag prefix).
2. Move (or rename + copy) the `.yml` into `.github/workflows/`.
3. For `dependabot.yml`, replace with a new `.github/dependabot.yml` that
   lists both apps.
4. Delete the parked copy from this folder.
