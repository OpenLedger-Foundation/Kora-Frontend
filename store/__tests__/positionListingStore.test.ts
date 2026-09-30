import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  usePositionListingStore,
  type PositionListingMeta,
} from "../positionListingStore";

const PERSIST_KEY = "kora-position-listings";

/**
 * Builds a valid `PositionListingMeta`. The store keys `listings` by
 * `positionId` and the shape derives from `PositionListing`, which uses
 * `positionId` / `askPrice` / `impliedDiscount` / ISO `listedAt`.
 */
const makeListing = (
  overrides: Partial<PositionListingMeta> = {},
): PositionListingMeta => ({
  positionId: "pos-1",
  askPrice: 100,
  impliedDiscount: 0.05,
  listedAt: "2026-01-01T00:00:00.000Z",
  invoiceTokenId: "token-1",
  ...overrides,
});

/** Snapshot of every listing currently held by the store. */
const allListings = () => Object.values(usePositionListingStore.getState().listings);

describe("positionListingStore", () => {
  beforeEach(() => {
    usePositionListingStore.setState({ listings: {} });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── listPosition ───────────────────────────────────────────────────────────

  describe("listPosition", () => {
    it("stores a listing keyed by its positionId", () => {
      usePositionListingStore.getState().listPosition(makeListing());

      const { listings } = usePositionListingStore.getState();
      expect(Object.keys(listings)).toEqual(["pos-1"]);
      expect(listings["pos-1"]).toMatchObject({
        positionId: "pos-1",
        askPrice: 100,
        impliedDiscount: 0.05,
        invoiceTokenId: "token-1",
      });
    });

    it("confirms ownership and stamps ownershipCheckedAt", () => {
      usePositionListingStore.getState().listPosition(makeListing());

      const stored = usePositionListingStore.getState().listings["pos-1"];
      expect(stored.ownershipConfirmed).toBe(true);
      expect(Number.isNaN(Date.parse(stored.ownershipCheckedAt as string))).toBe(false);
    });

    it("keeps multiple listings side by side", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "b" }));

      expect(allListings()).toHaveLength(2);
    });

    it("preserves the original listedAt when re-listing at a new price", () => {
      usePositionListingStore
        .getState()
        .listPosition(makeListing({ positionId: "pos-1", listedAt: "2026-01-01T00:00:00.000Z" }));

      usePositionListingStore.getState().listPosition(
        makeListing({ positionId: "pos-1", askPrice: 250, listedAt: "2026-06-01T00:00:00.000Z" }),
      );

      const stored = usePositionListingStore.getState().listings["pos-1"];
      expect(stored.askPrice).toBe(250); // price updates
      expect(stored.listedAt).toBe("2026-01-01T00:00:00.000Z"); // original list time kept
    });

    it("uses the supplied listedAt for a brand new listing", () => {
      usePositionListingStore
        .getState()
        .listPosition(makeListing({ listedAt: "2026-03-15T12:00:00.000Z" }));

      expect(usePositionListingStore.getState().listings["pos-1"].listedAt).toBe(
        "2026-03-15T12:00:00.000Z",
      );
    });
  });

  // ─── unlistPosition ─────────────────────────────────────────────────────────

  describe("unlistPosition", () => {
    it("removes the matching listing", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "b" }));

      usePositionListingStore.getState().unlistPosition("a");

      const { listings } = usePositionListingStore.getState();
      expect(listings["a"]).toBeUndefined();
      expect(listings["b"]).toBeDefined();
      expect(allListings()).toHaveLength(1);
    });

    it("is a no-op for an unknown positionId", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));

      usePositionListingStore.getState().unlistPosition("does-not-exist");

      expect(allListings()).toHaveLength(1);
    });

    it("leaves the store empty when called against an empty store", () => {
      usePositionListingStore.getState().unlistPosition("a");

      expect(allListings()).toHaveLength(0);
    });
  });

  // ─── getListing ─────────────────────────────────────────────────────────────

  describe("getListing", () => {
    it("returns the stored listing for a known positionId", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));

      expect(usePositionListingStore.getState().getListing("a")?.positionId).toBe("a");
    });

    it("returns undefined for an unknown positionId", () => {
      expect(usePositionListingStore.getState().getListing("nope")).toBeUndefined();
    });
  });

  // ─── removeStale ────────────────────────────────────────────────────────────

  describe("removeStale", () => {
    it("removes the listing and returns it", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "stale" }));

      const removed = usePositionListingStore.getState().removeStale("stale");

      expect(removed).toMatchObject({ positionId: "stale" });
      expect(usePositionListingStore.getState().listings["stale"]).toBeUndefined();
    });

    it("returns undefined and changes nothing for an unknown positionId", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "kept" }));

      const removed = usePositionListingStore.getState().removeStale("missing");

      expect(removed).toBeUndefined();
      expect(allListings()).toHaveLength(1);
    });

    it("removes only the targeted listing", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "b" }));

      usePositionListingStore.getState().removeStale("a");

      expect(Object.keys(usePositionListingStore.getState().listings)).toEqual(["b"]);
    });
  });

  // ─── reconcileListings ──────────────────────────────────────────────────────

  describe("reconcileListings", () => {
    it("drops listings the investor no longer owns and returns them as stale", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "mine" }));
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "transferred" }));

      const stale = usePositionListingStore.getState().reconcileListings(["mine"]);

      expect(stale.map((l) => l.positionId)).toEqual(["transferred"]);
      expect(Object.keys(usePositionListingStore.getState().listings)).toEqual(["mine"]);
    });

    it("keeps everything when all positions are still owned", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "b" }));

      const stale = usePositionListingStore.getState().reconcileListings(["a", "b"]);

      expect(stale).toEqual([]);
      expect(allListings()).toHaveLength(2);
    });

    it("returns an empty array when nothing is persisted", () => {
      expect(usePositionListingStore.getState().reconcileListings(["a"])).toEqual([]);
    });

    it("clears every listing when the investor owns none of them", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "b" }));

      const stale = usePositionListingStore.getState().reconcileListings([]);

      expect(stale).toHaveLength(2);
      expect(allListings()).toHaveLength(0);
    });

    it("ignores duplicate ids in the owned list", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));

      const stale = usePositionListingStore.getState().reconcileListings(["a", "a"]);

      expect(stale).toEqual([]);
      expect(allListings()).toHaveLength(1);
    });
  });

  // ─── confirmOwnership ───────────────────────────────────────────────────────

  describe("confirmOwnership", () => {
    it("marks a known listing as confirmed and stamps the check time", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));

      usePositionListingStore.getState().confirmOwnership("a");

      const stored = usePositionListingStore.getState().listings["a"];
      expect(stored.ownershipConfirmed).toBe(true);
      expect(Number.isNaN(Date.parse(stored.ownershipCheckedAt as string))).toBe(false);
    });

    it("is a no-op for an unknown positionId", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));

      usePositionListingStore.getState().confirmOwnership("missing");

      expect(Object.keys(usePositionListingStore.getState().listings)).toEqual(["a"]);
    });

    it("does not mutate unrelated listings", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "b" }));

      const before = usePositionListingStore.getState().listings["b"];
      usePositionListingStore.getState().confirmOwnership("a");

      expect(usePositionListingStore.getState().listings["b"]).toBe(before);
    });
  });

  // ─── getListingsByInvoiceToken ──────────────────────────────────────────────

  describe("getListingsByInvoiceToken", () => {
    it("returns only listings matching the given invoice token", () => {
      usePositionListingStore
        .getState()
        .listPosition(makeListing({ positionId: "a", invoiceTokenId: "token-1" }));
      usePositionListingStore
        .getState()
        .listPosition(makeListing({ positionId: "b", invoiceTokenId: "token-2" }));
      usePositionListingStore
        .getState()
        .listPosition(makeListing({ positionId: "c", invoiceTokenId: "token-1" }));

      const result = usePositionListingStore.getState().getListingsByInvoiceToken("token-1");

      expect(result.map((l) => l.positionId).sort()).toEqual(["a", "c"]);
    });

    it("returns an empty array when no listing matches", () => {
      usePositionListingStore
        .getState()
        .listPosition(makeListing({ positionId: "a", invoiceTokenId: "token-1" }));

      expect(usePositionListingStore.getState().getListingsByInvoiceToken("token-9")).toEqual([]);
    });

    it("does not match listings that omit invoiceTokenId", () => {
      usePositionListingStore
        .getState()
        .listPosition(makeListing({ positionId: "a", invoiceTokenId: undefined }));

      expect(usePositionListingStore.getState().getListingsByInvoiceToken("token-1")).toEqual([]);
    });
  });

  // ─── persistence ────────────────────────────────────────────────────────────

  describe("persistence", () => {
    it("writes listings to localStorage under the store's persist key", () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));

      const raw = localStorage.getItem(PERSIST_KEY);
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw as string);
      expect(Object.keys(parsed.state.listings)).toEqual(["a"]);
    });

    it("rehydrates persisted listings", async () => {
      const payload = {
        state: {
          listings: {
            "restored-1": makeListing({ positionId: "restored-1" }),
            "restored-2": makeListing({ positionId: "restored-2", invoiceTokenId: "token-2" }),
          },
        },
        version: 0,
      };
      localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));

      // Note: no `setState` here — the persist middleware would immediately
      // write the (empty) in-memory state back over the seeded payload.
      await usePositionListingStore.persist.rehydrate();

      const { listings } = usePositionListingStore.getState();
      expect(Object.keys(listings).sort()).toEqual(["restored-1", "restored-2"]);
      expect(listings["restored-1"].askPrice).toBe(100);
    });

    it("rehydrating with no persisted payload leaves state empty", async () => {
      usePositionListingStore.setState({ listings: {} });

      await usePositionListingStore.persist.rehydrate();

      expect(allListings()).toHaveLength(0);
    });

    it("persists removals, so unlisted positions do not come back", async () => {
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "a" }));
      usePositionListingStore.getState().listPosition(makeListing({ positionId: "b" }));

      usePositionListingStore.getState().unlistPosition("a");
      await usePositionListingStore.persist.rehydrate();

      expect(Object.keys(usePositionListingStore.getState().listings)).toEqual(["b"]);
    });
  });
});