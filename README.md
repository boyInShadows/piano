# Qazal's Piano

A browser piano based on a restrained polished-black acoustic instrument. V1 scope is free play, sustain, a metronome, and recording/replay saved in this browser. The owner name is fixed in V1.

The JavaScript application foundation is complete on `development`. The temporary page confirms server rendering and client interactivity. The playable instrument, audio, and recordings are the next implementation tasks.

## Run and verify

Use Node.js 24 LTS and npm. Verified locally with Node 24.11.1 and npm 11.6.2. Dependencies are pinned in `package-lock.json`: Next.js 16.4.3 and React 19.3.1.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables or external services are required for this foundation.

```sh
npx playwright install msedge
npm run check
npm run test:dev
```

The browser tests use installed Microsoft Edge (Chromium). Skip the browser-install command if Edge is already installed, as on this PC. `check` runs lint, the production build, and the browser smoke test. `test:dev` verifies the development server separately. The test starts and stops its own server on port 3100 and checks server-rendered content, client interaction, console errors, and narrow-screen overflow. Reports and screenshots stay local under `docs/artifacts/playwright-report/` and `docs/artifacts/test-results/`. No additional browser was downloaded here. A different browser channel can be selected in `playwright.config.js` when expanding browser coverage.

For a production preview, run `npm run build` followed by `npm start`. This is a local preview, not a public deployment.

The foundation follows the official [Next installation](https://nextjs.org/docs/app/getting-started/installation) and [server/client boundary](https://nextjs.org/docs/app/getting-started/server-and-client-components) guidance. The intended browser baseline is Chrome/Edge 111+, Firefox 111+, and Safari 16.4+; only the foundation smoke journey has been tested in local Edge. Physical iPhone/Android, Chrome, Firefox, Safari, sound, touch playing, and recording acceptance remain open.

## Development rules

- Use JavaScript, React, and Next.js App Router with its standard Node server.
- Keep code readable and focused. Reuse existing code, use clear names, separate browser audio/input/storage from presentation, and avoid speculative abstractions or dependencies.
- Add meaningful checks for nontrivial behavior and run the checks relevant to each task.
- Commit each verified task on `development`; push `development` at each completed phase. The initial repository setup lives on `main`. Merge to `main` only when requested.
- Update the local `docs/changeLogs.md` and `docs/pending.md` after every task, including evidence and unresolved issues.
- Keep the root focused: documentation/research in `docs/`, tests in `tests/`, generated evidence in `docs/artifacts/`, and application code under `src/` by responsibility.
- Only this root README is tracked among Markdown files. Project instructions, planning documents, task logs, design concepts, generated graphs, and machine-specific skill links stay local.

## Local project context

```text
src/app/             Routes, root layout, global styles and app icon
src/components/      Interface components
src/lib/             Piano configuration and shared logic
tests/e2e/           Browser journeys
docs/                Local plans, task logs and product/design context
docs/design-concepts/ Local visual research
docs/artifacts/      Local logs, screenshots, browser reports and graphs
```

The local `docs/masterPlan.md` and `docs/astraTasks.md` contain Astra's specification and acceptance criteria. `docs/pending.md` tracks execution; `AGENTS.md` contains persistent project rules. Shared tools from `D:\coding\Tools` are linked for Codex and Claude through `D:\tools\agents-shared\skills`. Root agent instructions and tool configuration stay where their runtimes discover them.

codebase-memory indexes the project for structural lookup. The initial source-only Graphify snapshot is kept in local `docs/artifacts/graphify/` with JSON, HTML, report, and health evidence. Its AST graph has one unresolved stylesheet import because CSS is outside extraction coverage; inspect CSS directly. Ignored local plans and task logs must be backed up separately because Git does not include them. The file-move inventory is `docs/artifacts/structure-move-inventory.json`.

Working defaults are a landscape-first phone keyboard with an accessible compact fallback, an adaptive desktop note range, English copy, one licensed grand-piano sound, and local recordings. Accounts, cloud sync, downloadable audio, lessons, MIDI, and name editing are deferred.

Recordings will belong to the current browser and origin; clearing site data can remove them. Mobile readiness requires real iPhone Safari and Android Chrome testing.
