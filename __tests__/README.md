# Integration Tests for Kora Frontend

Comprehensive integration tests for the Kora-Frontend marketplace and invoice funding flow.

## Overview

These integration tests cover:

- **Marketplace Listing Page**: Filter interactions, search with debounce, pagination
- **Invoice Card Component**: Hover prefetch, navigation, data display
- **Invoice Detail Page**: Full invoice data rendering, funding calculations, validations
- **Funding Flow**: Complete transaction lifecycle, optimistic updates, error handling
- **Wallet & Transaction State**: Connection states, transaction lifecycle, error recovery

## Test Files

### Core Test Suites

1. **`marketplace.integration.test.tsx`** (12 tests)
   - Render marketplace with mock invoices
   - Filter by category, jurisdiction, APR range
   - Combined multi-filter testing
   - Search with debounce simulation (300ms)
   - Search result highlighting
   - Filter reset functionality

2. **`invoice-card.integration.test.tsx`** (15 tests)
   - Card rendering with all invoice data
   - Funding progress display
   - Investor count and remaining capacity
   - Status and risk tier badges
   - Hover prefetch behavior
   - Click navigation to detail page
   - Status and risk color variations
   - Fully funded invoice display
   - Dynamic invoice updates

3. **`invoice-detail.integration.test.tsx`** (13 tests)
   - Full invoice detail page rendering
   - Funding progress visualization
   - APR and days to maturity display
   - Expected return calculation (with holding period)
   - Minimum investment validation
   - Remaining capacity validation
   - Eligible investor eligibility checks
   - SME owner gating
   - Fully funded invoice prevention

4. **`funding-flow.integration.test.tsx`** (12 tests)
   - Complete funding transaction flow
   - Transaction lifecycle stages (building → signing → submitting → confirmed)
   - Optimistic UI updates before confirmation
   - Mock wallet signature behavior
   - Transaction hash display on success
   - Error handling and display
   - Loading states and button disabling
   - Transaction retry logic
   - Minimum investment pre-submission validation

5. **`wallet-state.integration.test.tsx`** (18 tests)
   - Connected wallet state behavior
   - Disconnected wallet state behavior
   - Wallet modal triggering
   - Wallet address display
   - Balance display
   - Transaction signing states
   - Error message display and clearing
   - Amount input handling
   - Wallet connection/disconnection transitions
   - Balance management

### Support Files

- **`setup.ts`**: Test configuration, mock providers factory, QueryClient setup
- **`fixtures.ts`**: Mock data factories, invoice generators, wallet states
- **`providers.tsx`**: React Query provider wrapper for tests
- **`vitest.setup.ts`**: Global test setup, DOM mocks, polyfills

## Prerequisites

Install required dependencies:

```bash
npm install --save-dev @testing-library/react @testing-library/user-event vitest @vitest/ui jsdom @vitejs/plugin-react
```

Or add to `package.json` devDependencies:

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@vitest/ui": "^1.0.0",
    "jsdom": "^23.0.0",
    "vitest": "^1.0.0"
  }
}
```

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run specific test file

```bash
npm test marketplace.integration.test.tsx
```

### Run with UI dashboard

```bash
npx vitest --ui
```

### Run with coverage

```bash
npx vitest --coverage
```

## Test Structure

Each test suite follows this pattern:

```typescript
describe("Feature Name", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it("does something specific", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>
    );

    expect(screen.getByTestId("element")).toBeInTheDocument();
  });
});
```

## Mock Data

### Invoice Factory

Create mock invoices with customizable properties:

```typescript
import { createMockInvoice, createMockInvoices } from "./__tests__/fixtures";

// Single invoice with overrides
const invoice = createMockInvoice({
  id: "inv_custom",
  metadata: { invoiceNumber: "INV-001", debtorName: "Acme Corp" },
  terms: { apr: 20 },
});

// Multiple varied invoices
const invoices = createMockInvoices(10);
```

### Wallet States

```typescript
import { mockWalletConnected, mockWalletDisconnected } from "./__tests__/fixtures";

// Connected wallet with balance
console.log(mockWalletConnected.address);     // "GBUQWP3BOUZX34..."
console.log(mockWalletConnected.balance.usdc); // "50000"

// Disconnected state
console.log(mockWalletDisconnected.isConnected); // false
```

## Key Testing Patterns

### Filter Testing

Tests verify that filters correctly narrow down invoice lists:

```typescript
// Apply category filter
await user.click(screen.getByTestId("category-technology"));

// Verify filtered results
await waitFor(() => {
  expect(screen.getByTestId("results-count")).toHaveTextContent("2 results");
});
```

### Debounce Testing

Search debounce (300ms) is simulated:

```typescript
const searchInput = screen.getByTestId("search-input");
await user.type(searchInput, "query");

// Results not filtered immediately
expect(screen.getByTestId("results-count")).toHaveTextContent("10 results");

// Wait for debounce
await waitFor(() => {
  expect(screen.getByTestId("results-count")).toHaveTextContent(/\d+ results/);
}, { timeout: 500 });
```

### Return Calculation Testing

Expected return verification with holding period:

```typescript
// Formula: amount * (1 + (apr/100) * (days/365))
// Example: 10000 * (1 + (24.5/100) * (63/365)) = 10421.92

