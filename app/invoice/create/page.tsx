"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FileRejection, useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, NumberInput, DatePicker, FileInput, Select } from "@/components/ui";
import { GlassCard } from "@/components/ui/card";
import { useWallet } from "@/hooks/useWallet";
import { useWalletStore } from "@/store";
import { useTransaction } from "@/hooks/useTransaction";
import { useTxSimulation } from "@/hooks/useTxSimulation";
import { TxSimulationPreview } from "@/components/invoice/TxSimulationPreview";
import { useUIStore, useInvoiceStore } from "@/store";
import { prepareCreateInvoice } from "@/services/invoiceService";
import {
  createInvoiceSchema,
  invoiceDetailsStepSchema,
  financingTermsSchema,
  INVOICE_DETAILS_STEP_FIELDS,
  FINANCING_TERMS_STEP_FIELDS,
  type CreateInvoiceSchema,
} from "@/lib/validations/invoice";
import { cn, isValidStellarAddress } from "@/lib/utils";
import { safeStellarTxUrl } from "@/lib/security";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const TODAY = new Date().toISOString().split("T")[0];

export default function CreateInvoicePage() {
  const t = useTranslations("createInvoice");
  
  const STEPS = [t("steps.details"), t("steps.terms"), t("steps.review")];

  const JURISDICTION_OPTIONS = [
    { value: "KE", label: t("jurisdictions.KE") },
    { value: "NG", label: t("jurisdictions.NG") },
    { value: "GH", label: t("jurisdictions.GH") },
    { value: "ZA", label: t("jurisdictions.ZA") },
    { value: "US", label: t("jurisdictions.US") },
    { value: "EU", label: t("jurisdictions.EU") },
    { value: "UK", label: t("jurisdictions.UK") },
    { value: "OTHER", label: t("jurisdictions.OTHER") },
  ];

  const CATEGORY_OPTIONS = [
    { value: "technology", label: t("categories.technology") },
    { value: "agriculture", label: t("categories.agriculture") },
    { value: "healthcare", label: t("categories.healthcare") },
    { value: "construction", label: t("categories.construction") },
    { value: "energy", label: t("categories.energy") },
    { value: "logistics", label: t("categories.logistics") },
    { value: "manufacturing", label: t("categories.manufacturing") },
    { value: "retail", label: t("categories.retail") },
    { value: "finance", label: t("categories.finance") },
    { value: "other", label: t("categories.other") },
  ];

  const PRIVACY_OPTIONS = [
    { value: "full", label: t("privacy.full") },
    { value: "partial", label: t("privacy.partial") },
    { value: "anonymized", label: t("privacy.anonymized") },
  ];

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { isConnected, address, signMessage } = useWallet();
  const { setWalletModalOpen } = useUIStore();
  const { createDraft, setCreateDraft, clearCreateDraft } = useInvoiceStore();
  const { execute, status: txStatus, error: txError, reset: resetTxState } = useTransaction();
  const { simulationDialogProps, onSimulationPreview } = useTxSimulation();

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
      debtorPrivacy: "full",
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
  const step1Valid = useMemo(
    () => financingTermsSchema.safeParse(formValues).success,
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

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
    setFileError(null);
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
    }
    if (fileRejections[0]) {
      const error = fileRejections[0].errors[0];
      if (error.code === "file-too-large") {
        setFileError(t("upload.errors.tooLarge"));
      } else if (error.code === "file-invalid-type") {
        setFileError(t("upload.errors.invalidType"));
      } else {
        setFileError(error.message);
      }
      setFile(null);
    }
  }, [t]);

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
    if (!file) {
      setFileError(t("upload.errors.required"));
      return;
    }

    setFileError(null);
    setIsUploading(true);
    setUploadProgress(0);

    let tempMetadataCid = "";

    await execute(
      async () => {
        const result = await prepareCreateInvoice(
          { ...data, document: file, description: "" },
          address!,
          (progress) => setUploadProgress(progress),
          signMessage
        );
        tempMetadataCid = result.metadataCid;
        return result.unsignedXdr;
      },
      {
        successMessage: t("success.title"),
        onSimulationPreview,
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

          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100">{t("success.title")}</h2>
          <p className="mt-3 text-sm text-zinc-400">
            {t("success.subtitle")}
          </p>

          <div className="mt-8 space-y-4 rounded-xl border border-zinc-800/85 bg-zinc-900/40 p-5 text-left text-sm backdrop-blur-sm">
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-3">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{t("success.tokenId")}</span>
              <span className="font-mono font-bold text-zinc-200 text-base bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/50">
                #{mintedInfo.tokenId}
              </span>
            </div>

            <div className="flex justify-between items-start pt-1">
              <div className="space-y-1 w-full">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider block">{t("success.txHash")}</span>
                <span className="font-mono text-xs text-zinc-400 break-all select-all pr-4 block">
                  {mintedInfo.txHash}
                </span>
              </div>
            </div>

            <div className="border-t border-zinc-800/60 pt-3 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{t("success.ipfsCid")}</span>
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
              {t("success.verifyStellar")}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>

            <Link href="/marketplace">
              <Button className="w-full sm:w-auto bg-gradient-to-r from-kora-500 to-kora-600 hover:from-kora-600 hover:to-kora-700 text-white shadow-lg shadow-kora-500/15">
                {t("success.viewMarketplace")}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <ErrorBoundary>
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t("subtitle")}
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
                  label={t("fields.invoiceNumber")}
                  placeholder={t("fields.invoiceNumberPlaceholder")}
                  error={errors.invoiceNumber?.message}
                  {...register("invoiceNumber")}
                />
                <Input
                  label={t("fields.debtorName")}
                  placeholder={t("fields.debtorNamePlaceholder")}
                  error={errors.debtorName?.message}
                  {...register("debtorName")}
                />
                <div>
                  <Input
                    label={t("fields.debtorAddress")}
                    placeholder={t("fields.debtorAddressPlaceholder")}
                    error={errors.debtorAddress?.message}
                    list="address-book-list"
                    {...register("debtorAddress")}
                  />
                  <datalist id="address-book-list">
                    {useWalletStore.getState().addressBook.map((e) => (
                      <option key={e.id} value={e.address}>{e.label || e.address}</option>
                    ))}
                  </datalist>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const val = (document.querySelector('input[name="debtorAddress"]') as HTMLInputElement)?.value;
                        if (!val) return alert(t("addressBook.noAddress"));
                        if (!isValidStellarAddress(val)) return alert(t("addressBook.invalidAddress"));
                        useWalletStore.getState().addAddressBookEntry(val, "");
                        alert(t("addressBook.saved"));
                      }}
                      className="rounded-lg px-3 py-1 text-sm"
                    >
                      {t("fields.addToAddressBook")}
                    </button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberInput
                    label={t("fields.invoiceAmount")}
                    placeholder="50000"
                    hint={t("fields.invoiceAmountHint")}
                    error={errors.amount?.message}
                    success={!!watch("amount") && !errors.amount}
                    {...register("amount")}
                  />
                  <DatePicker
                    label={t("fields.dueDate")}
                    error={errors.dueDate?.message}
                    success={!!watch("dueDate") && !errors.dueDate}
                    min={TODAY}
                    {...register("dueDate")}
                  />
                </div>
                <Textarea
                  label={t("fields.description")}
                  placeholder={t("fields.descriptionPlaceholder")}
                  maxLength={200}
                  showCharacterCount={true}
                  error={errors.description?.message}
                  success={!!watch("description") && !errors.description}
                  {...register("description")}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label={t("fields.jurisdiction")}
                    options={JURISDICTION_OPTIONS}
                    error={errors.jurisdiction?.message}
                    {...register("jurisdiction")}
                  />
                  <Select
                    label={t("fields.category")}
                    options={CATEGORY_OPTIONS}
                    error={errors.category?.message}
                    {...register("category")}
                  />
                </div>

                <Select
                  label={t("fields.debtorPrivacy")}
                  options={PRIVACY_OPTIONS}
                  error={errors.debtorPrivacy?.message}
                  {...register("debtorPrivacy")}
                />

                <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/70 p-5 shadow-inner shadow-zinc-950/20">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                        {t("preview.title")}
                      </p>
                      <p className="text-xs text-zinc-400">{t("preview.subtitle")}</p>
                    </div>
                    <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                      {t("preview.step")}
                    </span>
                  </div>

                  <div className="grid gap-3 pt-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("preview.invoice")}</p>
                      <p className="mt-2 text-base font-semibold text-zinc-100">
                        {watch("invoiceNumber") || t("preview.invoicePlaceholder")}
                      </p>
                      <p className="text-sm text-zinc-400 mt-1">
                        {watch("description") || t("preview.descriptionPlaceholder")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("preview.debtor")}</p>
                      <p className="mt-2 text-base font-semibold text-zinc-100">
                        {watch("debtorName") || t("preview.debtorPlaceholder")}
                      </p>
                      <p className="text-sm text-zinc-400 mt-1">
                        {watch("debtorAddress") || t("preview.debtorAddressPlaceholder")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("preview.amount")}</span>
                      <p className="mt-2 text-lg font-semibold text-zinc-100">
                        ${amountVal.toLocaleString()} {watch("currency")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("preview.dueDate")}</span>
                      <p className="mt-2 text-lg font-semibold text-zinc-100">
                        {watch("dueDate") || t("preview.selectDueDate")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t("preview.jurisdiction")}</span>
                      <p className="mt-2 text-lg font-semibold text-zinc-100">
                        {JURISDICTION_OPTIONS.find((option) => option.value === watch("jurisdiction"))?.label || t("preview.select")}
                      </p>
                    </div>
                  </div>
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
                      {t("fields.discountRate")}
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
                    {t("discountRateDesc")}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberInput
                    label={t("fields.minInvestment")}
                    placeholder="1000"
                    hint={t("fields.minInvestmentHint")}
                    error={errors.minInvestment?.message}
                    success={!!watch("minInvestment") && !errors.minInvestment}
                    {...register("minInvestment")}
                  />

                  <DatePicker
                    label={t("fields.listingExpiry")}
                    min={TODAY}
                    max={maxExpiryDate}
                    placeholder="Select expiry date..."
                    hint={t("fields.listingExpiryHint")}
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
                      {t("financingPreview.title")}
                    </h3>
                    {daysToMaturity > 0 && (
                      <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                        {t("financingPreview.daysToMaturity", { count: daysToMaturity })}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/60 p-3.5 transition-colors hover:border-zinc-800">
                      <span className="mb-1 block text-xs text-zinc-500">
                        {t("financingPreview.youReceive")}
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
                        {t("financingPreview.investorPayout")}
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
                          {t("financingPreview.capitalSeek", { percent: ((financingAmount / amountVal) * 100).toFixed(0) })}
                        </span>
                        <span>{t("financingPreview.yieldCost", { percent: ((investorYield / amountVal) * 100).toFixed(0) })}</span>
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
                  <p className="mb-2 text-sm font-medium text-zinc-300">{t("upload.title")}</p>
                  
                  {isUploading ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-4">
                      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                        <span className="flex items-center gap-1.5 font-medium text-kora-400">
                          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-kora-500" />
                          {t("uploadProgress.title")}
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
                        {t("uploadProgress.description")}
                      </p>
                    </div>
                  ) : (
                    <FileInput
                      value={file}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setFile(e.target.files?.[0] ?? null);
                        setFileError(null);
                      }}
                      error={fileError || undefined}
                      disabled={isUploading}
                    />
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-5 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                    {t("reviewSummary.title")}
                  </p>

                  <div className="border-zinc-850 grid grid-cols-2 gap-x-4 gap-y-2.5 border-b pb-3 text-zinc-400">
                    <div>
                      <span className="block text-xs text-zinc-500">{t("reviewSummary.invoiceNumber")}</span>
                      <span className="font-medium text-zinc-200">{watch("invoiceNumber")}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-zinc-500">{t("reviewSummary.debtorCompany")}</span>
                      <span className="font-medium text-zinc-200">{watch("debtorName")}</span>
                    </div>
                  </div>

                  <div className="border-zinc-850 grid grid-cols-2 gap-x-4 gap-y-2.5 border-b pb-3 text-zinc-400">
                    <div>
                      <span className="block text-xs text-zinc-500">{t("reviewSummary.invoiceAmount")}</span>
                      <span className="font-semibold text-zinc-200">
                        ${amountVal.toLocaleString()} {watch("currency")}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-zinc-500">{t("reviewSummary.financingCapital")}</span>
                      <span className="text-kora-400 font-semibold">
                        ${financingAmount.toLocaleString()} {watch("currency")}
                      </span>
                    </div>
                  </div>

                  <div className="border-zinc-850 grid grid-cols-2 gap-x-4 gap-y-2.5 border-b pb-3 text-zinc-400">
                    <div>
                      <span className="block text-xs text-zinc-500">{t("reviewSummary.discountRate")}</span>
                      <span className="font-semibold text-emerald-400">{discountRateVal}%</span>
                    </div>
                    <div>
                      <span className="block text-xs text-zinc-500">{t("reviewSummary.minimumInvestment")}</span>
                      <span className="font-medium text-zinc-200">
                        ${minInvestmentVal.toLocaleString()} {watch("currency")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-zinc-400">
                    <div>
                      <span className="block text-xs text-zinc-500">{t("reviewSummary.listingExpiryDate")}</span>
                      <span className="font-medium text-zinc-200">
                        {watch("listingExpiryDate") || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-zinc-500">{t("reviewSummary.effectiveApr")}</span>
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
            <ArrowLeft className="h-4 w-4" /> {t("navigation.back")}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={
                (step === 0 && !step0Valid) ||
                (step === 1 && !step1Valid)
              }
            >
              {t("navigation.next")} <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!file || !isConnected || isUploading || txStatus === "signing" || txStatus === "submitting" || txStatus === "polling"}
              onClick={!isConnected ? () => setWalletModalOpen(true) : undefined}
            >
              {!isConnected ? t("review.connectToMint") : t("review.mintButton")}
            </Button>
          )}
        </div>
      </form>

      {/* Transaction Interaction Overlays */}
      {(txStatus === "signing" || txStatus === "submitting" || txStatus === "polling") && (
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
            <h3 className="text-xl font-bold text-zinc-100">
              {txStatus === "signing" ? t("minting.title") : t("minting.title")}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {txStatus === "signing"
                ? t("minting.subtitleSigning")
                : t("minting.subtitleSubmitting")}
            </p>
          </motion.div>
        </div>
      )}

      {txStatus === "failed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 text-center shadow-2xl backdrop-blur-xl"
          >
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-zinc-100">{t("minting.failedTitle")}</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {txError || t("minting.failedSubtitle")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  resetTxState();
                }}
              >
                {t("transaction.dismiss")}
              </Button>
              <Button
                onClick={() => {
                  resetTxState();
                  handleSubmit(onSubmit)();
                }}
              >
                {t("transaction.retry")}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
      </ErrorBoundary>

      {/* Transaction simulation preview dialog — rendered outside the form */}
      <TxSimulationPreview {...simulationDialogProps} />
    </>
  );
}
