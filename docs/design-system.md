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
- The persisted preference (`light` / `dark` / `system`) lives in `uiStore`; an inline bootstrap script in `app/layout.tsx` applies the resolved class before first paint to prevent FOUC.
- `lib/theme.ts` is the **single source of truth** for theme resolution: `resolveTheme()` is shared by the inline bootstrap script (`THEME_INIT_SCRIPT`) and `components/layout/ThemeProvider.tsx`, so the pre-paint class and the hydrated class can never drift when the OS switches color scheme. A unit test executes the script and compares its result against `resolveTheme` for every preference/OS combination.
- Color tokens are defined as **HSL components** (e.g. `--color-primary: 174 72% 40%`) and consumed as `hsl(var(--primary))` in Tailwind.

### Browser chrome color (`themeColor`)

The mobile browser UI bar (and PWA title bar) follows the resolved theme via `THEME_COLORS` in `lib/theme.ts`:

| Token | Value | Surface |
| ----- | ----- | ------- |
| `THEME_COLORS.light` | `#ffffff` | white page background |
| `THEME_COLORS.dark` | `#09090b` | zinc-950 dashboard background |

- `app/layout.tsx` exports a media-scoped `viewport.themeColor` (via `buildViewportThemeColor()`) so the server-rendered `<meta name="theme-color">` tags match the OS preference before hydration.
- After hydration, `ThemeProvider` calls `applyBrowserThemeColor(resolved)`, which forces the resolved color onto every `theme-color` tag — this is what makes an in-app override (e.g. OS light + user-picked dark) win over the OS preference.
- The manifest's `theme_color` / `background_color` (built in `lib/pwa/manifest.ts`) use the same dark token so the PWA install splash stays consistent. Keep them in sync via `THEME_COLORS`.

### PWA manifest localization

The manifest is served by the `/manifest.json` route handler (`app/manifest.json/route.ts`), not a static file, so it renders for the active `kora-locale`:

- Shortcut **names** reuse the translated navbar labels (`nav.marketplace`, `nav.createInvoice`) so a shortcut's title matches its destination.
- Shortcut `short_name`, descriptions and screenshot labels come from the `pwa.manifest` message namespace; missing keys fall back to English.
- Shortcut URLs are **locale-agnostic** app paths (`/marketplace`, `/invoice/create`). The locale lives in the `kora-locale` cookie, never in the URL, so localized manifests must not ship locale-prefixed shortcut paths.

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

Reusable building blocks live under `components/ui/`. Every file in that folder is listed below with its purpose and when to use it. Prefer composing these primitives over one-off styles. Use `cn()` from `lib/utils` for conditional class merging.

### Form controls

| Primitive | File | Purpose | When to use |
| --------- | ---- | ------- | ----------- |
| `Button` | `button.tsx` | Primary CTA, secondary, ghost, danger variants with loading spinner, `asChild`, and `iconLabel` a11y support. | Any clickable action. Use `isLoading` for async submits; `iconLabel` for icon-only buttons. |
| `Input` | `input.tsx` | Text input with label, error, hint, and size variants. | Single-line text entry (debtor name, invoice number, search). |
| `Textarea` | `textarea.tsx` | Multi-line text with auto-resize, label, error, hint. | Description/memo, incident notes, long-form entry. |
| `NumberInput` | `number-input.tsx` | Numeric input with steppers, min/max, currency formatting. | Amount fields (invoice amount, min investment, funding amount). |
| `Select` | `select.tsx` | Custom select with grouped options, search, and Radix popover. | Jurisdiction, category, risk tier, status filters. |
| `DatePicker` | `date-picker.tsx` | Calendar popover (Radix Popover + date-fns), min/max clamping, keyboard nav, hidden `input` for `react-hook-form`. | Due date, listing expiry, any date field. |
| `FileInput` | `file-input.tsx` | Drag-and-drop file dropzone with validation and preview. | Invoice PDF upload in the mint wizard. |
| `RangeSlider` | `range-slider.tsx` | Dual-thumb range slider for numeric intervals. | APR range, amount range filters on marketplace. |

### Layout & overlay