await user.type(amountInput, "10000");

const returnCalc = screen.getByTestId("expected-return");
expect(returnCalc).toHaveTextContent("10421.92");
```

### Transaction Flow Testing

Complete funding transaction simulation:

```typescript
1. User enters amount
2. User clicks Fund button
3. Component does optimistic update
4. Transaction stages: building → simulating → signing → submitting → polling → confirmed
5. Success state shows transaction hash
```

### Wallet State Testing

Wallet connection/disconnection transitions:

```typescript
// Initially disconnected
expect(screen.getByTestId("connect-button")).toBeInTheDocument();

// Change wallet state
mockWalletState = mockWalletConnected;
rerender(<WalletStateTest />);

// Now shows fund button
expect(screen.getByTestId("fund-button")).toBeInTheDocument();
```

## Validation Tests

### Minimum Investment

```typescript
await user.type(amountInput, "500"); // Below 1000 minimum

expect(screen.getByTestId("input-error")).toHaveTextContent("Minimum investment");
expect(screen.getByTestId("fund-button")).toBeDisabled();
```

### Remaining Capacity

```typescript
await user.type(amountInput, "60000"); // Exceeds 50000 capacity

expect(screen.getByTestId("input-error")).toHaveTextContent("exceeds remaining capacity");
```

### Fully Funded

```typescript
const fullyFundedInvoice = createMockInvoice({
  status: "fully_funded",
  funding: { fundingProgress: 1.0, remainingCapacity: 0 },
});

// Should prevent funding
expect(screen.getByTestId("cannot-fund-reason")).toHaveTextContent("fully funded");
```

## Mocked Services

### useInvoices Hook

```typescript
vi.mock("@/hooks/useInvoices", () => ({
  useInvoices: vi.fn(() => ({
    data: { invoices: mockInvoices, totalCount: 10, page: 1 },
    isLoading: false,
    error: null,
  })),
  usePrefetchInvoice: vi.fn(() => mockPrefetch),
}));
```

### useWallet Hook

```typescript
vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(() => mockWalletState),
}));
```

### useTransaction Hook

```typescript
vi.mock("@/hooks/useTransaction", () => ({
  useTransaction: vi.fn(() => ({
    state: { status: "idle", txHash: null },
    execute: vi.fn(async (buildFn) => {
      const xdr = await buildFn();
      return "mock_tx_hash";
    }),
  })),
}));
```

## Common Issues & Solutions

### Issue: "Cannot find module '@testing-library/react'"

**Solution**: Install missing dependencies

```bash
npm install --save-dev @testing-library/react @testing-library/user-event
```

### Issue: "jsdom is not installed"

**Solution**: Install jsdom

```bash
npm install --save-dev jsdom
```

### Issue: "vitest.setup.ts not found"

**Solution**: Make sure vitest.config.ts points to correct setup file

```typescript
setupFiles: ["./vitest.setup.ts"],
```

### Issue: Tests timeout waiting for async operations

**Solution**: Increase timeout in waitFor

```typescript
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 1000 }); // 1 second instead of default 1000ms
```

### Issue: Mock not working for next/navigation

**Solution**: Clear mocks between tests

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Test Coverage Goals

- **Marketplace Listing**: 95%+ coverage of filter logic
- **Invoice Card**: 100% coverage of render logic and interactions
- **Detail Page**: 90%+ coverage of calculations and validations
- **Funding Flow**: 85%+ coverage of transaction lifecycle
- **Wallet State**: 90%+ coverage of connection state transitions

## Debugging Tests

### Enable debug output

```typescript
import { render, screen } from "@testing-library/react";

it("debug test", () => {
  const { debug } = render(<Component />);
  debug(); // Prints DOM to console
});
```

### Check query results

```typescript
// See what's being queried
screen.logTestingPlaygroundURL();
```

### Run single test

```bash
npm test -- --grep "specific test name"
```

### Watch specific file

```bash
npm run test:watch -- marketplace.integration.test.tsx
```

## Best Practices

1. **Use data-testid**: Always use `data-testid` for querying elements
2. **Mock API calls**: Always mock hooks and services
3. **Test user interactions**: Use `userEvent` not `fireEvent`
4. **Clean up**: Tests auto-cleanup via afterEach
5. **Wait for async**: Use `waitFor` for async operations
6. **Group related tests**: Use `describe` blocks effectively
7. **Clear mocks**: Reset mocks between tests

## Contributing

When adding new tests:

1. Follow the naming pattern: `feature.integration.test.tsx`
2. Group tests logically with `describe` blocks
3. Use descriptive test names starting with "it"
4. Mock external dependencies
5. Use `data-testid` for querying
6. Add comments for complex test logic
7. Ensure tests are deterministic (no flakiness)

## References

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [React Query Testing](https://tanstack.com/query/latest/docs/react/testing)
- [User Event Documentation](https://testing-library.com/docs/user-event/intro)
