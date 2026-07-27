import { z } from "zod";
import type { Locale } from "@/i18n/config";

/**
 * Validation message translations for Zod schemas.
 *
 * Each locale provides the full set of human-readable error messages used by
 * the invoice wizard schemas.  The factory `buildInvoiceSchemas(msgs)` in
 * invoice.ts consumes these objects so every Zod error string is locale-aware
 * at schema-construction time.
 *
 * `createLocalizedErrorMap` is kept for any remaining ad-hoc usage (e.g.
 * outside the wizard) but is superseded by the schema-factory pattern.
 */

// ─── Message contract ─────────────────────────────────────────────────────────

export interface ValidationMessages {
  // Invoice number
  invoiceNumberRequired: string;
  invoiceNumberInvalid: string;
  // Debtor
  debtorNameRequired: string;
  debtorNameMinLength: string;
  debtorAddressRequired: string;
  debtorAddressMinLength: string;
  // Amount / dates
  amountPositive: string;
  amountMin: string;
  dueDateRequired: string;
  dueDateAfterIssueDate: string;
  // Description
  descriptionMaxLength: string;
  // Financing terms
  discountRateMin: string;
  discountRateMax: string;
  minInvestmentPositive: string;
  minInvestmentMin: string;
  minInvestmentExceedsAmount: string;
  listingExpiryDateRequired: string;
  listingExpiryDateBeforeDueDate: string;
  // File upload
  fileRequired: string;
  fileType: string;
  fileSize: string;
  // Funding / repayment
  fundingAmountMinInvestment: string;
  fundingAmountExceedsCapacity: string;
  repaymentExactMatch: string;
  // User profile
  nameMinLength: string;
  emailInvalid: string;
  companyNameMinLength: string;
  walletAddressInvalid: string;
}

// ─── English ──────────────────────────────────────────────────────────────────

const enMessages: ValidationMessages = {
  invoiceNumberRequired: "Invoice number is required",
  invoiceNumberInvalid:
    "Invoice number must contain only alphanumeric characters and hyphens",
  debtorNameRequired: "Debtor name is required",
  debtorNameMinLength: "Debtor name must be at least 2 characters",
  debtorAddressRequired: "Debtor address is required",
  debtorAddressMinLength: "Debtor address must be at least 5 characters",
  amountPositive: "Amount must be positive",
  amountMin: "Minimum $100 USDC",
  dueDateRequired: "Due date is required",
  dueDateAfterIssueDate: "Due date must be after issue date",
  descriptionMaxLength: "Description cannot exceed 200 characters",
  discountRateMin: "Min 0.5%",
  discountRateMax: "Max 20%",
  minInvestmentPositive: "Minimum investment must be positive",
  minInvestmentMin: "Min $100",
  minInvestmentExceedsAmount:
    "Minimum investment cannot exceed the total invoice amount",
  listingExpiryDateRequired: "Listing expiry date is required",
  listingExpiryDateBeforeDueDate:
    "Listing expiry date must be strictly earlier than the due date",
  fileRequired: "File is required",
  fileType: "Only PDF files are allowed",
  fileSize: "File size must not exceed 10MB",
  fundingAmountMinInvestment:
    "Funding amount must be at least the minimum investment amount",
  fundingAmountExceedsCapacity:
    "Funding amount cannot exceed the remaining capacity",
  repaymentExactMatch:
    "Repayment amount must exactly match the outstanding balance",
  nameMinLength: "Name must be at least 2 characters",
  emailInvalid: "Invalid email address",
  companyNameMinLength: "Company name must be at least 2 characters",
  walletAddressInvalid: "Invalid Stellar public key format",
};

// ─── Spanish ──────────────────────────────────────────────────────────────────

