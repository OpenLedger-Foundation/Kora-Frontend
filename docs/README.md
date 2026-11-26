# Kora Frontend — Documentation

Project documentation lives here. GitHub-facing files (`CONTRIBUTING.md`, `SECURITY.md`, root `CHANGELOG.md`) stay at the repo root so tooling and policies resolve correctly.

## Guides

| Document                                  | Description                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- |
| [Architecture](./architecture.md)         | Layer breakdown, data flow, wallet/contract/IPFS, Redis migration   |
| [Design System](./design-system.md)       | Semantic tokens, theming, and UI primitives                          |
| [Feature Flags](./feature-flags.md)       | All `NEXT_PUBLIC_ENABLE_*` flags, defaults, and local override paths |
| [Debtor Privacy](./debtor-privacy.md)     | Debtor display rules and privacy constraints                         |
| [Analytics Events](./analytics-events.md) | Marketplace analytics event schema (no PII)                          |
| [Testnet Nightly E2E](./testnet-nightly-e2e.md) | Opt-in live-testnet suites, real Freighter extension, CI secrets |

## Behavior notes

### Maturity reminder quiet hours

Maturity reminders respect a per-user quiet-hours window stored in
`store/settingsStore.ts` and consumed by `hooks/useMaturityReminder.ts`. When
the current local time falls inside the window, reminders are deferred until
the window ends instead of being delivered overnight. The preference is
opt-in: with no stored value (or an invalid one) the hook falls back to
"quiet hours disabled", so reminders behave exactly as before.

### Invoice illegal-transition support codes

`lib/invoiceStateMachine.ts` rejects illegal state transitions with a stable
support code (e.g. `INV-TRANSITION-<from>-<to>`). The invoice UI surfaces the
code in the error toast so support can trace a report back to a specific
transition. Codes are stable identifiers, not user copy — the surrounding
message is localized in `messages/` (en/es/pt-BR).

### Open-redirect e2e corpus

`e2e/connect-wallet-intended-destination.spec.ts` covers the corpus of
intended-destination values that must never be honored after connecting a
wallet (absolute URLs, protocol-relative, encoded, backslash, whitespace and
control-character variants). Add new vectors to the corpus table rather than
writing one-off tests so the suite stays exhaustive.

## New environment flags

Any flag introduced alongside the behavior notes above must be documented in
[Feature Flags](./feature-flags.md) with its safe default. Current additions:

| Flag | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_ENABLE_MATURITY_REMINDER_QUIET_HOURS` | `false` | Enables the quiet-hours preference UI and deferral logic for maturity reminders. When unset or `false`, reminders ignore quiet hours. |
| `NEXT_PUBLIC_ENABLE_INVOICE_TRANSITION_SUPPORT_CODES` | `true` | Shows the stable support code in the illegal-transition toast. Defaults to on; setting `false` hides the code but keeps the localized message. |

Both flags are read at build time via `NEXT_PUBLIC_*` and default to the safe
value when missing, so a misconfigured environment degrades to existing
behavior rather than breaking reminders or invoice actions.

## Repository docs (root)

| Document                           | Description                                       |
| ---------------------------------- | ------------------------------------------------- |
| [README](../README.md)             | Overview, setup, and project structure            |
| [Contributing](../CONTRIBUTING.md) | Setup, workflow, testing, and PR checklist        |
| [Security](../SECURITY.md)         | Vulnerability reporting policy                    |
| [Changelog](../CHANGELOG.md)       | Auto-generated release history (semantic-release) |

## Changelog files

This repo intentionally keeps two changelog files:

- **`CHANGELOG.md` (root)** — semantic-release output for GitHub releases and version bumps.
- **`public/CHANGELOG.md`** — Keep a Changelog format served at `/CHANGELOG.md` for the in-app changelog modal.

When adding user-visible release notes for the app UI, update `public/CHANGELOG.md`. Release tooling manages the root file.

### Which file do I edit?

| Your change | Edit `public/CHANGELOG.md` | Edit root `CHANGELOG.md` |
|---|---|---|
| Users will notice it in the app | ✅ | ❌ never by hand |
| Refactor, test, CI, or docs only | ❌ | ❌ |
| Anything at all | — | ❌ semantic-release writes it |

The root file is generated from commit messages on every release. Editing it by
hand is not "also updating the changelog" — it is a conflict waiting for the
next release commit to overwrite it. Write a good Conventional Commit message
instead; that *is* how you edit the root changelog.

### Worked example

You added a CSV export button to the investor dashboard. Users will see it, so
it belongs in `public/CHANGELOG.md` under `[Unreleased]`.

**Before:**

```markdown
## [Unreleased]

### Added
- Command palette (Cmd/Ctrl+K) with invoice search, page navigation, and action commands.
```

**After:**

```markdown
## [Unreleased]

### Added
- Command palette (Cmd/Ctrl+K) with invoice search, page navigation, and action commands.
- Export investor positions to CSV from the dashboard toolbar.
```

Then commit with a Conventional Commit message:

```
feat(dashboard): export investor positions to CSV
```

That commit line is what semantic-release turns into the root `CHANGELOG.md`
entry at the next release. You never touch that file.

Notes on the entry itself:

- Write what the user can now do, not what you implemented. "Export investor
  positions to CSV" beats "Add `useCsvExport` hook".
- Add it under `[Unreleased]`, not under a released version heading — released
  sections are history and editing them rewrites what shipped.
- Use the Keep a Changelog headings: `Added`, `Changed`, `Deprecated`,
  `Removed`, `Fixed`, `Security`. Create the heading if `[Unreleased]` does not
  have it yet.

**Counter-example.** You split a 400-line component into three files and the UI
is pixel-identical. Nothing goes in `public/CHANGELOG.md` — there is nothing a
user could notice. `refactor(marketplace): split InvoiceCard into subcomponents`
is the whole deliverable.
