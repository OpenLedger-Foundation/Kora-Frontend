import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PositionListing } from "@/types";
import { createPersistentJSONStorage } from "./storageAdapter";

interface PositionListingState {
  /** Keyed by position id (InvestorPosition.id / InvoicePosition.invoiceId). */
  listings: Record<string, PositionListing>;
  listPosition: (listing: PositionListing) => void;
  unlistPosition: (positionId: string) => void;
  getListing: (positionId: string) => PositionListing | undefined;
}

export const usePositionListingStore = create<PositionListingState>()(
  persist(
    (set, get) => ({
      listings: {},

      listPosition: (listing) =>
        set((state) => ({
          listings: { ...state.listings, [listing.positionId]: listing },
        })),

      unlistPosition: (positionId) =>
        set((state) => {
          const next = { ...state.listings };
          delete next[positionId];
          return { listings: next };
        }),

      getListing: (positionId) => get().listings[positionId],
    }),
    {
      name: "kora-position-listings",
      storage: createPersistentJSONStorage(),
    }
  )
);
