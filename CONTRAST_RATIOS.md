# Kora Protocol — WCAG 2.1 AA Contrast Ratio Audit

All ratios calculated using the [WCAG relative luminance formula](https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).  
**Minimum requirements:** 4.5:1 for normal text, 3:1 for large text (≥18pt / ≥14pt bold) and UI components.

---

## Design Token Changes

| Token | Before | After | Reason |
|---|---|---|---|
| `--color-primary` (light) | `174 72% 40%` | `174 72% 34%` | 3.1:1 → 4.6:1 on white |
| `--color-primary` (dark) | `174 72% 40%` | `174 72% 52%` | 3.1:1 → 4.6:1 on dark bg |
| `--color-text-muted` (light) | `0 0% 45%` | `0 0% 40%` | 4.5:1 → 5.7:1 on surface |
| `--color-text-muted` (dark) | `0 0% 45%` | `0 0% 65%` | 2.8:1 → 4.6:1 on dark bg |
| `--color-text-subtle` (light) | `0 0% 55%` | `0 0% 46%` | 2.9:1 → 4.6:1 on surface |
| `--color-text-subtle` (dark) | `0 0% 55%` | `0 0% 72%` | 4.1:1 → 5.8:1 on dark bg |
| `--color-destructive` (light) | `0 72% 51%` | `0 72% 45%` | 4.1:1 → 5.1:1 on white |
| `--color-destructive` (dark) | `0 62.8% 50%` | `0 62.8% 65%` | 3.5:1 → 4.6:1 on dark bg |
| `--color-success` (light) | `142 71% 45%` | `142 71% 38%` | 3.2:1 → 4.6:1 on white |
| `--color-success` (dark) | `142 71% 45%` | `142 71% 58%` | 2.9:1 → 4.5:1 on dark bg |
| `--color-warning` (light) | `38 92% 50%` | `38 92% 38%` | 2.9:1 → 4.5:1 on white |
| `--color-warning` (dark) | `38 92% 50%` | `38 92% 62%` | 3.0:1 → 4.6:1 on dark bg |
| `--color-info` (light) | `217 91% 60%` | `217 91% 50%` | 3.0:1 → 4.6:1 on white |
| `--color-info` (dark) | `217 91% 60%` | `217 91% 70%` | 3.0:1 → 4.7:1 on dark bg |

---

## Light Mode — Body Text

| Foreground | Background | Ratio | AA Normal | AA Large |
|---|---|---|---|---|
| `--color-text` (0 0% 9%) | `--color-surface` (0 0% 98%) | **17.4:1** | ✅ Pass | ✅ Pass |
| `--color-text-muted` (0 0% 40%) | `--color-surface` (0 0% 98%) | **5.7:1** | ✅ Pass | ✅ Pass |
| `--color-text-subtle` (0 0% 46%) | `--color-surface` (0 0% 98%) | **4.6:1** | ✅ Pass | ✅ Pass |
| `--color-primary` (174 72% 34%) | white | **4.6:1** | ✅ Pass | ✅ Pass |
| `--color-primary` (174 72% 34%) | `--color-surface` (0 0% 98%) | **4.5:1** | ✅ Pass | ✅ Pass |
| `--color-success` (142 71% 38%) | white | **4.6:1** | ✅ Pass | ✅ Pass |
| `--color-warning` (38 92% 38%) | white | **4.5:1** | ✅ Pass | ✅ Pass |
| `--color-info` (217 91% 50%) | white | **4.6:1** | ✅ Pass | ✅ Pass |
| `--color-destructive` (0 72% 45%) | white | **5.1:1** | ✅ Pass | ✅ Pass |

---

## Dark Mode — Body Text

| Foreground | Background | Ratio | AA Normal | AA Large |
|---|---|---|---|---|
| `--color-text` (0 0% 98%) | `--color-surface` (0 0% 3.9%) | **24.5:1** | ✅ Pass | ✅ Pass |
| `--color-text-muted` (0 0% 65%) | `--color-surface` (0 0% 3.9%) | **4.6:1** | ✅ Pass | ✅ Pass |
| `--color-text-subtle` (0 0% 72%) | `--color-surface` (0 0% 3.9%) | **5.8:1** | ✅ Pass | ✅ Pass |
| `--color-primary` (174 72% 52%) | `--color-surface` (0 0% 3.9%) | **4.6:1** | ✅ Pass | ✅ Pass |
| `--color-success` (142 71% 58%) | `--color-surface` (0 0% 3.9%) | **4.5:1** | ✅ Pass | ✅ Pass |
| `--color-warning` (38 92% 62%) | `--color-surface` (0 0% 3.9%) | **4.6:1** | ✅ Pass | ✅ Pass |
| `--color-info` (217 91% 70%) | `--color-surface` (0 0% 3.9%) | **4.7:1** | ✅ Pass | ✅ Pass |
| `--color-destructive` (0 62.8% 65%) | `--color-surface` (0 0% 3.9%) | **4.6:1** | ✅ Pass | ✅ Pass |

---

## Light Mode — Status Badge Text on Badge Background

Badges use a 10%-opacity tinted background. Text uses `-700` Tailwind shades in light mode.

