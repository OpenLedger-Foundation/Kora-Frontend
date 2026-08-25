# Design System

The Kora frontend uses a semantic, token-based design system built on Tailwind CSS, CSS custom properties, and Radix UI primitives.

## Source of truth

| Layer | Location |
| ----- | -------- |
| CSS tokens | `app/globals.css` (`:root` and `.dark` blocks) |
| Tailwind mapping | `tailwind.config.ts` |
| UI primitives | `components/ui/` |
| Domain components | `components/invoice/`, `components/wallet/`, etc. |

## Theming

- **Dark-mode-first** with light mode via the `class` strategy (`darkMode: ["class"]` in Tailwind).
- Theme switching is handled by `next-themes`; an inline script in `app/layout.tsx` prevents FOUC on first load.
- Color tokens are defined as **HSL components** (e.g. `--color-primary: 174 72% 40%`) and consumed as `hsl(var(--primary))` in Tailwind.

## Token categories

### Color

Semantic tokens in `globals.css`:

- **Brand:** `--color-primary`, `--color-accent`
- **Surfaces:** `--color-surface`, `--color-surface-elevated`, `--color-surface-muted`
- **Text:** `--color-text`, `--color-text-muted`, `--color-text-subtle`
- **Feedback:** `--color-success`, `--color-warning`, `--color-destructive`, `--color-info`

Legacy shadcn-compatible aliases (`--background`, `--foreground`, `--card`, etc.) map to the semantic tokens for compatibility with existing UI components.

### Spacing & typography

Spacing scale (`--space-1` … `--space-12`) and font sizes (`--font-size-xs` … `--font-size-3xl`) are defined in `globals.css` and referenced where needed for consistent rhythm.

## UI primitives

Reusable building blocks live under `components/ui/`:

- Form controls: `button`, `input`, `select`, `textarea`, `number-input`
- Layout: `card`, `dialog`, `bottom-sheet`, `container`
- Feedback: `badge`, `progress`, `skeleton`, `error-boundary`
- Data display: `data-table`, `pagination`, `stat-card`

Prefer composing these primitives over one-off styles. Use `cn()` from `lib/utils` for conditional class merging.

## Storybook

Component stories live alongside components as `*.stories.tsx` files. Run Storybook locally when iterating on visual states (see `CONTRIBUTING.md`).

## Adding new tokens

1. Add the CSS variable to `:root` and `.dark` in `app/globals.css`.
2. Map it in `tailwind.config.ts` under `theme.extend`.
3. Use the Tailwind utility in components — avoid hard-coded hex values in feature code.
