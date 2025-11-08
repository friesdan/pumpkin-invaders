# Repository Guidelines

## Project Structure & Module Organization
The root hosts three playable entry points: `index.html` (desktop), `index-mobile.html`, and `index-arella.html` for experimental builds. Core gameplay lives in `game.js`, while `game-mobile*.js` variants tweak controls and balance for touch. Visual assets stay under `screenshots/`, and every in-progress experiment should land in `claude-enhancements/` or `backups/` before replacing a production file so we can roll back quickly.

## Build, Test, and Development Commands
This project is framework-free; run it locally by opening `index.html` in any modern browser or by serving the folder with `python3 -m http.server 8000` to test mobile redirects. When adjusting the mobile build, point your device at `http://<ip>:8000/index-mobile.html`. Use `git status` before switching variants so you do not mix desktop and mobile changes in a single patch.

## Coding Style & Naming Conventions
Stick to 4-space indentation, single quotes, and `const`/`let` scoped near their usage (see `game.js` top-level state block). Keep constants uppercase (`WIDTH`, `HEIGHT`), exported helpers camelCase, and DOM ids descriptive (`gameCanvas`). Inline comments should describe intent (“// Tracks cooldown after pierce expires”), not mechanics. There is no formatter in repo, so run `npx prettier --write "*.js"` locally only if you can keep diffs focused.

## Testing Guidelines
No automated harness exists yet; rely on manual smoke tests. After each gameplay change: 1) load `index.html`, clear caches, and play through the first two waves to confirm progressive pumpkin carving, combo counters, and sound toggles; 2) if touch logic changed, repeat with `index-mobile.html` on a device or simulator; 3) capture regressions with `screenshots/` updates when UI shifts. Document edge cases (boss logic, shields, power-ups) in your PR description until we add coverage.

## Commit & Pull Request Guidelines
Follow the terse, imperative subject style already in history (“Fix boss level skipping...”). Keep the first line ≤72 chars, add wrapped body bullets only when explaining behavioral risks or test instructions. Every PR should include: summary of affected files, manual test notes, linked issue/ticket, and screenshots or GIFs when UI shifts. Draft PRs are welcome—use them to discuss balancing or asset changes before touching `game.js`. Always mention which HTML entry point you validated.
