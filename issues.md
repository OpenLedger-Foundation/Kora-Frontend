Background: There's no record of what transactions were signed and when. For financial compliance, a local audit log is important.

What "done" looks like:

Every signed transaction is logged to transactionHistoryStore with: type, amount, target address, timestamp, tx hash
Log entries are immutable once written (no update/delete methods on the store)
A "Download Audit Log" button exports the log as JSON
Key files: store/transactionHistoryStore.ts, hooks/useTransaction.ts, components/transactions/TransactionHistoryDrawer.tsx

Constraints:

Private keys and signatures must never be logged — only public data
Immutability enforced by TypeScript (readonly arrays, no setter methods)
PR must include: Immutable log store + export button + tests.

Background: Several inputs in the invoice creation wizard have placeholder text but no associated — causing accessibility failures.

What "done" looks like:

Every input has a visible with htmlFor linking to the input id
Required fields are marked with aria-required="true"
Error messages are linked to their input via aria-describedby
Key files: app/invoice/create/

Constraints:

Do not use placeholder as a substitute for labels
Labels must be translated via i18n
PR must include: All label additions + aria attributes + axe audit results.

Background: When invoices load, filters change, or funding progress updates, screen readers are not notified.

What "done" looks like:

Marketplace invoice count ("Showing 12 of 47 invoices") is in an aria-live="polite" region
Funding progress updates announce "Invoice X is now Y% funded" to screen readers
Transaction toast messages use role="status" or role="alert" appropriately
Key files: app/marketplace/page.tsx, components/invoice/InvoiceCard.tsx, components/transactions/TransactionToasts.tsx

Constraints:

aria-live="assertive" only for critical alerts (tx failed) — use polite for everything else
Live regions must be in the DOM on initial render, not injected dynamically
PR must include: All live regions + screen reader test notes in PR description.

Background: Some browsers (private mode, strict settings) block localStorage. The app crashes when Zustand's persist middleware can't write.

What "done" looks like:

Zustand stores catch localStorage errors and fall back to sessionStorage
If both are unavailable, stores work in-memory with a console warning
No crash or white screen in any storage scenario
Key files: store/walletStore.ts, store/invoiceStore.ts, store/transactionHistoryStore.ts

Constraints:

Fallback logic is a shared storage adapter — not duplicated in each store
Warning message is shown once per session (not on every operation)
PR must include: Storage adapter + all stores updated + test with mocked unavailable storage