"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, NumberInput, DatePicker, FileInput, Select } from "@/components/ui";
import { GlassCard } from "@/components/ui/card";
import { useWallet } from "@/hooks/useWallet";
import { useTransaction } from "@/hooks/useTransaction";
import { useUIStore, useInvoiceStore } from "@/store";
import { prepareCreateInvoice } from "@/services/invoiceService";
import {
  createInvoiceSchema,
  invoiceDetailsStepSchema,
  INVOICE_DETAILS_STEP_FIELDS,
  FINANCING_TERMS_STEP_FIELDS,
  type CreateInvoiceSchema,
} from "@/lib/validations/invoice";
import { cn } from "@/lib/utils";
import { safeStellarTxUrl } from "@/lib/security";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const TODAY = new Date().toISOString().split("T")[0];

const STEPS = ["Invoice Details", "Financing Terms", "Upload & Review"];

const JURISDICTION_OPTIONS = [
  { value: "KE", label: "Kenya" },
  { value: "NG", label: "Nigeria" },
  { value: "GH", label: "Ghana" },
  { value: "ZA", label: "South Africa" },
  { value: "US", label: "United States" },
  { value: "EU", label: "European Union" },
  { value: "UK", label: "United Kingdom" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_OPTIONS = [
  { value: "technology", label: "Technology" },
  { value: "agriculture", label: "Agriculture" },
  { value: "healthcare", label: "Healthcare" },
  { value: "construction", label: "Construction" },
  { value: "energy", label: "Energy" },
  { value: "logistics", label: "Logistics" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

export default function CreateInvoicePage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { isConnected, address } = useWallet();
  const { setWalletModalOpen, txState } = useUIStore();
  const { createDraft, setCreateDraft, clearCreateDraft } = useInvoiceStore();
  const { execute } = useTransaction();

  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [mintedInfo, setMintedInfo] = useState<{
    tokenId: string;
    txHash: string;
    metadataCid: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateInvoiceSchema>({
    resolver: zodResolver(createInvoiceSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      currency: "USDC",
      issueDate: TODAY,
      jurisdiction: "KE",
      category: "technology",
      ...createDraft,
    },
  });

  useEffect(() => {
    const subscription = watch((values) => {
      setCreateDraft(values as Partial<CreateInvoiceSchema>);
    });
    return () => subscription.unsubscribe();
  }, [watch, setCreateDraft]);

  const formValues = watch();
  const step0Valid = useMemo(
    () => invoiceDetailsStepSchema.safeParse(formValues).success,
    [formValues]
  );

  const dueDate = watch("dueDate");
  const maxExpiryDate = useMemo(() => {
    if (!dueDate) return undefined;
    const d = new Date(dueDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, [dueDate]);

  const amountVal = Number(watch("amount")) || 0;
  const discountRateVal = Number(watch("discountRate")) || 0;
  const minInvestmentVal = Number(watch("minInvestment")) || 0;
  const listingExpiryVal = watch("listingExpiryDate") || "";
  const dueDateVal = watch("dueDate") || "";

  const financingAmount = useMemo(() => {
    if (!amountVal) return 0;
    return amountVal * (1 - discountRateVal / 100);
  }, [amountVal, discountRateVal]);

  const investorYield = useMemo(() => {
    if (!amountVal) return 0;
    return amountVal - financingAmount;
  }, [amountVal, financingAmount]);

  const daysToMaturity = useMemo(() => {
    if (!listingExpiryVal || !dueDateVal) return 0;
    const expiry = new Date(listingExpiryVal);
    const due = new Date(dueDateVal);
    expiry.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - expiry.getTime();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  }, [listingExpiryVal, dueDateVal]);

  const effectiveAPR = useMemo(() => {
    if (daysToMaturity <= 0 || discountRateVal <= 0) return 0;
    const d = discountRateVal / 100;
    if (d >= 1) return 0;
    return (d / (1 - d)) * (365 / daysToMaturity) * 100;
  }, [discountRateVal, daysToMaturity]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setFileError(null);
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
    }
    if (fileRejections[0]) {
      const error = fileRejections[0].errors[0];
      if (error.code === "file-too-large") {
        setFileError("File is too large. Max size is exactly 10MB.");
      } else if (error.code === "file-invalid-type") {
        setFileError("Invalid file type. Only PDF documents are allowed.");
      } else {
        setFileError(error.message);
      }
      setFile(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const nextStep = async () => {
    const fieldsPerStep: (keyof CreateInvoiceSchema)[][] = [
      [...INVOICE_DETAILS_STEP_FIELDS],
      [...FINANCING_TERMS_STEP_FIELDS],
      [],
    ];
    const valid = await trigger(fieldsPerStep[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStep((s) => {
      const prev = Math.max(s - 1, 0);
      if (prev === 0) {
        reset({
          currency: "USDC",
          issueDate: TODAY,
          jurisdiction: "KE",
          category: "technology",
          ...createDraft,
        });
      }
      return prev;
    });
  };

  const onSubmit = async (data: CreateInvoiceSchema) => {
    if (!isConnected) {
      setWalletModalOpen(true);
      return;
    }
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    let tempMetadataCid = "";

    await execute(
      async () => {
        const result = await prepareCreateInvoice(
          { ...data, document: file, description: "" },
          address!,
          (progress) => setUploadProgress(progress)
        );
        tempMetadataCid = result.metadataCid;
        return result.unsignedXdr;
      },
      {
        successMessage: "Invoice minted on Soroban!",
        onSuccess: (hash) => {
          const mockTokenId = Math.floor(1001 + Math.random() * 8999).toString();
          setMintedInfo({
            tokenId: mockTokenId,
            txHash: hash,
            metadataCid: tempMetadataCid,
          });
          clearCreateDraft();
          setSubmitted(true);
        },
      }
    );

    setIsUploading(false);
  };

  if (submitted && mintedInfo) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 text-center backdrop-blur-md"
        >
          <div className="absolute -right-24 -top-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-kora-500/5 blur-3xl" />

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 120 }}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400"
          >
            <CheckCircle2 className="h-10 w-10" />
          </motion.div>

          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100">Invoice Minted!</h2>
          <p className="mt-3 text-sm text-zinc-400">
            Your invoice has been tokenized as an NFT on the Stellar Soroban network and is ready for funding.
          </p>

          <div className="mt-8 space-y-4 rounded-xl border border-zinc-800/85 bg-zinc-900/40 p-5 text-left text-sm backdrop-blur-sm">
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-3">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">NFT Token ID</span>
              <span className="font-mono font-bold text-zinc-200 text-base bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/50">
                #{mintedInfo.tokenId}
              </span>
            </div>

            <div className="flex justify-between items-start pt-1">
              <div className="space-y-1 w-full">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider block">Transaction Hash</span>
                <span className="font-mono text-xs text-zinc-400 break-all select-all pr-4 block">
                  {mintedInfo.txHash}
                </span>
              </div>
            </div>

            <div className="border-t border-zinc-800/60 pt-3 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">IPFS Metadata CID</span>
              <span className="font-mono text-xs text-kora-400 break-all bg-kora-500/5 border border-kora-500/10 px-2 py-0.5 rounded select-all max-w-[200px] truncate">
                {mintedInfo.metadataCid}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={safeStellarTxUrl(mintedInfo.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-300 rounded-lg transition-colors cursor-pointer"
            >
              Verify on Stellar Expert
              <ArrowRight className="h-3.5 w-3.5" />
            </a>

            <Link href="/marketplace">
              <Button className="w-full sm:w-auto bg-gradient-to-r from-kora-500 to-kora-600 hover:from-kora-600 hover:to-kora-700 text-white shadow-lg shadow-kora-500/15">
                View on Marketplace
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Create Invoice</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tokenize your invoice and access instant liquidity
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i < step
                  ? "bg-kora-500 text-white"
                  : i === step
                    ? "border-kora-500 text-kora-400 border-2"
                    : "border border-zinc-700 text-zinc-600"
              )}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden text-xs sm:block",
                i === step ? "text-zinc-300" : "text-zinc-600"
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-zinc-800" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <AnimatePresence mode="wait">
          {/* ── Step 0: Invoice Details ─────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <GlassCard className="space-y-4 p-6">
                <input type="hidden" {...register("currency")} value="USDC" />
                <input type="hidden" {...register("issueDate")} />
                <Input
                  label="Invoice Number"
                  placeholder="INV-2024-0001"
                  error={errors.invoiceNumber?.message}
                  {...register("invoiceNumber")}
                />
                <Input
                  label="Debtor Company Name"
                  placeholder="Acme Corporation Ltd"
                  error={errors.debtorName?.message}
                  {...register("debtorName")}
                />
                <Input
                  label="Debtor Address"
                  placeholder="123 Business St, City, Country"
                  error={errors.debtorAddress?.message}
                  {...register("debtorAddress")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberInput
                    label="Invoice Amount (USDC)"
                    placeholder="50000"
                    hint="Minimum 100 USDC"
                    error={errors.amount?.message}
                    success={!!watch("amount") && !errors.amount}
                    {...register("amount")}
                  />
                  <DatePicker
                    label="Due Date"
                    error={errors.dueDate?.message}
                    success={!!watch("dueDate") && !errors.dueDate}
                    min={TODAY}
                    {...register("dueDate")}
                  />
                </div>
                <Textarea
                  label="Description / Memo"
                  placeholder="Optional details or terms of the invoice..."
                  maxLength={200}
                  showCharacterCount={true}
                  error={errors.description?.message}
                  success={!!watch("description") && !errors.description}
                  {...register("description")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Jurisdiction"
                    options={JURISDICTION_OPTIONS}
                    error={errors.jurisdiction?.message}
                    {...register("jurisdiction")}
                  />
                  <Select
                    label="Industry Category"
                    options={CATEGORY_OPTIONS}
                    error={errors.category?.message}
                    {...register("category")}
                  />
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* ── Step 1: Financing Terms ─────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <GlassCard className="space-y-5 p-6">
                {/* Discount Rate Dual-Input Component */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-zinc-200" id="discount-rate-label">
                      Discount Rate (%)
                    </label>
                    <div className="w-24">
                      <Input
                        id="discount-rate-input"
                        aria-labelledby="discount-rate-label"
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="20"
                        error={errors.discountRate?.message}
                        {...register("discountRate", { valueAsNumber: true })}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setValue("discountRate", isNaN(val) ? 0.5 : val, {
                            shouldValidate: true,
                          });
                        }}
                        className="pr-7 text-right font-medium"
                        rightIcon={<span className="text-xs font-medium text-zinc-500">%</span>}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 rounded-lg border border-zinc-800/40 bg-zinc-900/40 px-3 py-2">
                    <span className="font-mono text-xs text-zinc-500">0.5%</span>
                    <input
                      type="range"
                      min="0.5"
                      max="20"
                      step="0.1"
                      value={watch("discountRate") || 0.5}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setValue("discountRate", val, { shouldValidate: true });
                      }}
                      className={cn(
                        "accent-kora-500 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 transition-all",
                        "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-lg [&::-webkit-slider-runnable-track]:bg-zinc-800/80",
                        "[&::-webkit-slider-thumb]:bg-kora-500 [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-125"
                      )}
                    />
                    <span className="font-mono text-xs text-zinc-500">20%</span>
                  </div>
                  <p className="text-xs leading-normal text-zinc-500">
                    The discount offered to investors. A higher rate attracts faster funding but
                    increases financing cost.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberInput
                    label="Minimum Investment (USDC)"
                    placeholder="1000"
                    hint="Smallest amount a single investor can contribute"
                    error={errors.minInvestment?.message}
                    success={!!watch("minInvestment") && !errors.minInvestment}
                    {...register("minInvestment")}
                  />

                  <DatePicker
                    label="Listing Expiry Date"
                    min={TODAY}
                    max={maxExpiryDate}
                    placeholder="Select expiry date..."
                    hint="When the listing period closes"
                    error={errors.listingExpiryDate?.message}
                    success={!!watch("listingExpiryDate") && !errors.listingExpiryDate}
                    {...register("listingExpiryDate")}
                  />
                </div>

                {/* Live Preview Panel */}
                <div className="relative mt-6 space-y-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 backdrop-blur-md">
                  <div className="bg-kora-500/10 pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl" />

                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                      <span className="bg-kora-500 h-1.5 w-1.5 animate-pulse rounded-full" />
                      Live Financing Preview
                    </h3>
                    {daysToMaturity > 0 && (
                      <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                        {daysToMaturity} days to maturity
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-3.5 transition-colors hover:border-zinc-800">
                      <span className="mb-1 block text-xs text-zinc-500">
                        Financing Amount (You Receive)
                      </span>
                      <span className="text-lg font-bold text-zinc-100">
                        $
                        {financingAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-xs font-normal text-zinc-500">
                          {watch("currency")}
                        </span>
                      </span>
                    </div>

                    <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-3.5 transition-colors hover:border-zinc-800">
                      <span className="mb-1 block text-xs text-zinc-500">
                        Investor Payout at Maturity
                      </span>
                      <span className="text-lg font-bold text-zinc-100">
                        $
                        {amountVal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-xs font-normal text-zinc-500">
                          {watch("currency")}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Visual Split Bar */}
                  {amountVal > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between px-0.5 text-[11px] text-zinc-500">
                        <span>
                          Capital Seek ({((financingAmount / amountVal) * 100).toFixed(0)}%)
                        </span>
                        <span>Yield Cost ({((investorYield / amountVal) * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                        <div
                          className="bg-kora-500 h-full transition-all duration-300 ease-out"
                          style={{ width: `${(financingAmount / amountVal) * 100}%` }}
                        />
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                          style={{ width: `${(investorYield / amountVal) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 pt-1 sm:grid-cols-2">
                    <div className="flex flex-col justify-between rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-3.5 transition-colors hover:border-zinc-800">
                      <div>
                        <span className="mb-1 block text-xs text-zinc-500">
                          Net Finance Cost (Yield)
                        </span>
                        <span className="text-base font-semibold text-emerald-400">
                          +$
                          {investorYield.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-xs font-normal text-zinc-500">
                            ({discountRateVal}%)
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="bg-kora-500/5 border-kora-500/20 hover:border-kora-500/30 group relative flex flex-col justify-between overflow-hidden rounded-lg border p-3.5 transition-colors">
                      <div className="bg-kora-500/10 pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full blur-xl transition-transform duration-500 group-hover:scale-150" />
                      <div>
                        <span className="text-kora-300 mb-1 block text-xs">Effective APR</span>
                        <span className="text-kora-400 bg-clip-text text-xl font-extrabold">
                          {effectiveAPR > 0 ? `${effectiveAPR.toFixed(2)}%` : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* ── Step 2: Upload & Review ─────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <GlassCard className="space-y-4 p-6">
                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-300">Invoice Document</p>
                  
                  {isUploading ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-4">
                      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                        <span className="flex items-center gap-1.5 font-medium text-kora-400">
                          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-kora-500" />
                          Uploading invoice to IPFS...
                        </span>
                        <span className="font-mono font-semibold text-zinc-300">{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-950">
                        <motion.div
                          className="bg-gradient-to-r from-kora-500 to-emerald-400 h-full rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500 leading-normal">
                        Your invoice is being pinned to IPFS. This is a necessary first step to anchor the document hash on-chain.
                      </p>
                    </div>
                  ) : (
                    <FileInput
                      value={file}
                      onChange={(e: any) => {
                        setFile(e.target.value);
                        setFileError(null);
                      }}
                      error={fileError || undefined}
                      disabled={isUploading}
                    />
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-5 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                    Summary
                  </p>

                  <div className="border-zinc-850 grid grid-cols-2 gap-x-4 gap-y-2.5 border-b pb-3 text-zinc-400">
                    <div>
                      <span className="block text-xs text-zinc-500">Invoice Number</span>
                      <span className="font-medium text-zinc-200">{watch("invoiceNumber")}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-zinc-500">Debtor Company</span>
                      <span className="font-medium text-zinc-200">{watch("debtorName")}</span>
                    </div>
                  </div>

                  <div className="border-zinc-850 grid grid-cols-2 gap-x-4 gap-y-2.5 border-b pb-3 text-zinc-400">
                    <div>
                      <span className="block text-xs text-zinc-500">Invoice Amount</span>
                      <span className="font-semibold text-zinc-200">
                        ${amountVal.toLocaleString()} {watch("currency")}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-zinc-500">Financing Capital</span>
                      <span className="text-kora-400 font-semibold">
                        ${financingAmount.toLocaleString()} {watch("currency")}
                      </span>
                    </div>
                  </div>

                  <div className="border-zinc-850 grid grid-cols-2 gap-x-4 gap-y-2.5 border-b pb-3 text-zinc-400">
                    <div>
                      <span className="block text-xs text-zinc-500">Discount Rate</span>
                      <span className="font-semibold text-emerald-400">{discountRateVal}%</span>
                    </div>
                    <div>
                      <span className="block text-xs text-zinc-500">Minimum Investment</span>
                      <span className="font-medium text-zinc-200">
                        ${minInvestmentVal.toLocaleString()} {watch("currency")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-zinc-400">
                    <div>
                      <span className="block text-xs text-zinc-500">Listing Expiry Date</span>
                      <span className="font-medium text-zinc-200">
                        {watch("listingExpiryDate") || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-zinc-500">Effective APR</span>
                      <span className="text-kora-400 font-semibold">
                        {effectiveAPR > 0 ? `${effectiveAPR.toFixed(2)}%` : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={nextStep} disabled={step === 0 && !step0Valid}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!file || !isConnected}
              onClick={!isConnected ? () => setWalletModalOpen(true) : undefined}
            >
              {!isConnected ? "Connect Wallet" : "Mint Invoice NFT"}
            </Button>
          )}
        </div>
      </form>

      {/* Transaction Interaction Overlays */}
      {txState.status === "signing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 text-center shadow-2xl backdrop-blur-xl"
          >
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-kora-500/10 text-kora-400">
              <span className="absolute inset-0 animate-ping rounded-full bg-kora-500/5" />
              <FileText className="h-10 w-10 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-zinc-100">Signature Required</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Please open your Stellar browser wallet extension and sign the transaction to authorize minting the invoice NFT on-chain.
            </p>
          </motion.div>
        </div>
      )}

      {txState.status === "submitting" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 text-center shadow-2xl backdrop-blur-xl"
          >
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-zinc-100">Submitting Transaction</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Broadcasting your transaction to the Stellar network. Waiting for ledger consensus...
            </p>
          </motion.div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
