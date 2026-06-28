# Contributing to Kora Protocol

Thank you for your interest in contributing to Kora Protocol! This document explains how to get involved, what we expect from contributors, and how to submit high-quality work.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Branch Strategy](#branch-strategy)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)
- [Issue Labels](#issue-labels)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/). By participating, you agree to uphold a welcoming, respectful, and harassment-free environment for everyone.

---

## Ways to Contribute

| Type | Description |
|------|-------------|
| 🐛 Bug reports | Open an issue with reproduction steps |
| 💡 Feature requests | Open an issue with the `enhancement` label |
| 📖 Documentation | Fix typos, improve clarity, add examples |
| 🔧 Code | Fix bugs, implement features, improve performance |
| 🎨 Design | Improve UI/UX, accessibility, responsiveness |
| 🧪 Tests | Add unit, integration, or E2E tests |
| 🌍 Translations | Help localise the interface |

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Git
- [Freighter wallet](https://freighter.app) (for testing wallet flows)

### Steps

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/<your-username>/kora-frontend.git
cd kora-frontend

# 3. Add the upstream remote
git remote add upstream https://github.com/kora-protocol/kora-frontend.git

# 4. Install dependencies
npm install

# 5. Copy environment variables
cp .env.example .env.local
# Fill in values — mock data mode works without any real keys

# 6. Start the dev server
npm run dev
```

---

## Branch Strategy

We use a simplified **GitHub Flow**:

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code. Protected. |
| `develop` | Integration branch for features. |
| `feat/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation changes |
| `chore/<name>` | Tooling, deps, config |

**Always branch from `develop`**, not `main`.

```bash
git checkout develop
git pull upstream develop
git checkout -b feat/my-feature
```

---

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code restructure, no feature/fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build process, dependencies |
| `ci` | CI/CD changes |

### Examples

```
feat(marketplace): add APR range filter
fix(wallet): handle Freighter connection timeout
docs(readme): update environment variable table
chore(deps): upgrade stellar-sdk to 12.3.0
```

---

## Pull Request Process

1. **Keep PRs focused** — one feature or fix per PR. Large PRs are hard to review.

2. **Fill in the PR template** — describe what changed, why, and how to test it.

3. **Link related issues** — use `Closes #123` in the PR description.

4. **Pass all checks** — CI must be green before review:
   - `npm run type-check` — no TypeScript errors
   - `npm run lint` — no ESLint errors
   - `npm run build` — production build succeeds

5. **Request review** — tag at least one maintainer.

6. **Address feedback** — respond to all review comments. Mark resolved threads.

7. **Squash on merge** — maintainers will squash commits when merging.

### PR Title Format

Follow the same convention as commits:

```
feat(analytics): add monthly yield breakdown chart
fix(invoice-detail): correct expected return calculation
```

---

## Code Style

### TypeScript

- Strict mode is enabled. No `any` unless absolutely necessary — use `unknown` and narrow.
- Prefer `interface` for object shapes, `type` for unions/intersections.
- Export types from `types/` — don't define domain types inline in components.

### React

- Use functional components and hooks only.
- Keep components small and single-purpose. Extract logic into hooks.
- Use `"use client"` only when necessary (interactivity, browser APIs).
- Prefer server components for data-fetching pages where possible.

### Styling

- Use Tailwind utility classes. Avoid inline styles.
- Use the `cn()` utility from `lib/utils.ts` for conditional classes.
- Follow the existing dark-mode-first design system.
- Don't introduce new colour values — use the `kora-*` and `zinc-*` palette.

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Pages | `page.tsx` | `app/marketplace/page.tsx` |
| Components | PascalCase | `InvoiceCard.tsx` |
| Hooks | camelCase with `use` prefix | `useWallet.ts` |
| Utilities | camelCase | `utils.ts` |
| Types | camelCase | `invoice.ts` |

---

## Testing

> Testing infrastructure is being set up. See [#42](https://github.com/kora-protocol/kora-frontend/issues/42).

When tests are available:

```bash
npm run test          # unit tests
npm run test:e2e      # end-to-end tests
npm run test:coverage # coverage report
```

**What to test:**
- Utility functions in `lib/utils.ts`
- Zustand store actions
- Service layer functions (with mocked fetch)
- Critical UI flows (wallet connect, fund invoice)

---

## Issue Labels

| Label | Meaning |
|-------|---------|
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |
| `good first issue` | Suitable for first-time contributors |
| `help wanted` | Maintainers want community input |
| `documentation` | Docs-only change |
| `wontfix` | Out of scope or intentional |
| `duplicate` | Already reported |
| `blocked` | Waiting on external dependency |

---

## Getting Help

- **Discord:** [discord.gg/kora-protocol](https://discord.gg/kora-protocol) *(coming soon)*
- **GitHub Discussions:** Use the Discussions tab for questions
- **Issues:** For bugs and feature requests only

---

Thank you for helping build the future of invoice financing on Stellar! 🚀