const esMessages: ValidationMessages = {
  invoiceNumberRequired: "El número de factura es requerido",
  invoiceNumberInvalid:
    "El número de factura debe contener solo caracteres alfanuméricos y guiones",
  debtorNameRequired: "El nombre del deudor es requerido",
  debtorNameMinLength: "El nombre del deudor debe tener al menos 2 caracteres",
  debtorAddressRequired: "La dirección del deudor es requerida",
  debtorAddressMinLength:
    "La dirección del deudor debe tener al menos 5 caracteres",
  amountPositive: "El monto debe ser positivo",
  amountMin: "Mínimo 100 USDC",
  dueDateRequired: "La fecha de vencimiento es requerida",
  dueDateAfterIssueDate:
    "La fecha de vencimiento debe ser posterior a la fecha de emisión",
  descriptionMaxLength: "La descripción no puede exceder 200 caracteres",
  discountRateMin: "Mín 0.5%",
  discountRateMax: "Máx 20%",
  minInvestmentPositive: "La inversión mínima debe ser positiva",
  minInvestmentMin: "Mín $100",
  minInvestmentExceedsAmount:
    "La inversión mínima no puede exceder el monto total de la factura",
  listingExpiryDateRequired:
    "La fecha de expiración del listado es requerida",
  listingExpiryDateBeforeDueDate:
    "La fecha de expiración del listado debe ser estrictamente anterior a la fecha de vencimiento",
  fileRequired: "El archivo es requerido",
  fileType: "Solo se permiten archivos PDF",
  fileSize: "El tamaño del archivo no debe exceder 10MB",
  fundingAmountMinInvestment:
    "El monto de financiamiento debe ser al menos el monto de inversión mínima",
  fundingAmountExceedsCapacity:
    "El monto de financiamiento no puede exceder la capacidad restante",
  repaymentExactMatch:
    "El monto de pago debe coincidir exactamente con el saldo pendiente",
  nameMinLength: "El nombre debe tener al menos 2 caracteres",
  emailInvalid: "Dirección de correo electrónico inválida",
  companyNameMinLength:
    "El nombre de la empresa debe tener al menos 2 caracteres",
  walletAddressInvalid: "Formato de clave pública de Stellar inválido",
};

// ─── Arabic ───────────────────────────────────────────────────────────────────

const arMessages: ValidationMessages = {
  invoiceNumberRequired: "رقم الفاتورة مطلوب",
  invoiceNumberInvalid:
    "يجب أن يحتوي رقم الفاتورة على أحرف وأرقام وشرطات فقط",
  debtorNameRequired: "اسم المدين مطلوب",
  debtorNameMinLength: "يجب أن يتكون اسم المدين من حرفين على الأقل",
  debtorAddressRequired: "عنوان المدين مطلوب",
  debtorAddressMinLength: "يجب أن يتكون عنوان المدين من 5 أحرف على الأقل",
  amountPositive: "يجب أن يكون المبلغ موجبًا",
  amountMin: "الحد الأدنى 100 USDC",
  dueDateRequired: "تاريخ الاستحقاق مطلوب",
  dueDateAfterIssueDate: "يجب أن يكون تاريخ الاستحقاق بعد تاريخ الإصدار",
  descriptionMaxLength: "لا يمكن أن يتجاوز الوصف 200 حرف",
  discountRateMin: "الحد الأدنى 0.5%",
  discountRateMax: "الحد الأقصى 20%",
  minInvestmentPositive: "يجب أن يكون الحد الأدنى للاستثمار موجبًا",
  minInvestmentMin: "الحد الأدنى 100 دولار",
  minInvestmentExceedsAmount:
    "لا يمكن أن يتجاوز الحد الأدنى للاستثمار إجمالي قيمة الفاتورة",
  listingExpiryDateRequired: "تاريخ انتهاء الإدراج مطلوب",
  listingExpiryDateBeforeDueDate:
    "يجب أن يكون تاريخ انتهاء الإدراج قبل تاريخ الاستحقاق",
  fileRequired: "الملف مطلوب",
  fileType: "يُسمح فقط بملفات PDF",
  fileSize: "يجب ألا يتجاوز حجم الملف 10 ميغابايت",
  fundingAmountMinInvestment:
    "يجب أن لا يقل مبلغ التمويل عن الحد الأدنى للاستثمار",
  fundingAmountExceedsCapacity: "لا يمكن أن يتجاوز مبلغ التمويل الطاقة المتبقية",
  repaymentExactMatch: "يجب أن يطابق مبلغ السداد الرصيد المستحق تمامًا",
  nameMinLength: "يجب أن يتكون الاسم من حرفين على الأقل",
  emailInvalid: "عنوان البريد الإلكتروني غير صالح",
  companyNameMinLength: "يجب أن يتكون اسم الشركة من حرفين على الأقل",
  walletAddressInvalid: "تنسيق مفتاح Stellar العام غير صالح",
};

// ─── Portuguese (Brazil) ──────────────────────────────────────────────────────

