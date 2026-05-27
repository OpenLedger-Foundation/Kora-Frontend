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

export const createInvoiceSchema = z
  .object({
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
    discountRate: z.coerce
      .number()
      .min(0.5, "Min 0.5%")
      .max(20, "Max 20%")
      .transform((v) => v / 100), // store as decimal
    minInvestment: z.coerce.number().positive().min(100, "Min $100"),
    listingExpiryDate: z.string().min(1, "Listing expiry date is required"),
  })
  .refine(
    (d) => {
      if (!d.dueDate || !d.issueDate) return true;
      const due = new Date(d.dueDate);
      const issue = new Date(d.issueDate);
      return due > issue;
    },
    {
      message: "Due date must be after issue date",
      path: ["dueDate"],
    }
  )
  .refine(
    (d) => {
      if (d.minInvestment === undefined || d.amount === undefined) return true;
      return d.minInvestment <= d.amount;
    },
    {
      message: "Minimum investment cannot exceed the total invoice amount",
      path: ["minInvestment"],
    }
  )
  .refine(
    (d) => {
      if (!d.listingExpiryDate || !d.dueDate) return true;
      const due = new Date(d.dueDate);
      const expiry = new Date(d.listingExpiryDate);
      return expiry < due;
    },
    {
      message: "Listing expiry date must be strictly earlier than the due date",
      path: ["listingExpiryDate"],
    }
  );

export type CreateInvoiceSchema = z.infer<typeof createInvoiceSchema>;

export const FINANCING_TERMS_STEP_FIELDS = [
  "discountRate",
  "minInvestment",
  "listingExpiryDate",
] as const satisfies readonly (keyof CreateInvoiceSchema)[];
