# Debtor Privacy Architecture & Masking Rules

This document specifies the privacy guarantees, masking invariants, and implementation guidelines for debtor data across Kora Protocol.

## Overview

In commercial invoice financing, SME borrowers frequently discount invoices with sensitive debtor relationships. Exposing identifiable corporate debtor information indiscriminately can lead to commercial disadvantage, competitive intelligence leakage, or relationship friction.

Kora provides three levels of `debtorPrivacy`:
1. `anonymized` (Default for sensitive listings)
2. `partial` (Standard corporate listing)
3. `full` (Public corporate listing)

Additionally, Kora enforces a **Post-Funding Reveal** invariant: when a liquidity provider funds an invoice position, the debtor details become fully visible to that investor to satisfy contract verification requirements.

---

## Privacy Levels and Field Visibility

| Field | `anonymized` | `partial` | `full` | `isFunded === true` |
| :--- | :--- | :--- | :--- | :--- |
| **Debtor Name** | Masked with Industry & Jurisdiction descriptor (e.g. `Technology Company (Kenya)`) | Full Legal Name (e.g. `Safaricom PLC`) | Full Legal Name (e.g. `Safaricom PLC`) | Full Legal Name |
| **Debtor Street Address** | Hidden (`Identity anonymized for privacy`) | Masked (`Address hidden · Kenya`) | Full Street Address | Full Street Address |
| **Jurisdiction / Country** | Visible | Visible | Visible | Visible |
| **Industry Category** | Visible | Visible | Visible | Visible |
| **Card & Table ARIA Labels** | Privacy-safe descriptor (No PII leak) | Company Name (Partial disclosure) | Full Company Name | Full Company Name |

---

## Centralized Masking Helpers

All UI components, card surfaces, list rows, comparison modals, and accessibility labels **must** resolve debtor information through `lib/debtorPrivacy.ts` rather than accessing `invoice.metadata.debtorName` or `invoice.metadata.debtorAddress` directly.

### Key API Functions

```typescript
import {
  getEffectiveDebtorPrivacy,
  getMaskedDebtorName,
  getMaskedDebtorAddress,
  getDebtorAriaLabel,
  isDebtorAnonymized,
  isDebtorPartial,
  isDebtorFull,
} from "@/lib/debtorPrivacy";

// Resolve privacy-safe debtor name
const name = getMaskedDebtorName(invoice, isFunded);

// Resolve privacy-safe address string
const address = getMaskedDebtorAddress(invoice, isFunded);

// Resolve screen reader label
const label = getDebtorAriaLabel(invoice, isFunded);
```

---

## UI Components & Visual Variants

### `DebtorDisplay` Component
The canonical component for rendering debtor identity. Supports multiple display variants:
- `variant="card"`: Standard two-line layout with privacy indicators and icons.
- `variant="compact"`: Single-line layout suitable for table headers, comparison chips, and list rows.
- `variant="detail"`: Expanded layout for invoice detail views with privacy status badges.

---

## Testing & Compliance

Every surface touching debtor data must satisfy:
1. **Zero PII Leaks under Anonymization**: No real debtor names or street addresses present in DOM text, HTML attributes, tooltips, or ARIA labels when `debtorPrivacy === "anonymized"` and `isFunded === false`.
2. **Deterministic Monikers**: Anonymized listings deterministically display category and jurisdiction descriptors.
3. **Automated Unit Tests**: Maintained in `__tests__/debtor-privacy.test.tsx`.


## Print redaction (#1182)

Printed pages and saved PDFs leave the app's access controls behind, so print output follows stricter rules than the screen (`getPrintDebtorPrivacy` / `getPrintDebtorName` / `getPrintDebtorAddress` in `lib/debtorPrivacy.ts`):

| Declared privacy | Screen (unfunded → funded) | Print |
| --- | --- | --- |
| `anonymized` | moniker → full | moniker (`Technology Company (Kenya)`) |
| `partial` | name, address hidden → full | name, `Address hidden · <country>` |
| `full` | full | name, `Address hidden · <country>` |

- The post-funding reveal never applies to print, and a street address is never printed.
- `DebtorDisplay` wraps its screen rendering in `[data-print-redact]` and renders a print-only twin (`[data-print-only]`, `hidden print:block`). The `PrintLayout` stylesheet swaps them with attribute selectors and `!important`, so no utility class can bring the screen version back into print.
- A missing `debtorPrivacy` defaults to `anonymized`.

## Address redaction in stored UI history (#1181)

`redactStellarAddresses()` truncates every full Stellar strkey (G…/C…/M…, including 69-char muxed addresses) in free text to `GABC…WXYZ`. Command palette recents (`localStorage` key `kora-cmd-recent`) apply it on write *and* on read:

- labels are redacted;
- destinations whose URL embeds a full address are not stored, because the URL can't be truncated without breaking navigation;
- malformed or legacy entries are dropped or redacted when loaded.

No feature flag is involved; redaction is always on.