const ptBRMessages: ValidationMessages = {
  invoiceNumberRequired: "O número da fatura é obrigatório",
  invoiceNumberInvalid:
    "O número da fatura deve conter apenas caracteres alfanuméricos e hifens",
  debtorNameRequired: "O nome do devedor é obrigatório",
  debtorNameMinLength: "O nome do devedor deve ter pelo menos 2 caracteres",
  debtorAddressRequired: "O endereço do devedor é obrigatório",
  debtorAddressMinLength:
    "O endereço do devedor deve ter pelo menos 5 caracteres",
  amountPositive: "O valor deve ser positivo",
  amountMin: "Mínimo $100 USDC",
  dueDateRequired: "A data de vencimento é obrigatória",
  dueDateAfterIssueDate:
    "A data de vencimento deve ser posterior à data de emissão",
  descriptionMaxLength: "A descrição não pode exceder 200 caracteres",
  discountRateMin: "Mín 0,5%",
  discountRateMax: "Máx 20%",
  minInvestmentPositive: "O investimento mínimo deve ser positivo",
  minInvestmentMin: "Mín $100",
  minInvestmentExceedsAmount:
    "O investimento mínimo não pode exceder o valor total da fatura",
  listingExpiryDateRequired: "A data de expiração da listagem é obrigatória",
  listingExpiryDateBeforeDueDate:
    "A data de expiração da listagem deve ser estritamente anterior à data de vencimento",
  fileRequired: "O arquivo é obrigatório",
  fileType: "Apenas arquivos PDF são permitidos",
  fileSize: "O tamanho do arquivo não deve exceder 10MB",
  fundingAmountMinInvestment:
    "O valor do financiamento deve ser pelo menos o valor mínimo de investimento",
  fundingAmountExceedsCapacity:
    "O valor do financiamento não pode exceder a capacidade restante",
  repaymentExactMatch:
    "O valor do reembolso deve corresponder exatamente ao saldo pendente",
  nameMinLength: "O nome deve ter pelo menos 2 caracteres",
  emailInvalid: "Endereço de e-mail inválido",
  companyNameMinLength:
    "O nome da empresa deve ter pelo menos 2 caracteres",
  walletAddressInvalid: "Formato de chave pública Stellar inválido",
};

// ─── Locale map ───────────────────────────────────────────────────────────────

const messagesByLocale: Record<Locale, ValidationMessages> = {
  en: enMessages,
  es: esMessages,
  ar: arMessages,
  "pt-BR": ptBRMessages,
};

/**
 * Returns the full set of validation messages for the given locale.
 * Falls back to English for any unknown locale.
 */
export function getValidationMessages(locale: Locale): ValidationMessages {
  return messagesByLocale[locale] ?? enMessages;
}

// ─── Zod error-map (ad-hoc usage) ────────────────────────────────────────────

/**
 * Creates a Zod `ZodErrorMap` that overrides messages using the locale-specific
 * message set.  Intended for ad-hoc schema usage outside the wizard.
 *
 * NOTE: The invoice wizard uses the schema-factory pattern (`buildInvoiceSchemas`)
 * which bakes messages directly into schema definitions, so this error map is
 * NOT required there.
 */

export function createLocalizedErrorMap(locale: Locale): z.ZodErrorMap {
  const messages = getValidationMessages(locale);

  return (issue, ctx): { message: string } => {
    switch (issue.code) {
      case z.ZodIssueCode.too_small: {
        const path = issue.path.join(".");
        if (issue.type === "number") {
          if (path === "amount" || path === "amount") return { message: messages.amountMin };
          if (path === "minInvestment") return { message: messages.minInvestmentMin };
          if (path === "discountRate" && issue.minimum === 0.5)
            return { message: messages.discountRateMin };
        }
        if (issue.type === "string") {
          if (path === "invoiceNumber") return { message: messages.invoiceNumberRequired };
          if (path === "debtorName") return { message: messages.debtorNameRequired };
          if (path === "debtorAddress") return { message: messages.debtorAddressRequired };
          if (path === "dueDate") return { message: messages.dueDateRequired };
          if (path === "listingExpiryDate")
            return { message: messages.listingExpiryDateRequired };
          if (path === "name") return { message: messages.nameMinLength };
          if (path === "companyName") return { message: messages.companyNameMinLength };
        }
        return { message: ctx.defaultError };
      }

      case z.ZodIssueCode.too_big: {
        const path = issue.path.join(".");
        if (path === "discountRate" && issue.maximum === 20)
          return { message: messages.discountRateMax };
        if (path === "description") return { message: messages.descriptionMaxLength };
        return { message: ctx.defaultError };
      }

      case z.ZodIssueCode.invalid_string: {
        if (issue.validation === "email") return { message: messages.emailInvalid };
        if (issue.validation === "regex") {
          const path = issue.path.join(".");
          if (path === "invoiceNumber") return { message: messages.invoiceNumberInvalid };
          if (path === "walletAddress") return { message: messages.walletAddressInvalid };
        }
        return { message: ctx.defaultError };
      }

      case z.ZodIssueCode.custom: {
        // Refinement errors — fall through to ctx.defaultError so schema-embedded
        // messages (already localised by the factory) are preserved.
        return { message: issue.message ?? ctx.defaultError };
      }

      default:
        return { message: ctx.defaultError };
    }
  };
}