| Primitive | File | Purpose | When to use |
| --------- | ---- | ------- | ----------- |
| `Card` | `card.tsx` | Surface container with header, content, footer slots and hover/selected states. | Invoice cards, dashboard stats wrappers, panel sections. |
| `Dialog` | `dialog.tsx` | Radix Dialog (modal) with overlay, title, description, focus trap, and close affordances. | Confirmations (CancelInvoice, Repay, Share), KYC dialogs, wizard review. |
| `Drawer` | `drawer.tsx` | Slide-in panel from the right with focus trap, Escape, backdrop, and scroll lock. | Position detail, analytics breakdowns, history drawer. |
| `BottomSheet` | `bottom-sheet.tsx` | Mobile slide-up sheet with drag-handle swipe-to-dismiss, focus trap, Escape, and scroll lock (`lg:hidden`). | Marketplace filters on mobile, secondary market filters. |
| `Breadcrumb` | `breadcrumb.tsx` | Navigational hierarchy trail with separators and current-page marking. | Page headers where parent context matters (e.g. invoice detail → marketplace). |
| `BackButton` | `back-button.tsx` | Router-aware back navigation with icon and label. | Detail pages, wizard steps, dashboard drill-downs. |
| `PrintLayout` | `print-layout.tsx` | Print/PDF export wrapper with `@media print` rules and page-break controls. | Invoice PDF generation and print preview. |

### Feedback & state

| Primitive | File | Purpose | When to use |
| --------- | ---- | ------- | ----------- |
| `Badge` | `badge.tsx` | Status pill with color variants (default, secondary, destructive, outline, success, warning). | Risk tier, invoice status, live counts. |
| `Progress` | `progress.tsx` | Radix Progress bar with determinate value and accessible label. | Funding progress on invoice cards and detail. |
| `Skeleton` | `skeleton.tsx` | Animated placeholder block/circle for loading states. | Any async surface before data resolves. |
| `EmptyState` | `EmptyState.tsx` | Illustrated empty state with title, description, action slot and variant (`default`, `search`, `error`). | No results, no invoices, filtered-empty marketplace. |
| `ErrorBoundary` | `error-boundary.tsx` | React error boundary with fallback UI, retry, and classified error kinds. | Route-level and widget-level crash containment. |
| `ErrorPage` | `ErrorPage.tsx` | Full-page error display with translated title/description and reset CTA. | `error.tsx` and `global-error.tsx` boundaries. |
| `Tooltip` | `tooltip.tsx` | Radix Tooltip with delay, side, and arrow. | Icon buttons, truncated labels, APR explainers. |
| `animations.tsx` | `animations.tsx` | Framer-motion helpers: `SuccessCheckmark`, reduced-motion guard, shared transitions. | Success states (minted, funded), micro-interactions. |
| `CountdownTimer` | `CountdownTimer.tsx` | Live countdown with ICS export helper for maturity reminders. | Time-to-maturity on invoice cards and detail. |

### Data display

| Primitive | File | Purpose | When to use |
| --------- | ---- | ------- | ----------- |
| `DataTable` | `data-table.tsx` | Headless data table with sortable columns, row selection, and empty state. | SME/investor dashboards, transactions list. |
| `Pagination` | `pagination.tsx` | Page navigation with ellipsis, previous/next, and accessible labels. | Any paginated list (marketplace, transactions, dashboards). |
| `StatCard` | `stat-card.tsx` | Metric card with value, trend, icon, and change indicator. | Portfolio stats, marketplace aggregates, analytics KPIs. |
| `APRDisplay` | `apr-display.tsx` | Formatted APR with tier badge and tooltip. | Invoice cards, detail financing terms, comparison table. |
| `Highlight` | `Highlight.tsx` | Query-aware text highlighter that wraps matches in `<mark>`. | Search results (marketplace, transactions, address book). |
| `StellarAddress` | `stellar-address.tsx` | Truncated Stellar `G…` address with copy and explorer link. | Seller address, debtor wallet, transaction from/to. |
| `StellarTxLink` | `stellar-tx-link.tsx` | Transaction hash link to Stellar Expert with copy and external icon. | Toast, history, detail confirmations. |
| `investor-dashboard-skeleton` | `investor-dashboard-skeleton.tsx` | Composite skeleton layout mirroring the investor dashboard grid. | Loading state for `/dashboard/investor`. |

### Utilities & affordances

| Primitive | File | Purpose | When to use |
| --------- | ---- | ------- | ----------- |
| `CopyButton` | `CopyButton.tsx` | Copy-to-clipboard button with copied feedback, `useTranslations("copyButton")`, and tooltip. | Address, hash, share link, taxonomy copy. |
| `ShortcutBadge` | `ShortcutBadge.tsx` | Keyboard shortcut hint badge (`⌘K`, `?`, etc.). | Command palette, shortcut reference modal. |
| `index.ts` | `index.ts` | Barrel re-exports for the most commonly composed primitives. | Import via `components/ui` instead of deep paths. |

