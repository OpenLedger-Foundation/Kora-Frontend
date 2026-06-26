# Invoice Card Hover Popover — Visual Guide

## Desktop Behavior

### Default State
```
┌─────────────────────────────────┐
│   Invoice Card (InvoiceCard)    │
│                                 │
│  - Debtor Name                  │
│  - Invoice Amount               │
│  - Funding Progress             │
│  - Metrics (APR, Tenor, etc)    │
│                                 │
│  [Fund Invoice] [Add to Compare]│
└─────────────────────────────────┘

No popover visible
```

### On Hover (300ms delay)
```
                    ┌──────────────────────┐
                    │  Invoice Preview     │
                    │  INV-2024-001        │
                    │                      │
┌─────────────────────┼──┐ APR:    12.5%   │
│   Invoice Card      │ ├──┼─────          │
│                     │ │  │ Risk:   A     │
│  - Debtor Name    ──┼──┤ Region: Kenya  │
│  - Invoice Amount   │ │  │               │
│  - Funding Progress │ │  │ Funded: 75%   │
│  - Metrics          │ │  │               │
│                     │ │  │ Maturity: 60d │
│  [Fund Invoice]   ──┼──┤               │
│                     │ │  │ Click to view │
│  [Add to Compare]   │ │  │ full details  │
└──────────────────────┼──┘ └──────────────────────┘
                    │
              Arrow pointing
              to trigger
```

### Quick Hover (< 300ms)
```
Mouse enter → [100ms elapsed] → Mouse leave
           ↓
        No popover appears
```

## Keyboard Behavior

### Tab to Card
```
User presses Tab
        ↓
Card receives focus (visible outline)
        ↓
Popover opens immediately
        ↓
Contents displayed
```

### Close with Escape
```
User presses Escape (while popover open)
        ↓
Popover closes
        ↓
Focus returns to card
        ↓
User can Tab to next element
```

## Touch Device
```
User attempts to touch card
        ↓
Touch detection runs on mount
        ↓
Popover permanently disabled
        ↓
Card acts as normal link
```

## Expired Invoice
```
Invoice status = "cancelled" OR listingExpiry < now
        ↓
Mouse hover: No popover (300ms timer cancelled)
Keyboard focus: No popover (focus handler exits early)
        ↓
Card displays normally (opacity-60)
```

## Popover Content Layout

```
┌─────────────────────────────────────┐
│  Invoice Preview                    │ ← Header
│  INV-2024-001                       │
├─────────────────────────────────────┤
│  📈 APR         12.5%               │ ← Metric row 1
│                                     │
│  ⚡ Risk        A                   │ ← Metric row 2
│                                     │
│  📍 Region      Kenya               │ ← Metric row 3
│                                     │
│  🟢 Funded      75%                 │ ← Metric row 4
│  ─────────────────────────────────  │
│  📅 Maturity    60d                 │ ← Metric row 5
├─────────────────────────────────────┤
│  Click to view full details         │ ← Footer hint
└─────────────────────────────────────┘

Dimensions: 256px width (w-64)
Shadows: shadow-lg with backdrop blur
Position: Fixed (no layout shift)
Arrow: Points to trigger card
```

## State Diagram

```
                    ┌──────────────┐
                    │  Initial     │
                    │  (Closed)    │
                    └──────┬───────┘
                           │
          Mouse Enter       │       Tab/Focus
          (Schedule +300ms) │       (Immediate)
                    ┌──────▼───────┐
                    │  Popover     │
                    │  Open        │
                    └──────┬───────┘
                           │
        Mouse Leave    │    Escape    │    Blur
        (Cancel timer) │    (KeyDown) │    (onBlur)
                    ┌──────▼───────┐
                    │  Closed      │
                    │  (Cancel     │◄──────┘
                    │   timeout)   │
                    └──────────────┘
```

## Accessibility Flow (Keyboard Users)

```
1. Tab → InvoiceCard receives focus
   ├─ Focus outline visible
   └─ Popover opens immediately

2. Read popover content
   ├─ Screen reader announces tooltip role
   ├─ aria-describedby connects to popover
   └─ Content readable in logical order

3. Escape → Close popover
   ├─ Focus stays on card
   └─ User can continue tabbing

4. Tab → Next interactive element
   └─ Standard browser navigation
```

## Performance Timeline

```
t=0ms   : User hovers over card
          │
t=0ms   : Mouse enter handler
          ├─ Prefetch query starts
          └─ 300ms timer scheduled

t=100ms : User moves mouse away
          ├─ Mouse leave handler
          └─ Timer cancelled
          └─ Popover stays closed ✓

--- OR ---

t=300ms : Timer fires
          ├─ Check if expired
          └─ Open popover
               ├─ Calculate position
               ├─ Animation starts (0.2s)
               └─ Content visible at t=320ms

t=310ms : User moves mouse away
          ├─ Mouse leave handler
          └─ Popover closes
```

## Notes
- Fixed positioning uses `top` and `left` CSS properties
- No overflow visible — popover contained in viewport
- Animation duration: 200ms (fade + scale)
- Backdrop blur: 4px for visual separation
