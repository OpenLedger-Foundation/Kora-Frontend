/**
 * PDF Magic-Byte Validation
 *
 * Validates that a file's first five bytes match the "%PDF-" magic header (0x25, 0x50, 0x44, 0x46, 0x2D).
 * Uses `file.slice(0, 5)` to avoid reading large files into memory.
 */

export const PDF_MAGIC_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
export const PDF_MAGIC_STRING = "%PDF-";

export class InvalidPdfError extends Error {
  constructor(message = "Invalid PDF file: Missing %PDF- header") {
    super(message);
    this.name = "InvalidPdfError";
  }
}

/**
 * Machine-readable reason codes for file-input validation failures.
 * Consumers map these to localized messages via the i18n system.
 */
export type PdfValidationErrorCode = "empty" | "invalidType" | "invalidHeader";

export class PdfValidationError extends Error {
  readonly code: PdfValidationErrorCode;

  constructor(code: PdfValidationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "PdfValidationError";
    this.code = code;
  }
}

/**
 * Checks whether the given file starts with the %PDF- magic header.
 * Uses file.slice(0, 5) to stream only the first 5 bytes.
 * Returns true if valid, false otherwise (e.g. empty file, renamed binary, wrong header).
 */
export async function isValidPdfMagicBytes(file: File | Blob): Promise<boolean> {
  if (!file || typeof file.slice !== "function") {
    return false;
  }

  if (file.size < 5) {
    return false;
  }

  try {
    const slice = file.slice(0, 5);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length < 5) {
      return false;
    }

    for (let i = 0; i < 5; i++) {
      if (bytes[i] !== PDF_MAGIC_BYTES[i]) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Asserts that the given file starts with %PDF- magic bytes.
 * Throws InvalidPdfError if the header is invalid, empty, or unreadable.
 */
export async function assertPdfMagicBytes(file: File | Blob): Promise<void> {
  const isValid = await isValidPdfMagicBytes(file);
  if (!isValid) {
    throw new InvalidPdfError("Selected file is not a valid PDF document (missing %PDF- header)");
  }
}

/**
 * Validates an invoice attachment file and returns a machine-readable error code
 * (or null when valid). Distinguishes empty files, wrong MIME/extension, and
 * files that fail the %PDF- magic-byte check so the UI can show a clear,
 * localized message for each case.
 */
export async function validateInvoiceAttachment(file: File | Blob | null | undefined): Promise<PdfValidationErrorCode | null> {
  if (!file || file.size === 0) {
    return "empty";
  }

  const name = typeof (file as File).name === "string" ? (file as File).name : "";
  const type = typeof file.type === "string" ? file.type : "";
  const hasPdfExtension = /\.pdf$/i.test(name);
  const hasPdfMime = type === "application/pdf";

  if (!hasPdfExtension && !hasPdfMime) {
    return "invalidType";
  }

  const validHeader = await isValidPdfMagicBytes(file);
  if (!validHeader) {
    return "invalidHeader";
  }

  return null;
}

/**
 * Asserts that an invoice attachment is a valid, non-empty PDF.
 * Throws PdfValidationError with a specific code for empty, wrong-type,
 * or invalid-header files.
 */
export async function assertValidInvoiceAttachment(file: File | Blob | null | undefined): Promise<void> {
  const code = await validateInvoiceAttachment(file);
  if (code) {
    throw new PdfValidationError(code);
  }
}
