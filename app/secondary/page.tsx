"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Clock,
  Tag,
  Percent,
  User,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Container } from "@/components/layout/Container";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/components/ui/EmptyState";
import { TxSimulationPreview } from "@/components/invoice/TxSimulationPreview";
import { FeeDisclosure } from "@/components/secondary/FeeDisclosure";
import { useAcquirePositionFlow } from "@/hooks/useTransaction";
import { useWallet } from "@/hooks/useWallet";
import { env } from "@/lib/env";
import { computeAcquisitionFees, getFeeSchedule } from "@/lib/secondaryFees";
import { usePositionListingStore } from "@/store/positionListingStore";
import { useInvoiceStore } from "@/store/invoiceStore";
import { MOCK_INVOICES } from "@/services/mockData";
import { formatCurrency, formatDate, RISK_TIER_COLORS, cn } from "@/lib/utils";
import { computeImpliedDiscount } from "@/types/invoice";
import type { Invoice } from "@/types/invoice";
import { TENOR_OPTIONS, YIELD_OPTIONS } from "@/components/marketplace/filters";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { sanitizeQueryParam } from "@/lib/security";
import { useDebounce } from "@/hooks/useDebounce";
import type { PositionListingMeta } from "@/store/positionListingStore";
import {
  DEFAULT_SECONDARY_SORT,
  SECONDARY_SORT_OPTIONS,
  parseSecondarySort,
  sortSecondaryItems,
} from "@/lib/secondarySort";

interface SecondaryMarketItem {
  listing: PositionListingMeta;
  positionId: string;
  invoice: Invoice;
  investedAmount: number;
  expectedReturn: number;
  sellerAddress: string;
  remainingTenor: number;
  yieldPercent: number;
}

