# Qazal's Piano

A browser piano based on a restrained polished-black acoustic instrument. V1 scope is free play, sustain, a metronome, and recording/replay saved in this browser. The owner name is fixed in V1.

The piano fills the browser viewport with polished-black cabinetry, beveled ivory and black DOM keys, red felt and the fixed brass inscription. The ready view contains the instrument, octave arrows and one Settings gear. Sampled A0–C8 notes, physical-keyboard chords, mouse/pen/touch input, glissando, sustain, volume/mute, metronome, preferences and browser-local recording/replay are playable on `development`. Narrow touch phones offer rotation guidance and a compact fallback; short landscape compresses the cabinet while preserving usable keys.

Choose **Enable sound**, then click/touch the keys or focus the piano and use physical US-position shortcuts `A W S E D F T G Y H U J K O L P ;`. Hold Space for momentary sustain, use Latch sustain for a held pedal, and press Escape or Stop all to clear notes. Arrow keys move focus between piano keys; Enter auditions the focused note. Range changes, blur, hidden pages and audio interruptions clear ownership so old notes cannot restart automatically.

Open the **Settings gear** for Controls, Recordings and Help. Controls includes volume, mute, labels, sustain, metronome/tempo, Record/Stop recording and Stop all. Starting a recording or replay closes the panel; open the gear again to stop it. Save, replay or discard a finalized draft in Recordings. Close the panel with its X, Escape or a tap outside. It overlays the piano without resizing keys and scrolls independently on short screens; browsers without native popovers use a dismissible fallback.

On a portrait phone, choose **Use compact keyboard** if you cannot rotate. It keeps seven white-key targets per ordinary octave and still reaches A0–C8. Landscape restores the larger range; returning to portrait remembers your choice until reload. If minimum key sizes cannot fit, the app explains how to make room and keeps Settings available. Opening Settings releases held live notes and both pedal states while preserving running recording, replay and metronome so their controls remain accessible.

After enabling sound, open Controls, switch **Metronome** on and adjust **Tempo** from 40 to 240 BPM (default 90). Four quiet numbered marks indicate the beat, with a higher click on beat one. Mute silences the piano and click while preserving the running beat. Stop all, Help/Recordings navigation, range/layout changes, blur and audio interruptions stop transport; returning never restarts it automatically.

Volume, note/shortcut hints and BPM persist in this browser when storage permits. Sound activation, mute, sustain, running metronome and held notes reset on reload. Invalid saved values use safe defaults; blocked storage keeps session changes and shows a warning in Settings.

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

The browser tests use installed Microsoft Edge (Chromium). Skip the browser-install command if Edge is already installed, as on this PC. `check` runs lint, the production build, 42 unit tests and 40 production browser journeys; `test:unit` and `test:browser` run those suites separately, while `test:dev` verifies the development server. Journeys use one worker so real audio-clock and performance measurements do not compete with other tests. Run the suites sequentially with source unchanged: both browser runners own port 3217 and the same output directory. Coverage includes SSR/hydration, native/fallback Settings dismissal and focus, full-page geometry, source ownership, native pointer capture, emulated touch/pen, activation/retry/resume, measured audio signal, all-register source dispatch, portrait fallback, repeated rotation, zoom/enlarged text, metronome timing/mute/cleanup, preference/storage recovery, local recording/replay and a desktop performance baseline. Reports and screenshots stay local under `docs/artifacts/playwright-report/` and `docs/artifacts/test-results/`. No additional browser was downloaded here. A different browser channel can be selected in `playwright.config.js` when expanding browser coverage.

For a production preview, run `npm run build` followed by `npm start`. This is a local preview, not a public deployment.

