import { describe, expect, it } from "vitest";
import { groupTransactionsByInvoice } from "../groupTransactionsByInvoice";

describe("groupTransactionsByInvoice", () => {
  it("preserves first appearance and row order and leaves unidentified rows independent", () => {
    const transactions = [
      { hash: "first", invoiceId: "10" },
      { hash: "second", invoiceId: "11" },
      { hash: "legacy" },
      { hash: "fourth", invoiceId: "10" },
      { hash: "blank", invoiceId: " " },
      { hash: "first", invoiceId: "duplicate" },
    ];
    const groups = groupTransactionsByInvoice(transactions);
    expect(groups.map((group) => group.transactions.map((tx) => tx.hash))).toEqual([
      ["first", "fourth"], ["second"], ["legacy"], ["blank"],
    ]);
    expect(new Set(groups.map((group) => group.key)).size).toBe(4);
  });
});