// Default mock secondary market listings for initial browse experience
const buildMockListings = (): SecondaryMarketItem[] => [
  {
    listing: {
      positionId: "pos_101",
      askPrice: 4850,
      impliedDiscount: computeImpliedDiscount(4850, 5000),
      listedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      invoiceTokenId: MOCK_INVOICES[0]?.tokenId ?? "101",
      ownershipConfirmed: true,
    },
    positionId: "pos_101",
    invoice: MOCK_INVOICES[0] || {
      id: "inv_1",
      tokenId: "101",
      contractAddress: "C123",
      ipfsCid: "QmTest1",
      metadata: {
        invoiceNumber: "INV-2026-001",
        issuerName: "TechCorp Ltd",
        issuerAddress: "GABC...1234",
        debtorName: "Global Logistics Inc",
        debtorAddress: "GDEF...5678",
        amount: 5000,
        currency: "USDC",
        issueDate: "2026-06-01T00:00:00Z",
        dueDate: new Date(Date.now() + 86400000 * 45).toISOString(),
        description: "Enterprise software licenses",
        jurisdiction: "US",
        category: "technology",
        documentHash: "QmTest1",
        documentUrl: "https://gateway.pinata.cloud/ipfs/QmTest1",
      },
      terms: {
        discountRate: 0.08,
        apr: 12.5,
        financingAmount: 5000,
        minInvestment: 100,
        maxInvestment: 5000,
        tenor: 45,
        repaymentDate: new Date(Date.now() + 86400000 * 45).toISOString(),
      },
      funding: {
        totalRaised: 5000,
        targetAmount: 5000,
        fundingProgress: 1,
        investorCount: 2,
        remainingCapacity: 0,
      },
      riskTier: "AA",
      riskScore: 88,
      debtorPrivacy: "full",
      status: "active",
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-02T00:00:00Z",
      ownerAddress: "GSELLER...0001",
    },
    investedAmount: 4600,
    expectedReturn: 5000,
    sellerAddress: "GSELLER1111111111111111111111111111111111111111111",
    remainingTenor: 45,
    yieldPercent: ((5000 - 4850) / 4850) * 100,
  },
  {
    listing: {
      positionId: "pos_102",
      askPrice: 9700,
      impliedDiscount: computeImpliedDiscount(9700, 10200),
      listedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      invoiceTokenId: MOCK_INVOICES[1]?.tokenId ?? "102",
      ownershipConfirmed: true,
    },
    positionId: "pos_102",
    invoice: MOCK_INVOICES[1] || {
      id: "inv_2",
      tokenId: "102",
      contractAddress: "C123",
      ipfsCid: "QmTest2",
      metadata: {
        invoiceNumber: "INV-2026-002",
        issuerName: "AgriExport Co",
        issuerAddress: "GXYZ...9999",
        debtorName: "Metro Foods Supermarkets",
        debtorAddress: "GKLM...4321",
        amount: 10200,
        currency: "USDC",
        issueDate: "2026-06-10T00:00:00Z",
        dueDate: new Date(Date.now() + 86400000 * 20).toISOString(),
        description: "Fresh produce shipment",
        jurisdiction: "KE",
        category: "agriculture",
        documentHash: "QmTest2",
        documentUrl: "https://gateway.pinata.cloud/ipfs/QmTest2",
      },
      terms: {
        discountRate: 0.06,
        apr: 14.2,
        financingAmount: 10000,
        minInvestment: 500,
        maxInvestment: 10000,
        tenor: 20,
        repaymentDate: new Date(Date.now() + 86400000 * 20).toISOString(),
      },
      funding: {
        totalRaised: 10000,
        targetAmount: 10000,
        fundingProgress: 1,
        investorCount: 4,
        remainingCapacity: 0,
      },
      riskTier: "A",
      riskScore: 79,
      debtorPrivacy: "partial",
      status: "active",
      createdAt: "2026-06-10T00:00:00Z",
      updatedAt: "2026-06-11T00:00:00Z",
      ownerAddress: "GSELLER...0002",
    },
    investedAmount: 9500,
    expectedReturn: 10200,
    sellerAddress: "GSELLER2222222222222222222222222222222222222222222",
    remainingTenor: 20,
    yieldPercent: ((10200 - 9700) / 9700) * 100,
  },
  {
    listing: {
      positionId: "pos_103",
      askPrice: 2400,
      impliedDiscount: computeImpliedDiscount(2400, 2550),
      listedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      invoiceTokenId: MOCK_INVOICES[2]?.tokenId ?? "103",
      ownershipConfirmed: true,
    },
    positionId: "pos_103",
    invoice: MOCK_INVOICES[2] || {
      id: "inv_3",
      tokenId: "103",
      contractAddress: "C123",
      ipfsCid: "QmTest3",
      metadata: {
        invoiceNumber: "INV-2026-003",
        issuerName: "MediHealth Supplies",
        issuerAddress: "GHJK...7777",
        debtorName: "City General Hospital",
        debtorAddress: "GOPQ...8888",
        amount: 2550,
        currency: "USDC",
        issueDate: "2026-05-15T00:00:00Z",
        dueDate: new Date(Date.now() + 86400000 * 75).toISOString(),
        description: "Medical equipment maintenance",
        jurisdiction: "NG",
        category: "healthcare",
        documentHash: "QmTest3",
        documentUrl: "https://gateway.pinata.cloud/ipfs/QmTest3",
      },
      terms: {
        discountRate: 0.1,
        apr: 16.8,
        financingAmount: 2400,
        minInvestment: 100,
        maxInvestment: 2400,
        tenor: 75,
        repaymentDate: new Date(Date.now() + 86400000 * 75).toISOString(),
      },
      funding: {
        totalRaised: 2400,
        targetAmount: 2400,
        fundingProgress: 1,
        investorCount: 1,
        remainingCapacity: 0,
      },
      riskTier: "BBB",
      riskScore: 71,
      debtorPrivacy: "full",
      status: "active",
      createdAt: "2026-05-15T00:00:00Z",
      updatedAt: "2026-05-16T00:00:00Z",
      ownerAddress: "GSELLER...0003",
    },
    investedAmount: 2300,
    expectedReturn: 2550,
    sellerAddress: "GSELLER3333333333333333333333333333333333333333333",
    remainingTenor: 75,
    yieldPercent: ((2550 - 2400) / 2400) * 100,
  },
];

