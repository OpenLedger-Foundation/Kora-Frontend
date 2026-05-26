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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GlassCard } from "@/components/ui/card";
import { useWallet } from "@/hooks/useWallet";
import { useTransaction } from "@/hooks/useTransaction";
import { useUIStore, useInvoiceStore } from "@/store";
import { prepareCreateInvoice } from "@/services/invoiceService";
import {
  createInvoiceSchema,
  invoiceDetailsStepSchema,
  INVOICE_DETAILS_STEP_FIELDS,
  type CreateInvoiceSchema,
} from "@/lib/validations/invoice";
import { cn } from "@/lib/utils";

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
  const { setWalletModalOpen } = useUIStore();
  const { createDraft, setCreateDraft, clearCreateDraft } = useInvoiceStore();
  const { execute } = useTransaction();

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    reset,
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

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const nextStep = async () => {
    const fieldsPerStep: (keyof CreateInvoiceSchema)[][] = [
      [...INVOICE_DETAILS_STEP_FIELDS],
      ["discountRate", "minInvestment"],
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
    if (!isConnected) { setWalletModalOpen(true); return; }
    if (!file) return;

    await execute(
      () =>
        prepareCreateInvoice(
          { ...data, document: file, description: "" },
          address!
        ).then((r) => r.unsignedXdr),
      {
        successMessage: "Invoice minted on Soroban!",
        onSuccess: () => {
          clearCreateDraft();
          setSubmitted(true);
        },
      }
    );
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-100">Invoice Created!</h2>
          <p className="mt-2 text-zinc-500">Your invoice NFT has been minted on Soroban.</p>
          <Link href="/dashboard/sme">
            <Button className="mt-6">View My Invoices</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
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
                  ? "border-2 border-kora-500 text-kora-400"
                  : "border border-zinc-700 text-zinc-600"
              )}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("hidden text-xs sm:block", i === step ? "text-zinc-300" : "text-zinc-600")}>
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
              <GlassCard className="p-6 space-y-4">
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
                  <Input
                    label="Invoice Amount (USDC)"
                    type="number"
                    placeholder="50000"
                    hint="Minimum 100 USDC"
                    error={errors.amount?.message}
                    {...register("amount")}
                  />
                  <Input
                    label="Due Date"
                    type="date"
                    error={errors.dueDate?.message}
                    {...register("dueDate")}
                  />
                </div>
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
              <GlassCard className="p-6 space-y-4">
                <Input
                  label="Discount Rate (%)"
                  type="number"
                  step="0.1"
                  placeholder="5.0"
                  hint="The percentage discount you offer investors (e.g. 5 = 5%)"
                  error={errors.discountRate?.message}
                  {...register("discountRate")}
                />
                <Input
                  label="Minimum Investment (USDC)"
                  type="number"
                  placeholder="1000"
                  hint="Smallest amount a single investor can contribute"
                  error={errors.minInvestment?.message}
                  {...register("minInvestment")}
                />

                {/* Preview */}
                {watch("amount") && watch("discountRate") && (
                  <div className="rounded-lg bg-zinc-800/50 p-4 space-y-2 text-sm">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Preview</p>
                    <div className="flex justify-between text-zinc-400">
                      <span>Invoice Amount</span>
                      <span>${Number(watch("amount")).toLocaleString()} {watch("currency")}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>You Receive</span>
                      <span className="text-kora-400">
                        ${(Number(watch("amount")) * (1 - Number(watch("discountRate")) / 100)).toLocaleString()} {watch("currency")}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Investor Yield</span>
                      <span className="text-emerald-400">{watch("discountRate")}%</span>
                    </div>
                  </div>
                )}
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
              <GlassCard className="p-6 space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-300">Invoice Document</p>
                  <div
                    {...getRootProps()}
                    className={cn(
                      "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                      isDragActive
                        ? "border-kora-500 bg-kora-500/5"
                        : "border-zinc-700 hover:border-zinc-600"
                    )}
                  >
                    <input {...getInputProps()} />
                    {file ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="h-8 w-8 text-kora-400" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-zinc-200">{file.name}</p>
                          <p className="text-xs text-zinc-500">
                            {(file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFile(null); }}
                          className="ml-2 text-zinc-500 hover:text-zinc-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="mx-auto h-8 w-8 text-zinc-600" />
                        <p className="mt-2 text-sm text-zinc-400">
                          Drop your invoice PDF here, or click to browse
                        </p>
                        <p className="mt-1 text-xs text-zinc-600">PDF, PNG, JPG up to 10MB</p>
                      </div>
                    )}
                  </div>
                  {!file && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                      <AlertCircle className="h-3 w-3" /> Document required to mint
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-4 text-sm space-y-1">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Summary</p>
                  <div className="flex justify-between text-zinc-400">
                    <span>Invoice</span>
                    <span className="text-zinc-200">{watch("invoiceNumber")}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Debtor</span>
                    <span className="text-zinc-200">{watch("debtorName")}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Amount</span>
                    <span className="text-zinc-200">${Number(watch("amount")).toLocaleString()} {watch("currency")}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Discount Rate</span>
                    <span className="text-kora-400">{watch("discountRate")}%</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={step === 0 && !step0Valid}
            >
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
    </div>
  );
}
