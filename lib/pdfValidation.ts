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