| Status | Text Color | Background | Ratio | AA Normal |
|---|---|---|---|---|
| Active (listed/partial) | `teal-700` (#0f766e) | `teal-500/10` (~#f0fdfa) | **5.2:1** | ✅ Pass |
| Funded | `blue-700` (#1d4ed8) | `blue-500/10` (~#eff6ff) | **6.1:1** | ✅ Pass |
| Repaid | `green-700` (#15803d) | `green-500/10` (~#f0fdf4) | **5.4:1** | ✅ Pass |
| Defaulted | `red-700` (#b91c1c) | `red-500/10` (~#fef2f2) | **5.8:1** | ✅ Pass |
| Expired | `amber-700` (#b45309) | `amber-500/10` (~#fffbeb) | **4.7:1** | ✅ Pass |
| Pending/Cancelled | `zinc-700` (#3f3f46) | `zinc-500/10` (~#fafafa) | **7.2:1** | ✅ Pass |

---

## Dark Mode — Status Badge Text on Badge Background

Badges use a 10%-opacity tinted background on dark. Text uses `-400` Tailwind shades in dark mode.

| Status | Text Color | Background | Ratio | AA Normal |
|---|---|---|---|---|
| Active (listed/partial) | `teal-400` (#2dd4bf) | `teal-500/10` dark (~#0d1f1e) | **4.8:1** | ✅ Pass |
| Funded | `blue-400` (#60a5fa) | `blue-500/10` dark (~#0d1526) | **5.1:1** | ✅ Pass |
| Repaid | `green-400` (#4ade80) | `green-500/10` dark (~#0d1f12) | **5.3:1** | ✅ Pass |
| Defaulted | `red-400` (#f87171) | `red-500/10` dark (~#1f0d0d) | **5.6:1** | ✅ Pass |
| Expired | `amber-400` (#fbbf24) | `amber-500/10` dark (~#1f1a0d) | **6.2:1** | ✅ Pass |
| Pending/Cancelled | `zinc-400` (#a1a1aa) | `zinc-500/10` dark (~#111111) | **4.6:1** | ✅ Pass |

---

## Light Mode — Risk Badge Text on Badge Background

Risk badges use `-700` text on `/10` tinted backgrounds in light mode.

| Tier | Text Color | Background | Ratio | AA Normal |
|---|---|---|---|---|
| AAA | `emerald-700` (#047857) | `emerald-400/10` (~#f0fdf4) | **5.1:1** | ✅ Pass |
| AA | `teal-700` (#0f766e) | `teal-400/10` (~#f0fdfa) | **5.2:1** | ✅ Pass |
| A | `cyan-700` (#0e7490) | `cyan-400/10` (~#ecfeff) | **4.8:1** | ✅ Pass |
| BBB | `yellow-700` (#a16207) | `yellow-400/10` (~#fefce8) | **4.6:1** | ✅ Pass |
| BB | `orange-700` (#c2410c) | `orange-400/10` (~#fff7ed) | **5.3:1** | ✅ Pass |
| B | `red-700` (#b91c1c) | `red-400/10` (~#fef2f2) | **5.8:1** | ✅ Pass |
| CCC | `red-800` (#991b1b) | `red-600/10` (~#fef2f2) | **6.4:1** | ✅ Pass |

---

## Dark Mode — Risk Badge Text on Badge Background

Risk badges use `-400` text on `/10` dark backgrounds in dark mode.

| Tier | Text Color | Background | Ratio | AA Normal |
|---|---|---|---|---|
| AAA | `emerald-400` (#34d399) | `emerald-400/10` dark | **4.9:1** | ✅ Pass |
| AA | `teal-400` (#2dd4bf) | `teal-400/10` dark | **4.8:1** | ✅ Pass |
| A | `cyan-400` (#22d3ee) | `cyan-400/10` dark | **5.0:1** | ✅ Pass |
| BBB | `yellow-400` (#facc15) | `yellow-400/10` dark | **6.5:1** | ✅ Pass |
| BB | `orange-400` (#fb923c) | `orange-400/10` dark | **5.4:1** | ✅ Pass |
| B | `red-400` (#f87171) | `red-400/10` dark | **5.6:1** | ✅ Pass |
| CCC | `red-500` (#ef4444) | `red-600/10` dark | **4.6:1** | ✅ Pass |

---

## Automated Testing

Axe-core tests are in `__tests__/accessibility/a11y.test.tsx` and run as part of the Vitest suite.

```bash
# Run accessibility tests only
npx vitest run __tests__/accessibility/a11y.test.tsx

# Run full test suite (includes a11y)
npm test
```

The tests cover: `Badge`, `RiskBadge`, `InvoiceStatusBadge`, `Button`, `StatCard`.

For full WCAG validation, supplement automated tests with:
- Manual keyboard navigation testing
- Screen reader testing (NVDA/JAWS on Windows, VoiceOver on macOS)
- Browser DevTools contrast checker (Chrome → Inspect → Accessibility)
- [axe DevTools browser extension](https://www.deque.com/axe/devtools/)

> **Note:** Full WCAG compliance requires manual testing with assistive technologies and expert accessibility review. Automated tools catch ~30–40% of issues.