// ─── URL param keys ────────────────────────────────────────────────────────
const PARAM_SEARCH = "q";
const PARAM_TENOR = "tenor";
const PARAM_YIELD = "yield";
const PARAM_SELLER = "seller";
const PARAM_HIGHLIGHT = "highlight";

export default function SecondaryMarketplacePage() {
  // Issue #594: acquire runs through the same simulation gate as fund/transfer.
  const { acquirePosition, simulationDialogProps } = useAcquirePositionFlow();
  const { publicKey } = useWallet();

  // Issue #597: one schedule, read from validated env, shared by every figure
  // on this page.
  const feeSchedule = useMemo(() => getFeeSchedule(env), []);

  const { listings: storeListings, removeStale } = usePositionListingStore();
  const { invoices } = useInvoiceStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Hydrate filter state from URL on mount (#599) ────────────────────────
  const [searchQuery, setSearchQuery] = useState(
    () => sanitizeQueryParam(searchParams.get(PARAM_SEARCH)) ?? ""
  );
  const [tenorFilter, setTenorFilter] = useState(
    () => sanitizeQueryParam(searchParams.get(PARAM_TENOR)) || "all"
  );
  const [yieldFilter, setYieldFilter] = useState(
    () => sanitizeQueryParam(searchParams.get(PARAM_YIELD)) || "0"
  );
  const [sellerFilter, setSellerFilter] = useState(
    () => sanitizeQueryParam(searchParams.get(PARAM_SELLER)) ?? ""
  );
  const [highlightId] = useState(() => sanitizeQueryParam(searchParams.get(PARAM_HIGHLIGHT)) ?? "");
  const [sortBy, setSortBy] = useState(() =>
    parseSecondarySort(sanitizeQueryParam(searchParams.get(PARAM_SORT)))
  );
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Debounce text inputs before committing to URL to avoid excessive pushes.
  const debouncedSearch = useDebounce(searchQuery, 350);
  const debouncedSeller = useDebounce(sellerFilter, 350);

  // ── Sync filters → URL (#599) ────────────────────────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip on the very first render so we don't create a spurious history entry.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (debouncedSearch) params.set(PARAM_SEARCH, debouncedSearch);
    if (tenorFilter && tenorFilter !== "all") params.set(PARAM_TENOR, tenorFilter);
    if (yieldFilter && yieldFilter !== "0") params.set(PARAM_YIELD, yieldFilter);
    if (debouncedSeller) params.set(PARAM_SELLER, debouncedSeller);
    if (highlightId) params.set(PARAM_HIGHLIGHT, highlightId);
    if (sortBy !== DEFAULT_SECONDARY_SORT) params.set(PARAM_SORT, sortBy);

    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [
    debouncedSearch,
    tenorFilter,
    yieldFilter,
    debouncedSeller,
    highlightId,
    sortBy,
    pathname,
    router,
  ]);

  // ── Copy shareable URL (#599) ─────────────────────────────────────────────
  const handleCopyUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  // Combine store position listings with mock defaults
  const allItems: SecondaryMarketItem[] = useMemo(() => {
    const combined = [...buildMockListings()];

    Object.values(storeListings).forEach((listing) => {
      if (combined.some((item) => item.positionId === listing.positionId)) return;
      const relatedInv = invoices.find(
        (inv) => inv.id === listing.positionId || inv.tokenId === listing.positionId
      );
      if (relatedInv) {
        const expectedReturn =
          relatedInv.terms.financingAmount * (1 + relatedInv.terms.discountRate);
        const investedAmount = relatedInv.terms.financingAmount;
        const due = new Date(relatedInv.terms.repaymentDate).getTime();
        const daysLeft = Math.max(0, Math.ceil((due - Date.now()) / (1000 * 60 * 60 * 24)));
        const yieldPercent =
          listing.askPrice > 0 ? ((expectedReturn - listing.askPrice) / listing.askPrice) * 100 : 0;

        combined.push({
          listing,
          positionId: listing.positionId,
          invoice: relatedInv,
          investedAmount,
          expectedReturn,
          sellerAddress: relatedInv.ownerAddress,
          remainingTenor: daysLeft,
          yieldPercent,
        });
      }
    });

    return combined;
  }, [storeListings, invoices]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesInvoice =
          item.invoice.metadata.debtorName.toLowerCase().includes(q) ||
          item.invoice.metadata.invoiceNumber.toLowerCase().includes(q) ||
          item.invoice.metadata.category.toLowerCase().includes(q);
        if (!matchesInvoice) return false;
      }

      if (tenorFilter !== "all") {
        const selectedTenor = TENOR_OPTIONS.find((t) => t.value === tenorFilter);
        if (selectedTenor && selectedTenor.min !== undefined && selectedTenor.max !== undefined) {
          if (item.remainingTenor < selectedTenor.min || item.remainingTenor > selectedTenor.max) {
            return false;
          }
        }
      }

      const minYieldReq = parseFloat(yieldFilter);
      if (!isNaN(minYieldReq) && minYieldReq > 0) {
        if (item.yieldPercent < minYieldReq) return false;
      }

      if (sellerFilter.trim()) {
        const s = sellerFilter.toLowerCase();
        if (!item.sellerAddress.toLowerCase().includes(s)) return false;
      }

      // Filter out expired listings
      if (item.listing.expiresAt && new Date(item.listing.expiresAt) <= new Date()) {
        return false;
      }

      return true;
    });
  }, [allItems, searchQuery, tenorFilter, yieldFilter, sellerFilter]);

  const sortedItems = useMemo(
    () => sortSecondaryItems(filteredItems, sortBy),
    [filteredItems, sortBy]
  );

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    tenorFilter !== "all" ||
    yieldFilter !== "0" ||
    sellerFilter.trim() !== "";

  const resetFilters = () => {
    setSearchQuery("");
    setTenorFilter("all");
    setYieldFilter("0");
    setSellerFilter("");
  };

  /**
   * Ownership validation before acquire (#598).
   * In mock mode we treat all listings as valid.  In live mode a real
   * ownership check would fire here.  If stale, remove + toast.
   */
  const handleAcquire = useCallback(
    (item: SecondaryMarketItem) => {
      // If the store listing explicitly has ownershipConfirmed=false the position
      // was transferred away — block the acquire and surface a message.
      const storeListing = storeListings[item.positionId];
      if (storeListing && storeListing.ownershipConfirmed === false) {
        removeStale(item.positionId);
        toast.error("Position no longer available", {
          description:
            "This position was already transferred to another buyer. The listing has been removed.",
        });
        return;
      }

      void acquirePosition(item.positionId, publicKey ?? "", item.sellerAddress);
    },
    [acquirePosition, publicKey, storeListings, removeStale]
  );

  return (
    <main className="min-h-screen bg-zinc-950 py-8 text-zinc-100">
      <Container>
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Secondary Market
              </h1>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                P2P Transferable Positions
              </Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Browse and buy active investor positions at competitive yields before maturity.
            </p>
          </div>

          {/* Share URL button (#599) */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyUrl}
            className="shrink-0 border-zinc-700 bg-zinc-900 text-xs text-zinc-300 hover:text-white"
            aria-label="Copy shareable URL for current filters"
          >
            {copied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Share View
              </>
            )}
          </Button>
        </div>

        {/* Filter Controls Bar */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search by debtor, invoice number, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(sanitizeQueryParam(e.target.value))}
                className="border-zinc-800 bg-zinc-950/80 pl-9 text-sm focus:border-primary"
                aria-label="Search secondary market listings"
              />
            </div>

            {/* Desktop Filters */}
            <div className="hidden lg:flex lg:items-center lg:gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-400" aria-hidden />
                <Select
                  value={tenorFilter}
                  onChange={(val) => setTenorFilter(sanitizeQueryParam(val))}
                  options={TENOR_OPTIONS}
                  className="w-40 border-zinc-800 bg-zinc-950/80 text-xs"
                  aria-label="Filter by remaining tenor"
                />
              </div>

              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-zinc-400" aria-hidden />
                <Select
                  value={yieldFilter}
                  onChange={(val) => setYieldFilter(sanitizeQueryParam(val))}
                  options={YIELD_OPTIONS}
                  className="w-36 border-zinc-800 bg-zinc-950/80 text-xs"
                  aria-label="Filter by minimum yield"
                />
              </div>

              <div className="relative w-44">
                <User
                  className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <Input
                  placeholder="Seller G-address..."
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(sanitizeQueryParam(e.target.value))}
                  className="h-9 border-zinc-800 bg-zinc-950/80 pl-8 text-xs"
                  aria-label="Filter by seller address"
                />
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-zinc-400" aria-hidden />
                <Select
                  value={sortBy}
                  onChange={(value) => setSortBy(parseSecondarySort(value))}
                  options={[...SECONDARY_SORT_OPTIONS]}
                  className="w-52 border-zinc-800 bg-zinc-950/80 text-xs"
                  aria-label="Sort secondary market listings"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-xs text-zinc-400 hover:text-white"
                  aria-label="Reset all filters"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Reset
                </Button>
              )}
            </div>

            {/* Mobile Filter Toggle */}
            <div className="flex items-center justify-between lg:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileFilterOpen(true)}
                className="w-full border-zinc-800 bg-zinc-950/80 text-xs"
              >
                <SlidersHorizontal className="mr-2 h-3.5 w-3.5 text-primary" aria-hidden />
                Filter Positions
                {hasActiveFilters && (
                  <Badge variant="outline" className="ml-2 bg-primary/20 text-[10px] text-primary">
                    Active
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Position Listings Grid */}
        {sortedItems.length === 0 ? (
          <EmptyState
            title="No Transferable Positions Found"
            description="No secondary market position listings match your filter criteria. Try expanding your tenor or yield requirements."
            cta={{ label: "Clear All Filters", onClick: resetFilters }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedItems.map((item) => {
              const riskColor =
                RISK_TIER_COLORS[item.invoice.riskTier] ?? "text-zinc-400 border-zinc-700";
              const isHighlighted = highlightId && item.positionId === highlightId;
              // Detect stale listing (#598): store listing with ownershipConfirmed=false
              const storeListing = storeListings[item.positionId];
              const isStale = storeListing?.ownershipConfirmed === false;

              return (
                <Card
                  key={item.positionId}
                  id={`listing-${item.positionId}`}
                  className={cn(
                    "group relative overflow-hidden border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm transition-all duration-200 hover:border-primary/50 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-primary/5",
                    isHighlighted && "border-primary/60 ring-2 ring-primary/60",
                    isStale && "border-red-500/40 opacity-60"
                  )}
                  aria-label={`Secondary listing for ${item.invoice.metadata.invoiceNumber}${isStale ? " — stale, position transferred" : ""}`}
                >
                  {isStale && (
                    <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-red-500/10 px-4 py-1.5 text-xs text-red-400">
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                      Position already transferred — listing is stale
                    </div>
                  )}

                  <CardHeader className={cn("p-5 pb-3", isStale && "pt-8")}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-zinc-400">
                            {item.invoice.metadata.invoiceNumber}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] uppercase", riskColor)}
                          >
                            {item.invoice.riskTier}
                          </Badge>
                        </div>
                        <CardTitle className="mt-1 text-base font-semibold text-white">
                          {item.invoice.metadata.debtorName || "Debtor Account"}
                        </CardTitle>
                      </div>
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold text-emerald-400">
                        +{item.yieldPercent.toFixed(1)}% Yield
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-2">
                    <div className="space-y-3">
                      {/* Financial Metrics */}
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
                            Ask Price
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {formatCurrency(item.listing.askPrice, item.invoice.metadata.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
                            Expected Return
                          </span>
                          <span className="font-medium text-zinc-300">
                            {formatCurrency(item.expectedReturn, item.invoice.metadata.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Position Details */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-primary/80" aria-hidden />
                            Remaining Tenor:
                          </span>
                          <span className="font-medium text-white">
                            {item.remainingTenor} days remaining
                          </span>
                        </div>

                        {item.listing.expiresAt && (
                          <div className="flex items-center justify-between text-zinc-400">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-warning/80" />
                              Listing Expires:
                            </span>
                            <span
                              className={cn(
                                "text-sm font-medium",
                                new Date(item.listing.expiresAt!) <= new Date()
                                  ? "text-destructive"
                                  : "text-warning"
                              )}
                            >
                              {formatDate(item.listing.expiresAt, "MMM d, HH:mm")}
                              {new Date(item.listing.expiresAt!) <= new Date() && " (Expired)"}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                            Implied Discount:
                          </span>
                          <span className="font-medium text-emerald-400">
                            {(item.listing.impliedDiscount * 100).toFixed(1)}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                            Seller Address:
                          </span>
                          <span className="font-mono text-[11px] text-zinc-300">
                            {item.sellerAddress.slice(0, 4)}...{item.sellerAddress.slice(-4)}
                          </span>
                        </div>
                      </div>

                      {/* Issue #597: disclose fees before the buyer confirms. */}
                      <FeeDisclosure
                        className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-2.5"
                        fees={computeAcquisitionFees(item.listing.askPrice, feeSchedule)}
                      />

                      {/* Action Button */}
                      <Button
                        className="mt-3 h-9 w-full bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        onClick={() => handleAcquire(item)}
                        disabled={!publicKey || isStale}
                        aria-disabled={!publicKey || isStale}
                      >
                        Acquire Position
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Issue #594: preview before signing; the dialog blocks proceed when
            the simulation fails. */}
        <TxSimulationPreview {...simulationDialogProps} />

        {/* Mobile Filter Bottom Sheet */}
        <BottomSheet
          open={mobileFilterOpen}
          onOpenChange={setMobileFilterOpen}
          title="Filter Secondary Positions"
        >
          <div className="space-y-4 p-4 text-zinc-100">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400" htmlFor="mobile-sort-by">
                  Sort By
                </label>
                <Select
                  id="mobile-sort-by"
                  value={sortBy}
                  onChange={(value) => setSortBy(parseSecondarySort(value))}
                  options={[...SECONDARY_SORT_OPTIONS]}
                  className="w-full border-zinc-800 bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400" htmlFor="mobile-tenor-filter">
                  Remaining Tenor
                </label>
                <Select
                  id="mobile-tenor-filter"
                  value={tenorFilter}
                  onChange={(val) => setTenorFilter(sanitizeQueryParam(val))}
                  options={TENOR_OPTIONS}
                  className="w-full border-zinc-800 bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400" htmlFor="mobile-yield-filter">
                  Minimum Yield
                </label>
                <Select
                  id="mobile-yield-filter"
                  value={yieldFilter}
                  onChange={(val) => setYieldFilter(sanitizeQueryParam(val))}
                  options={YIELD_OPTIONS}
                  className="w-full border-zinc-800 bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400" htmlFor="mobile-seller-filter">
                  Seller Address
                </label>
                <Input
                  id="mobile-seller-filter"
                  placeholder="Seller G-address..."
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(sanitizeQueryParam(e.target.value))}
                  className="border-zinc-800 bg-zinc-900 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={resetFilters}>
                Reset
              </Button>
              <Button className="flex-1 text-xs" onClick={() => setMobileFilterOpen(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        </BottomSheet>
      </Container>
    </main>
  );
}
