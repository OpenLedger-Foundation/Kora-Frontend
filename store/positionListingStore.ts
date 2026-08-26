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
  /** Check and remove expired listings */
  checkAndRemoveExpired: () => string[];
  /** Check if a specific listing is expired */
  isListingExpired: (positionId: string) => boolean;
}

function isExpired(listing: PositionListing): boolean {
  if (!listing.expiresAt) return false;
  return new Date(listing.expiresAt) <= new Date();
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

      /** Check all listings and remove expired ones. Returns array of removed positionIds. */
      checkAndRemoveExpired: () =>
        set((state) => {
          const now = new Date();
          const expiredIds: string[] = [];
          const next = { ...state.listings };

          for (const [positionId, listing] of Object.entries(state.listings)) {
            if (listing.expiresAt && new Date(listing.expiresAt) <= new Date()) {
              delete next[positionId];
              expiredIds.push(positionId);
            }
          }

          return { listings: next };
        }),

      /** Check if a specific listing is expired */
      isListingExpired: (positionId) => {
        const listing = get().listings[positionId];
        return listing ? isExpired(listing) : false;
      },
    }),
    {
      name: "kora-position-listings",
      storage: createPersistentJSONStorage(),
    }
  )
);