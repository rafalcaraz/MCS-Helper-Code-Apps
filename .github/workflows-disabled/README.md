# Disabled workflows (parked from MCSTranscriptViewer import)

These workflow files were copied wholesale from the original
[`rafalcaraz/MCSTranscriptViewer`](https://github.com/rafalcaraz/MCSTranscriptViewer)
repo when it was folded into this monorepo. Anything left in this folder is
**intentionally inactive** — GitHub Actions only scans `.github/workflows/*.yml`,
so files here will never run.

> Most of the originally-parked workflows have now been re-enabled as per-app
> workflows in [`.github/workflows/`](../workflows/). What remains here is just
> what's still waiting on dependencies before it can be wired in.

## What's still parked

| File       | Why it's still here                                                         |
|------------|-----------------------------------------------------------------------------|
| `e2e.yml`  | Playwright e2e only exists for `MCSTranscriptViewer`, and the saved auth state expires (typically 24h to a few weeks). Activating it requires per-app refactor *plus* a refresh process for the `PW_AUTH_*` secrets — see the file header for the dance. |

## Already re-activated

For reference, these were moved out and refactored for the monorepo:

| Originally parked | Now active as                                                                                                       |
|-------------------|---------------------------------------------------------------------------------------------------------------------|
| `ci.yml`          | [`mcstranscriptviewer-ci.yml`](../workflows/mcstranscriptviewer-ci.yml), [`agentevalsviewer-ci.yml`](../workflows/agentevalsviewer-ci.yml) |
| `codeql.yml`      | [`mcstranscriptviewer-codeql.yml`](../workflows/mcstranscriptviewer-codeql.yml), [`agentevalsviewer-codeql.yml`](../workflows/agentevalsviewer-codeql.yml) |
| `dependabot.yml`  | [`.github/dependabot.yml`](../dependabot.yml) (enumerates both apps + github-actions)                                |

## Activating what's left

When ready to wire `e2e.yml` in:

1. Refactor for monorepo: add `defaults.run.working-directory: MCSTranscriptViewer`,
   `on.push.paths: ['MCSTranscriptViewer/**', '.github/workflows/mcstranscriptviewer-e2e.yml']`,
   and a `cache-dependency-path: MCSTranscriptViewer/package-lock.json` on
   `setup-node`.
2. Rename to `mcstranscriptviewer-e2e.yml` and move into `.github/workflows/`.
3. Refresh the `PW_AUTH_ADMIN`, `PW_AUTH_LIMITED`, and `PW_E2E_ENV` secrets
   (see the workflow header for the exact commands).
4. Delete the parked copy from this folder.

The shared `release.yml` is intentionally **not** per-app because the
underlying Dataverse solution is shared — see
[its workflow file](../workflows/release.yml) for the pattern.
