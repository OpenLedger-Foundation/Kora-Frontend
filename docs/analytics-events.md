# Marketplace Analytics Events — Schema Documentation

**Module:** [`lib/marketplaceAnalytics.ts`](../lib/marketplaceAnalytics.ts)  
**Unit Tests:** [`lib/__tests__/marketplaceAnalytics.test.ts`](../lib/__tests__/marketplaceAnalytics.test.ts)

---

## Overview

Structured, privacy-safe analytics events for the marketplace share → land → fund funnel (#563).  
All events are gated behind the user's analytics preference (opt-out respected) and contain **no PII** — wallet addresses, debtor names, or issuer information are never included.

---

## Privacy Contract

The analytics schema enforces strict zero-PII guarantees. No identifying information is transmitted to analytics providers or stored locally:

| Field excluded from all payloads | Reason |
|---|---|
| `walletAddress` | Stellar G-address is personally linkable and on-chain visible |
| `debtorName` | May identify a private individual or commercial entity |
| `issuerName` | May identify a specific private enterprise |
| `invoiceNumber` | Directly maps to on-chain private/confidential records |

---

## Analytics Preference Gate

Analytics collection is controlled by `isAnalyticsEnabled()` and respects user privacy preferences:

```typescript
export function isAnalyticsEnabled(): boolean
```

Events are suppressed when:

1. **Build-time / Environment kill-switch:** `NEXT_PUBLIC_ENABLE_ANALYTICS="false"` (e.g., staging or local dev environments that don't want noise).
2. **User opt-out:** `localStorage.getItem("kora-analytics-opt-out") === "true"`.

When neither signal is present, default behavior is **opt-in** (`true`), matching the PWA prompt analytics convention.

---

## Event Catalogue

All events correspond to the `MarketplaceEventName` type union and have dedicated exported tracking helpers:

| Event Name (`MarketplaceEventName`) | Exported Helper Function | When Fired | Source Classification |
|---|---|---|---|
| `marketplace_land` | `trackMarketplaceLand(params, filterCount, sortBy)` | Page mounts with at least one active deep-link filter parameter | `"deeplink"` only (organic suppressed) |
| `marketplace_filter_apply` | `trackMarketplaceFilterApply(params, filterCount, sortBy)` | A filter chip or form control changes the active URL / store state | `"deeplink"` or `"organic"` |
| `marketplace_compare_open` | `trackMarketplaceCompareOpen(params, filterCount, sortBy)` | Comparison bar becomes visible (≥2 invoices selected) | `"deeplink"` or `"organic"` |
| `marketplace_fund_cta` | `trackMarketplaceFundCta(params, filterCount, sortBy)` | "Fund Invoice" CTA button clicked on marketplace or detail view | `"deeplink"` or `"organic"` |

### Event Details

#### `marketplace_land`
- **When:** Page mounts (`useEffect`) with at least one deep-link parameter present.
- **Purpose:** Measure how many unique sessions land on the marketplace via a shared filter link.
- **Behavior:** Pure organic visits (`params` without deep-link parameters) **do not** emit this event to prevent inflating top-of-funnel deep-link conversion metrics.

#### `marketplace_filter_apply`
- **When:** User selects, clears, or modifies any filter criteria.
- **Purpose:** Measure filter engagement and identify high-demand asset filters.
- **Timing:** Call **after** the store/URL update so `filter_count` reflects the new active count.

#### `marketplace_compare_open`
- **When:** The comparison tray becomes visible (≥2 invoices selected for comparison).
- **Purpose:** Track adoption of the comparison tool and shared compare link sessions.

#### `marketplace_fund_cta`
- **When:** The **"Fund Invoice"** CTA button is clicked (measures intent, not settlement).
- **Purpose:** Measure top-of-funnel funding intent; pair with on-chain transaction confirmation events for end-to-end conversion.

---

## Deep-Link Detection

The helper `isDeepLink(params: URLSearchParams)` checks whether incoming query parameters contain at least one parameter from the recognized deep-link set:

```typescript
const DEEPLINK_PARAMS = new Set([
  "categories",
  "jurisdictions",
  "riskTiers",
  "minApr",
  "maxApr",
  "activeOnly",
  "sortBy",
  "q",
  "invoice_id",
  "compare",
]);
```

- When any of these parameters are present in the URL, `source` resolves to `"deeplink"`.
- When none are present, `source` resolves to `"organic"`.

---

## Payload Schema

Every event dispatches the unified `MarketplaceAnalyticsPayload`:

| Field | Type | Required | Description |
|---|---|---|---|
| `event` | `MarketplaceEventName` | Yes | Name of the event (`marketplace_land`, `marketplace_filter_apply`, etc.) |
| `source` | `"deeplink" \| "organic"` | Yes | Whether the session originated from a parameterised / shared URL |
| `filter_count` | `number` | Yes | Count of active filters applied at event time (0 = none) |
| `has_invoice_id` | `boolean` | Yes | True when `invoice_id` is present in the URL search parameters |
| `has_compare` | `boolean` | Yes | True when `compare` parameter is present in the URL |
| `sort_by` | `string \| null` | Yes | Current sort value (e.g. `"apr_desc"`), or `null` if default |
| `timestamp` | `number` | Yes | Unix timestamp in milliseconds (`Date.now()`) |

### TypeScript Definition

```typescript
export type MarketplaceEventName =
  | "marketplace_land"
  | "marketplace_filter_apply"
  | "marketplace_compare_open"
  | "marketplace_fund_cta";

export interface MarketplaceAnalyticsPayload {
  event: MarketplaceEventName;
  source: "deeplink" | "organic";
  filter_count: number;
  has_invoice_id: boolean;
  has_compare: boolean;
  sort_by: string | null;
  timestamp: number;
}
```

---

## Transport & Local Storage Buffer

Dispatched events are forwarded to all available browser analytics transports in a fault-tolerant manner:

1. **Google Analytics 4 (`window.gtag`):**
   - Transports `event` name with payload properties (`source`, `filter_count`, `has_invoice_id`, `has_compare`, `sort_by`).
2. **Plausible Analytics (`window.plausible`):**
   - Transports custom event with props (`source`, `filter_count`, `has_invoice_id`, `has_compare`, `sort_by` defaulting to `"default"` if null).
3. **Local Storage Buffer (`localStorage["kora-marketplace-analytics"]`):**
   - Always buffered locally to prevent event loss when external trackers are blocked or unavailable.
   - **Buffer Cap:** Hard capped at **500 entries** (`MAX_STORED_EVENTS = 500`). Oldest events are dropped via `.slice(-500)`.
   - Never throws: all dispatch errors are safely caught so analytics failures never affect application UX.

### Debug Helper

```typescript
import { getLocalMarketplaceEvents } from "@/lib/marketplaceAnalytics";

// Retrieve buffered events for developer diagnostics or testing
const events = getLocalMarketplaceEvents();
```

---

## Code Example

```typescript
import {
  trackMarketplaceLand,
  trackMarketplaceFilterApply,
  trackMarketplaceCompareOpen,
  trackMarketplaceFundCta,
} from "@/lib/marketplaceAnalytics";

// 1. On page mount in app/marketplace/page.tsx:
trackMarketplaceLand(searchParams, activeFilterCount, sortBy);

// 2. On filter adjustment:
trackMarketplaceFilterApply(searchParams, updatedFilterCount, sortBy);

// 3. When comparison tray opens (>=2 selected):
trackMarketplaceCompareOpen(searchParams, activeFilterCount, sortBy);

// 4. On clicking the fund invoice CTA button:
trackMarketplaceFundCta(searchParams, activeFilterCount, sortBy);
```

---

## Integration Reference

| File | Integration Role |
|---|---|
| [`app/marketplace/page.tsx`](../app/marketplace/page.tsx) | Dispatches land, filter, compare, and CTA events |
| [`lib/marketplaceAnalytics.ts`](../lib/marketplaceAnalytics.ts) | Core schema, gating, deep-link detection, and transport |
| [`lib/__tests__/marketplaceAnalytics.test.ts`](../lib/__tests__/marketplaceAnalytics.test.ts) | 17 unit tests verifying gating, parsing, buffering, and dispatch |
| [`lib/installPromptAnalytics.ts`](../lib/installPromptAnalytics.ts) | Sister analytics utility sharing transport and preference conventions |

---

## Template for Adding Future Analytics Events

When adding a new marketplace analytics event, follow this checklist:

1. **Type Definition:** Add new literal to `MarketplaceEventName` in `lib/marketplaceAnalytics.ts`.
2. **Exported Tracking Function:** Implement `trackMarketplace<EventName>` following the `buildPayload` pattern.
3. **Transport Validation:** Ensure `gtag` and `plausible` property mapping covers any custom fields.
4. **Unit Tests:** Add test cases in `lib/__tests__/marketplaceAnalytics.test.ts` verifying deep-link resolution and payload generation.
5. **Documentation:** Add row to the Event Catalogue table and update the Payload Schema section in this document.