> **Note on `index.ts`:** the barrel currently re-exports `button`, `card`, `badge`, `skeleton`, `progress`, `input`, `textarea`, `number-input`, `date-picker`, `file-input`, `pagination`, `dialog`, `select`, `stat-card`, `data-table`, `CopyButton`, `Highlight`, `apr-display`, `drawer`, and `range-slider`. Other primitives (e.g. `bottom-sheet`, `breadcrumb`, `tooltip`, `EmptyState`) are imported via their direct paths — this is intentional and not a gap; extend the barrel only when a primitive is used widely enough to justify it.

## Storybook

Component stories live alongside components as `*.stories.tsx` files. Storybook
packages are **not currently wired** as an `npm run storybook` script — visual
coverage runs through the Vitest snapshot test instead. See
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

Run the snapshot suite for stories:

```bash
npm run test -- __tests__/stories.snapshot.test.tsx
```

If you make intentional markup changes, regenerate the committed snapshots:

```bash
npm run test -- __tests__/stories.snapshot.test.tsx -u
```

Snapshots are stored in `__tests__/__snapshots__/` and must be committed with
your change.

- `npm run storybook` — dev server at `http://localhost:6006`
- `npm run build-storybook` — static build
- `npm run test -- __tests__/stories.snapshot.test.tsx` — Vitest snapshot coverage without a dev server

### Wallet connect states (`components/wallet/WalletConnectModal.stories.tsx`)

`WalletConnectModal` is documented as a state matrix rather than one mockup.
States are pinned through optional props intended for Storybook — production
renders `<WalletConnectModal />` with no props and behaves exactly as before.

| Story | State | Accessibility contract |
| ----- | ----- | ---------------------- |
| `Idle` | Provider list | Stable tab order; every action has an accessible name (`Connect`/`Install`/`Open …`). Focus moves to the first enabled provider on open. |
| `Connecting` | `aria-busy=true` | Escape is blocked mid-signature; spinner is `aria-hidden` because `aria-busy` already conveys progress. |
| `Connected` | Success | Uses the dialog's title/description; the check icon is decorative, so the status is not announced twice. |
| `ConnectionError` | Failure + retry | Error text sits next to the failing provider (never colour-only); `Retry` has an explicit accessible name. |
| `ProviderHealthStates` | ready / missing / locked / unsupported network / error | Badge text is readable without colour; `missing` and `unsupported_network` actions are disabled. |
| `MobileDeepLinkWaiting` | Deep-link hand-off | `role="status"` + `aria-live="polite"` announces the pending connection when the user returns from the wallet app. |

`@storybook/addon-a11y` is configured in `.storybook/main.ts`; each story's
`parameters.docs.description.story` explains the state for reviewers, and its
`play` function asserts the ARIA attributes above. When a connect-state change
alters markup, update the stories and re-check both light and dark backgrounds
plus the Arabic RTL locale wrapper.

## Adding new tokens

1. Add the CSS variable to `:root` and `.dark` in `app/globals.css`.
2. Map it in `tailwind.config.ts` under `theme.extend`.
3. Use the Tailwind utility in components — avoid hard-coded hex values in feature code.

## Adding a new primitive

1. Create `components/ui/<name>.tsx` following the existing patterns (forwardRef where appropriate, `cn()` for classes, `aria-*` for a11y, `useTranslations` only when the primitive owns user-facing copy).
2. Add `components/ui/<name>.stories.tsx` with at least `Default` and one variant/accessibility story.
3. Export it from `components/ui/index.ts` if it is broadly reused; otherwise document its direct import path in the table above.
4. Update this inventory doc so the new primitive appears in the correct table.

## Layout & Landmark Structure

Screen readers rely on semantic landmarks to navigate page regions efficiently. All major layout surfaces expose explicit ARIA roles and labels:

| Component | Landmark | Label | Rationale |
| --------- | -------- | ----- | --------- |
| `Header` (navbar) | `banner` | Implicit via `<header>` in top-level layout | Primary site navigation; one per page |
| `Footer` | `contentinfo` | `aria-labelledby="footer-copyright"` | Copyright, changelog, shortcuts; links footer region to copyright text |
| `main` (layout children) | `main` | Implicit via `<main>` wrapper in layout | Primary page content; one per page |

### Focus Management

- **Modal dialogs** (`Dialog`, `Drawer`, `BottomSheet`) automatically trap focus and restore it to the trigger element on close via Radix UI primitives.
- **Footer changelog button** stores a ref to the trigger; when `uiStore.changelogOpen` transitions from `true` → `false`, focus is programmatically restored to the button via `useEffect`.
- **Page navigation** (via Next.js `<Link>`) moves focus to the new page's `<main>` element automatically; no custom focus management is needed for route changes.

### Skip Links