For phone-speaker testing with scrcpy, launch the mirror with `scrcpy --no-audio`. Its default audio mode redirects device playback to the computer and adds buffering; see the [scrcpy audio documentation](https://github.com/Genymobile/scrcpy/blob/master/doc/audio.md). Check both the phone's media volume and the piano's Settings volume when evaluating loudness. Browser-reported output latency and input-dispatch timing are diagnostic measurements, not an acoustic touch-to-speaker measurement.

### Production deployment handoff

Use a normal HTTPS-capable Node host with Node 24 LTS and the committed `package-lock.json`:

```sh
npm ci
npm run build
npm start -- --hostname 0.0.0.0 --port 3000
```

Put the Next server behind the host's HTTPS reverse proxy. V1 needs no environment variables or separate backend. Preserve the same browser origin for IndexedDB recordings and local preferences, serve `/audio/piano/salamander-v1/` unchanged, and verify metadata, sample paths/cache headers, first sound activation, storage, errors and responsive layout on the chosen host. No public host, domain or deployment credentials are selected or authorized yet.

The foundation follows the official [Next installation](https://nextjs.org/docs/app/getting-started/installation) and [server/client boundary](https://nextjs.org/docs/app/getting-started/server-and-client-components) guidance, including the guides bundled with the installed Next package. The intended browser baseline is Chrome/Edge 111+, Firefox 111+, and Safari 16.4+; automated runtime verification uses local Edge, including simulated absence of native popovers. Physical Android 14 / Chrome 153 was checked at 838×286 CSS pixels: the piano fits with 25 keys and no horizontal overflow; the user confirmed sound activation. Actual portrait rotation, independent finger releases, iPhone/Safari/Firefox, physical pen, speaker/headphone quality and output latency remain open. Emulated pointers and a nonzero browser audio signal do not prove those physical acceptance items.

## Piano sound

The self-hosted Grand Piano bank derives from **Salamander Grand Piano by Alexander Holm**, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), from the [pinned Tonejs/audio source](https://github.com/Tonejs/audio/tree/869b6f8d9cddb47d966238c012041480b1ce517a/salamander). The sound is not represented as a Yamaha CFX recording.

The curated bank selects 16 MP3s; files longer than 12 seconds are capped with a 100ms fade and re-encoded at ffmpeg/libmp3lame quality 3. Shorter files are unchanged. Stereo and sample rate are preserved. Transfer is 986,522 bytes, with a 55,327,120-byte decoded estimate. The bank manifest records files, hashes, sizes and transformations; full licence and upstream notice ship beside the audio under `public/audio/piano/salamander-v1/`. This versioned directory is immutable; changed banks require a new version path. Long held notes end naturally with their samples.

Tone 15.1.22 supplies the context clock, master gain and limiter; native buffer sources give explicit voice handles for the 64-voice policy. Tone.js is MIT licensed, copyright Yotam Mann; its notice ships in `public/licenses/tone.txt`. A single context is unlocked during the user's activation gesture. Samples and Tone code load on demand. Ordinary note scheduling uses the immediate audio time, without the default 100ms scheduling offset. Real output latency and physical mobile behavior remain unverified.

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
src/hooks/           Browser input ownership and lifecycle integration
tests/e2e/           Browser journeys
tests/unit/          Note-model checks using the Node test runner
docs/                Local plans, task logs and product/design context
docs/design-concepts/ Local visual research
docs/artifacts/      Local logs, screenshots, browser reports and graphs
```

The local `docs/masterPlan.md` and `docs/astraTasks.md` contain Astra's specification and acceptance criteria. `docs/pending.md` tracks execution; `AGENTS.md` contains persistent project rules. Shared tools from `D:\coding\Tools` are linked for Codex and Claude through `D:\tools\agents-shared\skills`. Root agent instructions and tool configuration stay where their runtimes discover them.

codebase-memory indexes the project for structural lookup. The initial source-only Graphify snapshot is kept in local `docs/artifacts/graphify/` with JSON, HTML, report, and health evidence. It covers T01 and is historical after the shell changes. Its AST graph has one unresolved stylesheet import because CSS is outside extraction coverage; inspect CSS directly. Ignored local plans and task logs must be backed up separately because Git does not include them. The file-move inventory is `docs/artifacts/structure-move-inventory.json`.

Working defaults are a landscape-first phone keyboard with an accessible compact fallback, an adaptive desktop note range, English copy, one licensed grand-piano sound, and local recordings. Accounts, cloud sync, downloadable audio, lessons, MIDI, and name editing are deferred.

Recordings will belong to the current browser and origin; clearing site data can remove them. Mobile readiness requires real iPhone Safari and Android Chrome testing.

The metronome uses [Tone Clock callback timestamps](https://tonejs.github.io/docs/15.1.22/classes/Clock.html) for scheduled sound; animation frames only read audio time for beat visuals. Client preferences follow [React’s external-store hydration contract](https://react.dev/reference/react/useSyncExternalStore) with a stable default server snapshot.
