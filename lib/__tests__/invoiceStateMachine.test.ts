import { describe, expect, it } from "vitest";
import {
  STATUS_TO_CHAIN_INDEX,
  getAllowedTransitions,
  getBlockedReason,
  isValidTransition,
} from "../invoiceStateMachine";
import type { InvoiceStatus } from "@/types/invoice";

const ALL_STATUSES: readonly InvoiceStatus[] = [
  "draft",
  "pending_mint",
  "listed",
  "partially_funded",
  "fully_funded",
  "active",
  "repaid",
  "defaulted",
  "cancelled",
];

const EXPECTED_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: [],
  pending_mint: [],
  listed: ["fully_funded", "cancelled"],
  partially_funded: ["fully_funded", "cancelled"],
  fully_funded: ["repaid"],
  active: ["repaid"],
  repaid: [],
  defaulted: [],
  cancelled: [],
};

describe("invoiceStateMachine", () => {
  describe("getAllowedTransitions", () => {
    it.each(ALL_STATUSES)(
      "returns the exact allowed transitions for %s",
      (from) => {
        const targets = getAllowedTransitions(from).map((transition) => transition.to);
        expect(targets).toEqual([...EXPECTED_TRANSITIONS[from]]);
      },
    );

    it("keeps action metadata stable for every valid transition", () => {
      const metadata = Object.fromEntries(
        ALL_STATUSES.flatMap((from) =>
          getAllowedTransitions(from).map((transition) => [
            `${from}->${transition.to}`,
            {
              label: transition.label,
              variant: transition.variant,
              description: transition.description,
            },
          ]),
        ),
      );

      expect(metadata).toEqual({
        "listed->fully_funded": {
          label: "Mark as Funded",
          variant: "default",
          description:
            "Marks this invoice as fully funded. Investors will be notified.",
        },
        "listed->cancelled": {
          label: "Cancel Invoice",
          variant: "destructive",
          description:
            "Cancels this invoice and refunds any invested amount.",
        },
        "partially_funded->fully_funded": {
          label: "Mark as Funded",
          variant: "default",
          description:
            "Marks this invoice as fully funded. Investors will be notified.",
        },
        "partially_funded->cancelled": {
          label: "Cancel Invoice",
          variant: "destructive",
          description:
            "Cancels this invoice and refunds any invested amount.",
        },
        "fully_funded->repaid": {
          label: "Mark as Repaid",
          variant: "default",
          description:
            "Marks repayment complete and triggers yield distribution to investors.",
        },
        "active->repaid": {
          label: "Mark as Repaid",
          variant: "default",
          description:
            "Marks repayment complete and triggers yield distribution to investors.",
        },
      });
    });
  });

  describe("isValidTransition", () => {
    it("accepts every allowed transition and rejects every other transition", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          const expected = EXPECTED_TRANSITIONS[from].includes(to);
          expect(isValidTransition(from, to)).toBe(expected);
        }
      }
    });

    it("never allows self-transitions", () => {
      for (const status of ALL_STATUSES) {
        expect(isValidTransition(status, status)).toBe(false);
      }
    });

    it("treats every terminal state as non-transitioning", () => {
      const terminalStates: InvoiceStatus[] = [
        "draft",
        "pending_mint",
        "repaid",
        "defaulted",
        "cancelled",
      ];

      for (const from of terminalStates) {
        for (const to of ALL_STATUSES) {
          expect(isValidTransition(from, to)).toBe(false);
        }
      }
    });
  });

  describe("getBlockedReason", () => {
    it("returns null for every valid owner transition", () => {
      for (const from of ALL_STATUSES) {
        for (const to of EXPECTED_TRANSITIONS[from]) {
          expect(getBlockedReason(from, to, true)).toBeNull();
        }
      }
    });

    it("returns the ownership error for every non-owner attempt", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          expect(getBlockedReason(from, to, false)).toBe(
            "Only the invoice owner can trigger status changes.",
          );
        }
      }
    });

    it("returns a precise invalid-transition message for every illegal owner transition", () => {
      for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
          if (EXPECTED_TRANSITIONS[from].includes(to)) continue;

          expect(getBlockedReason(from, to, true)).toBe(
            `Cannot transition from "${from}" to "${to}".`,
          );
        }
      }
    });
  });

  describe("STATUS_TO_CHAIN_INDEX", () => {
    it("maps each status to the expected on-chain index", () => {
      expect(STATUS_TO_CHAIN_INDEX).toEqual({
        draft: -1,
        pending_mint: 0,
        listed: 1,
        partially_funded: 2,
        fully_funded: 3,
        active: 4,
        repaid: 5,
        defaulted: 6,
        cancelled: 7,
      });
    });
  });
});
