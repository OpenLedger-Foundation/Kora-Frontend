import { z } from "zod";

/** Step 1 — invoice details (USDC only) */
export const invoiceDetailsStepSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  debtorName: z.string().min(2, "Debtor name is required"),
  debtorAddress: z.string().min(5, "Debtor address is required"),
  amount: z.coerce.number().positive("Amount must be positive").min(100, "Minimum $100 USDC"),
  dueDate: z.string().min(1, "Due date is required"),
  jurisdiction: z.enum(["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"]),
  category: z.enum([
    "technology",
    "manufacturing",
    "logistics",
    "healthcare",
    "retail",
    "construction",
    "agriculture",
    "energy",
    "finance",
    "other",
  ]),
});

export type InvoiceDetailsStepSchema = z.infer<typeof invoiceDetailsStepSchema>;

export const INVOICE_DETAILS_STEP_FIELDS = [
  "invoiceNumber",
  "debtorName",
  "debtorAddress",
  "amount",
  "dueDate",
  "jurisdiction",
  "category",
] as const satisfies readonly (keyof InvoiceDetailsStepSchema)[];

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  debtorName: z.string().min(2, "Debtor name is required"),
  debtorAddress: z.string().min(5, "Debtor address is required"),
  amount: z.coerce.number().positive("Amount must be positive").min(100, "Minimum $100"),
  currency: z.enum(["USDC", "EURC", "XLM"]),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  description: z.string().optional(),
  jurisdiction: z.enum(["US", "EU", "UK", "NG", "KE", "GH", "ZA", "OTHER"]),
  category: z.enum([
    "technology", "manufacturing", "logistics", "healthcare",
    "retail", "construction", "agriculture", "energy", "finance", "other",
  ]),
  discountRate: z.coerce
    .number()
    .min(0.5, "Min 0.5%")
    .max(30, "Max 30%")
    .transform((v) => v / 100), // store as decimal
  minInvestment: z.coerce.number().positive().min(100, "Min $100"),
}).refine((d) => new Date(d.dueDate) > new Date(d.issueDate), {
  message: "Due date must be after issue date",
  path: ["dueDate"],
});

export type CreateInvoiceSchema = z.infer<typeof createInvoiceSchema>;