The top-level layout places a visually-hidden "Skip to main content" link as the first focusable element in `<body>`. It targets the `main#main-content` landmark and becomes visible on keyboard focus, allowing keyboard users to bypass repeated navigation chrome.

### Testing Landmarks

Run `npm run test:a11y` (if available) to audit landmark structure. Manual verification:

1. Enable a screen reader (NVDA on Windows, VoiceOver on macOS).
2. Navigate by landmarks (NVDA: `D`/`Shift+D`, VoiceOver: `VO+U` → Landmarks).
3. Verify `banner`, `main`, and `contentinfo` are announced and navigable.
4. Confirm footer's label reads "Kora Protocol copyright" or similar localized text.

## Wallet Connect States

Source: `components/wallet/WalletConnectModal.tsx` (the connect dialog) and `components/wallet/WalletButton.tsx` (the navbar trigger). Any new wallet UI should match these states rather than inventing its own.

### Trigger (`WalletButton`)

| State | Rendered | A11y |
| ----- | -------- | ---- |
| Disconnected | `Button` (`size="sm"`) labelled `wallet.connect` | Native button; keyboard and focus reachable. Preloads the wallet kit on hover and focus. |
| Connected | Menu button showing the truncated address and network chip | `aria-label` reads `Wallet menu`, with ` - Wrong network` or ` - Reconnect required` appended when relevant. |
| Wrong network | Destructive border and `AlertCircle` icon | The state is conveyed in the `aria-label` suffix, not colour alone. |
| Reconnect required | Warning border; `reconnect-prompt` block with `role="alert"` | The alert is announced when shown. |

### Connect dialog (`WalletConnectModal`)

Built on the `Dialog` primitive, so focus is trapped and restored to the trigger on close. Escape closes the dialog except while a connection is in progress.

| State | Trigger condition | What the user sees | A11y |
| ----- | ----------------- | ------------------ | ---- |
| Idle | Dialog open, no attempt running | One row per wallet. Installed wallets show a `Connect <name>` button. Missing wallets show an `Install` link (desktop) or `Open <name> mobile app` (mobile, when a deep link exists). | Each action has an explicit `aria-label`. External install links use `rel="noopener noreferrer"`. The first action receives initial focus. |
| Health badge | Provider probe returns `ready`, `missing`, `locked`, `unsupported_network` or `error` | A coloured pill plus the probe message. `missing` and `unsupported_network` disable the Connect button. | Badge text carries the meaning; colour is not the only signal. |
| Connecting | `connectWallet` in flight | Row border tints primary, a spinning `Loader2` appears, and the row's buttons are disabled. | The dialog sets `aria-busy="true"`. Escape is ignored. The spinner is `aria-hidden`. |
| Deep-link waiting | Mobile deep link opened and the app is in the background | Inline banner with `role="status"` and `aria-live="polite"`. Connection is attempted again when the page becomes visible (800 ms debounce). | Polite live region, so the message does not interrupt. |
| Error | `connectWallet` throws | Row border turns destructive, the error message appears (clamped to 2 lines), and a `Retry` button replaces Connect. | Retry is a native button. The error text is not in a live region (see gaps). |
| Success | `connectWallet` resolves | The list is replaced by a confirmation card. The dialog closes after 1.5 s. | Motion is a fade and scale. The success text is not in a live region (see gaps). |

Motion in these states uses `framer-motion`. Honour `prefers-reduced-motion` through the shared guard in `components/ui/animations.tsx` when you add new motion.

### Layout

- **Mobile and desktop:** the same row layout is used. Only the action differs: `Install` on desktop, `Open in app` on mobile when a deep link exists.
- **Keyboard:** tab order is top to bottom through the rows, then the read-only watch input, then the Terms link.
- **Touch targets:** the action buttons are `py-1` text buttons. Keep them at least 24×24 px on mobile when you change them.

### Known a11y gaps

These are documented here so they are not copied into new components.

1. The error message and the success card are not in an `aria-live` region, so screen-reader users may not hear the outcome.
2. The read-only watch input has only a `placeholder`, with no `<label>`.
3. Some copy is hardcoded English (`Or browse in read-only mode`, `Paste a G-address to watch...`, `Watch`, `Connect`, and the `Verified` / `Pending Review` labels in `WalletButton`). Move these into the `wallet` namespace when touched.

### Storybook coverage

No Storybook script is wired (see [Storybook](#storybook)), so these states are not yet covered by stories. When adding them, create `components/wallet/WalletConnectModal.stories.tsx` with one story per row of the table above, and add the snapshot to `__tests__/stories.snapshot.test.tsx`.

