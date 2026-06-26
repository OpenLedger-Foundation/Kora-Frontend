# PR: Mobile-Responsive Marketplace with Bottom Sheet Filters

## Summary
Optimized the Invoice Marketplace for mobile devices with responsive grid layout and bottom sheet filter interface. SMEs and investors in emerging markets can now comfortably browse and filter invoices on phones.

## What's Done

### ✅ Mobile Layout
- **Single-column grid on mobile** (`<768px`) - invoices display in full width
- **2-column grid on tablet** (`768px-1024px`) - balanced layout
- **3-column grid on desktop** (`≥1024px`) - unchanged
- No desktop layout changes - backward compatible

### ✅ Bottom Sheet Filter Interface  
- Filter sidebar collapses into dismissible bottom sheet on mobile
- Slides up from bottom, rounded corners, semi-transparent backdrop
- Dismissible by:
  - Close button (✕)
  - Overlay tap
  - Browser back gesture
- All filters accessible: categories, jurisdictions, risk tiers, APR range, active-only toggle
- Filter count badge on mobile "Filters" button

### ✅ Reusable Component
- Created `BottomSheet` component in `components/ui/bottom-sheet.tsx`
- Extracted from inline marketplace code
- Can be reused across the app
- Proper TypeScript types and accessibility

### ✅ Mobile Tests
- Comprehensive Playwright test suite in `e2e/marketplace-mobile.spec.ts`
- iPhone 12 viewport (390px) for realistic mobile testing
- Tests cover:
  - Grid layout responsiveness
  - Bottom sheet open/close behavior
  - Filter application
  - Active filter badge
  - Search & sort controls
  - No unwanted horizontal scroll

## Technical Details

**Files Changed:**
- `app/marketplace/page.tsx` - Grid layout & BottomSheet usage
- `components/ui/bottom-sheet.tsx` - New component
- `e2e/marketplace-mobile.spec.ts` - Mobile tests

**Dependencies:** None added (uses existing libraries)

**CSS:** Only Tailwind utilities, no custom CSS

**Breakpoints:** Standard Tailwind (`md: 768px`, `lg: 1024px`)

## Testing

### Manual Testing
```bash
# Test locally
npm run dev
# Visit http://localhost:3000/marketplace
# Resize to mobile width or use DevTools device emulation

# Open DevTools > Toggle device toolbar > iPhone 12
# - Tap Filters button
# - Verify bottom sheet opens
# - Select filters
# - Verify grid updates
# - Close sheet
# - Verify single-column grid
```

### Automated Tests
```bash
# Run mobile tests
npx playwright test e2e/marketplace-mobile.spec.ts

# View results
npx playwright show-report
```

## Key Features Preserved
- ✅ Desktop 3-column grid unchanged
- ✅ Sticky filter sidebar on desktop
- ✅ URL-synced filters (all filters persist in URL)
- ✅ Search functionality
- ✅ Sort options
- ✅ Filter badge count
- ✅ Active filter reset button
- ✅ Search history dropdown
- ✅ Infinite scroll/pagination
- ✅ Comparison bar
- ✅ Share filters button

## Browser Support
- iOS Safari 13+
- Android Chrome 60+
- All modern mobile browsers

## Performance
- No layout shifts (fixed positioning)
- Smooth 300ms animations
- Only renders bottom sheet when open
- Body overflow prevented (no scroll jank)

## Accessibility
- ✅ ARIA labels on buttons
- ✅ Semantic HTML
- ✅ Keyboard dismissible (overlay tap/close button)
- ✅ Screen reader friendly
- ✅ Color contrast preserved
- ✅ Touch target sizes (44px minimum)

## Deployment
- ✅ No environment variables
- ✅ No new dependencies
- ✅ No breaking changes
- ✅ TypeScript validation passed
- ✅ Safe to deploy immediately

## Metrics
- **Code added:** ~200 lines (BottomSheet component)
- **Code refactored:** ~40 lines (removed inline drawer)
- **Tests added:** 15+ comprehensive mobile tests
- **Desktop changes:** 0 (backward compatible)

## Next Steps (Future)
- Add swipe-to-dismiss gesture
- Mobile analytics tracking
- A/B test filter button placement
- Consider persistent bottom sheet preference
- Haptic feedback on interactions

## Screenshots/Demo
- Mobile grid single-column ✓
- Bottom sheet filters ✓
- Filter badge on button ✓
- Overlay tap to close ✓

## Closes
- Improves mobile experience for emerging market users
- Enables responsive invoice browsing on phones
- Provides better UX on smaller viewports
