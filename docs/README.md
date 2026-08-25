# Kora Frontend — Documentation

Project documentation lives here. GitHub-specific files (`CONTRIBUTING.md`, `SECURITY.md`, root `CHANGELOG.md`) stay at the repo root so tooling and policies resolve correctly.

## Guides

| Document | Description |
| -------- | ----------- |
| [Architecture](./architecture.md) | Layer breakdown, data flow, wallet/contract/IPFS integration |
| [Design System](./design-system.md) | Semantic tokens, theming, and UI primitives |

## Repository docs (root)

| Document | Description |
| -------- | ----------- |
| [README](../README.md) | Overview, setup, and project structure |
| [Contributing](../CONTRIBUTING.md) | Dev workflow, testing, and PR guidelines |
| [Security](../SECURITY.md) | Vulnerability reporting policy |
| [Changelog](../CHANGELOG.md) | Auto-generated release history (semantic-release) |

## Changelog files

This repo intentionally keeps two changelog files:

- **`CHANGELOG.md` (root)** — semantic-release output for GitHub releases and version bumps.
- **`public/CHANGELOG.md`** — Keep a Changelog format served at `/CHANGELOG.md` for the in-app changelog modal.

When adding user-visible release notes for the app UI, update `public/CHANGELOG.md`. Release tooling manages the root file.
