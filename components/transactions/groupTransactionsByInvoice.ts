export function groupTransactionsByInvoice<T extends { hash: string; invoiceId?: string }>(
  transactions: readonly T[],
) {
  const groups: Array<{ key: string; invoiceId?: string; transactions: T[] }> = [];
  const invoices = new Map<string, T[]>();
  const seenHashes = new Set<string>();

  for (const tx of transactions) {
    if (seenHashes.has(tx.hash)) continue;
    seenHashes.add(tx.hash);
    const invoiceId = typeof tx.invoiceId === "string" ? tx.invoiceId.trim() : "";
    if (!invoiceId) {
      groups.push({ key: `transaction:${tx.hash}`, transactions: [tx] });
      continue;
    }
    const existing = invoices.get(invoiceId);
    if (existing) {
      existing.push(tx);
      continue;
    }
    const rows = [tx];
    invoices.set(invoiceId, rows);
    groups.push({ key: `invoice:${invoiceId}`, invoiceId, transactions: rows });
  }
  return groups;
}
