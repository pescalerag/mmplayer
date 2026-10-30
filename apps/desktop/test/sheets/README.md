# Desktop sheet integration audit

Run `npm run test:sheets --workspace=@mmplayer/desktop` from the repository root.

This opens the real Electron renderer with a fresh profile under
`.tmp/desktop-sheets/<run>/profile` and copies of the MP3/FLAC fixtures. It injects
the driver into the test build through a Vite plugin; normal builds contain no
audit bridge. Application source files are not rewritten by the test runner.

The driver opens all 29 registered sheet types and exercises controls in their
rendered DOM. Speed, pitch and Gesture Handler controls use Electron mouse input.
File selectors receive deterministic `File` objects through Chromium's
`DataTransfer`; services, parsers, SQLite, audio engine state and metadata writes
are real. Destructive cases use disposable database entities. Clipboard contents
are restored after the audit.

Each case records `pass`, `fail` or `unverified`. Opening a nested sheet validates
that transition, not every operation offered by its destination. External
availability checks are distinct from successful file sharing. Network searches
without deterministic provider results remain explicitly unverified.

Artifacts: `report.json`, `report.md`, `console.log`, failure screenshots and
`final.png`. The process exits with code 1 if any case fails. Test-only root
recovery prevents a crashed screen from making subsequent cases fail in cascade.

Run `npm run desktop:build` afterwards to restore a normal production build.
