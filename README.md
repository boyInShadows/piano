# Qazal's Piano

A browser piano based on a restrained polished-black acoustic instrument. V1 scope is free play, sustain, a metronome, and recording/replay saved in this browser. The owner name is fixed in V1.

Repository setup is complete; application implementation starts on `development`.

## Development rules

- Use JavaScript, React, and Next.js App Router with its standard Node server.
- Keep code readable and focused. Reuse existing code, use clear names, separate browser audio/input/storage from presentation, and avoid speculative abstractions or dependencies.
- Add meaningful checks for nontrivial behavior and run the checks relevant to each task.
- Commit each verified task on `development`; push `development` at each completed phase. The initial repository setup lives on `main`. Merge to `main` only when requested.
- Update the local `changeLogs.md` and `pending.md` after every task, including evidence and unresolved issues.
- Only this root README is tracked among Markdown files. Project instructions, planning documents, task logs, design concepts, generated graphs, and machine-specific skill links stay local.

## Local project context

The local `masterPlan.md` and `astraTasks.md` contain Astra's specification and acceptance criteria. `pending.md` tracks execution; `AGENTS.md` contains persistent project rules. Shared tools from `D:\coding\Tools` are linked for Codex and Claude through `D:\tools\agents-shared\skills`.

Working defaults are a landscape-first phone keyboard with an accessible compact fallback, an adaptive desktop note range, English copy, one licensed grand-piano sound, and local recordings. Accounts, cloud sync, downloadable audio, lessons, MIDI, and name editing are deferred.

Recordings will belong to the current browser and origin; clearing site data can remove them. Mobile readiness requires real iPhone Safari and Android Chrome testing.
