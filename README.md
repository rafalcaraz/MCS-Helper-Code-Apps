# MCS Helper Code Apps

A growing collection of **Power Apps Code Apps** that fill gaps in the Copilot Studio (MCS) maker experience — built for makers, admins, and engineers who need to look deeper than the built-in portal lets them.

Each app in this repo is:

- A standalone **Power Apps Code App** (React 19 + TypeScript + Vite; UI layer varies per app — Fluent UI v9 or plain CSS)
- Independently deployable (`pac code push` from the app's own folder)
- Focused on a single hard-to-do thing the Copilot Studio portal doesn't make easy

---

## Apps in this repo

### 📊 [AgentEvalsViewer](./AgentEvalsViewer)

A trend-and-triage dashboard for Copilot Studio **agent evaluations**.

The built-in evaluation experience shows you the latest run's pass rate — and not much else. AgentEvalsViewer wires those runs together over time so you can:

- See pass-rate trends per agent, per test set, per metric
- Get nudged when scheduled evaluation runs go silent (heartbeat / cadence detection)
- Triage regressions with a *"did I change something or did the world?"* panel that uses **ground-truth** snapshot↔run linkage (no temporal guessing)
- Drop the snapshot ZIPs Copilot Studio gives you straight in, get structured diffs between any two
- Surface stale test sets, owner attribution, and leaderboards across all your tracked agents

Built around a hard rule: **only ground-truth attribution.** When data isn't there to prove a claim, the UI doesn't make one.

### 📝 [MCSTranscriptViewer](./MCSTranscriptViewer)

A debug-first viewer for Copilot Studio **conversation transcripts** — server-side filtered (date / content / agent / user), AAD-resolved, with full agent-internals visibility (tool calls, knowledge searches, connected-agent hand-offs).

Built for makers, admins, and support engineers who need to debug *someone else's* conversation — not just their own — and want to see *why* the agent did what it did, not just *what* it said.

Highlights:

- Pulls directly from the `conversationtranscript` Dataverse table
- Two-pane debug layout: chat timeline on the right, agent thinking / tool calls / knowledge searches on the left
- Per-bubble agent attribution for multi-agent flows (color-coded chips)
- Cross-environment "Browse via Flows" mode (Preview) — one deployed app, many environments via Power Automate
- Adaptive card rendering, AAD user resolution, redacted-content (🔒) recovery
- Ships with the paired Power Platform `solution/` (custom actions + flows) and Playwright e2e coverage

Previously shipped as a separate repo at [rafalcaraz/MCSTranscriptViewer](https://github.com/rafalcaraz/MCSTranscriptViewer); folded in here. Long-form references (backlog, knowledge, transcript-pattern catalog) live under [`MCSTranscriptViewer/docs/`](./MCSTranscriptViewer/docs).

---

## Repo layout

```
MCS-Helper-Code-Apps/
├── AgentEvalsViewer/           # Eval-runs dashboard (Power Apps Code App)
├── MCSTranscriptViewer/        # Conversation transcript viewer (Power Apps Code App)
│   ├── docs/                   # BACKLOG, KNOWLEDGE, TRANSCRIPT-PATTERNS deep references
│   ├── e2e/                    # Playwright suites
│   ├── scripts/                # App-local helpers (e2e CI auth encoding)
│   └── ...                     # src, public, configs
├── solution/                   # Shared Power Platform solution — both apps ship together
│   │                           # as MCSHelperCodeApps. See solution/README.md.
│   ├── src/                    # Unpacked solution (flows, customizations, code app stubs)
│   └── out/                    # (gitignored) Packed solution zips
├── scripts/                    # Shared solution tooling
│   ├── pack-solution.mjs       # Builds both apps + packs the shared solution zip
│   └── pull-solution.mjs       # Re-syncs solution/src/ from Dataverse
├── .github/
│   ├── workflows/              # Active workflows (release.yml for the shared solution)
│   └── workflows-disabled/     # Per-app CI/E2E/CodeQL/Dependabot — parked pending
│                               # monorepo refactor. GitHub Actions only scans
│                               # .github/workflows/, so these are inert.
├── README.md                   # ← you are here
└── .gitignore                  # Monorepo defaults
```

Each app folder is self-contained for development — its own `package.json`, `power.config.json`, `node_modules/`, build output, and README. The **`solution/` and `scripts/` folders at the root are shared** between apps because the Dataverse solution (`MCSHelperCodeApps`) wraps both code apps as one releasable unit. There is intentionally **no root-level `package.json`** — the shared scripts are run via `node scripts/<name>.mjs` directly; if cross-app shared *code* becomes valuable, we'll add a workspace then.

## Getting started with an app

Pick the app you want, then from its folder:

```powershell
cd AgentEvalsViewer    # or: cd MCSTranscriptViewer
npm install
npm run dev
```

For Power Apps deployment instructions, see the individual app's README and the [shared `solution/README.md`](./solution/README.md).

## Shared solution

Both apps are packaged into a single Power Platform solution, `MCSHelperCodeApps`, and released together. See [`solution/README.md`](./solution/README.md) for:

- How to pull cloud changes back into git (`node scripts/pull-solution.mjs`)
- How to build a self-contained release zip from source (`node scripts/pack-solution.mjs [--managed]`)
- How the [release workflow](./.github/workflows/release.yml) ships managed zips to GitHub Releases

## Contributing / philosophy

Each app here exists because the Copilot Studio portal hides or under-serves something a real maker needs. Guiding principles:

- **Surface ground truth, not inferences.** If we can't prove a claim from data, we don't render UI that makes the claim.
- **Don't pre-commit makers to conventions.** New product surfaces shouldn't require renaming things in the portal first.
- **Cheap to add, cheap to remove.** Each app stands alone; no app should make another harder to maintain.

---

*Maintained by [@rafalcaraz](https://github.com/rafalcaraz). Built with [Power Apps Code Apps](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/code-apps/overview), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), and [Vite](https://vite.dev/).*
