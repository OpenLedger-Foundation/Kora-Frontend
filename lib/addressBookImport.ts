/**
 * Address book import validation and utilities.
 * 
 * Provides utilities for safely importing address books with cryptographic
 * verification of label signatures to prevent tampering and phishing attacks.
 */

import { verifySignedLabel, isLabelVerified, type SignedLabel } from "@/store/walletStore";
import { isValidStellarAddress } from "./utils";

/** Maximum entries accepted from a single import (#1139). */
export const MAX_IMPORT_ENTRIES = 500;
/** Maximum size of the raw JSON accepted for import, in characters. */
export const MAX_IMPORT_CHARS = 1_000_000;
/** Maximum label length; longer labels are rejected rather than truncated. */
export const MAX_LABEL_LENGTH = 100;

export interface AddressBookEntry {
  id?: string;
  address: string;
  label?: string;
  signedLabel?: SignedLabel;
  groupIds?: string[];
  isFavorite?: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: AddressBookEntry[];
  rejected: RejectedEntry[];
  warnings: string[];
}

export interface RejectedEntry {
  entry: Partial<AddressBookEntry>;
  reason: string;
}

/**
 * Validate a single address book entry for import.
 * 
 * Returns a list of validation errors (empty if valid).
 * 
 * Rules:
 * - Address must be a valid Stellar public key
 * - Label (if present) must be a non-empty string
 * - If signedLabel is present, it must pass cryptographic verification
 * - Empty labels are allowed but signedLabel requires matching label
 */
export function validateAddressBookEntry(entry: Partial<AddressBookEntry>): string[] {
  const errors: string[] = [];

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return ["Entry must be an object"];
  }

  // Validate address. isValidStellarAddress checks the StrKey version byte
  // and CRC16 checksum, so a single mistyped character is rejected.
  if (!entry.address) {
    errors.push("Missing address");
  } else if (typeof entry.address !== "string") {
    errors.push("Address must be a string");
  } else if (entry.address !== entry.address.trim()) {
    // Reject rather than silently trim: a padded address would otherwise
    // pass validation but be stored (and deduped) with the whitespace.
    errors.push("Address must not contain leading or trailing whitespace");
  } else if (!isValidStellarAddress(entry.address)) {
    errors.push(`Invalid Stellar address format: ${entry.address}`);
  }

  // Validate label
  if (entry.label !== undefined && typeof entry.label !== "string") {
    errors.push("Label must be a string");
  } else if (typeof entry.label === "string" && entry.label.length > MAX_LABEL_LENGTH) {
    errors.push(`Label must be at most ${MAX_LABEL_LENGTH} characters`);
  }

  // Validate signedLabel cryptographically
  if (entry.signedLabel) {
    if (!entry.address) {
      errors.push("Cannot verify signed label without address");
    } else {
      // Check that the signed label matches the entry
      if (entry.signedLabel.address !== entry.address) {
        errors.push(
          `Signed label address mismatch: label claims ${entry.signedLabel.address} but entry has ${entry.address}`
        );
      }

      if (entry.label && entry.signedLabel.label !== entry.label) {
        errors.push(
          "Label text does not match signed label (tampering detected)"
        );
      }

      // Verify the signature
      if (!verifySignedLabel(entry.signedLabel)) {
        errors.push("Invalid or tampered signature on label");
      }
    }
  }

  // Validate groupIds
  if (entry.groupIds !== undefined) {
    if (!Array.isArray(entry.groupIds)) {
      errors.push("groupIds must be an array");
    } else if (
      entry.groupIds.some((id) => typeof id !== "string" || !id.trim())
    ) {
      errors.push("All groupIds must be non-empty strings");
    }
  }

  return errors;
}

/**
 * Validate and import an address book from JSON.
 * 
 * Performs comprehensive validation:
 * - Checks each entry for format and cryptographic validity
 * - Rejects entries with invalid signatures (indicates tampering)
 * - Warns about unsigned labels (may be phishing risk)
 * - Filters out duplicates
 * 
 * Returns detailed import result with lists of:
 * - Imported entries (passed validation)
 * - Rejected entries (with reasons)
 * - Warnings (e.g., unsigned labels)
 */
export function importAddressBook(
  jsonText: string,
  options?: {
    allowUnsigned?: boolean; // If false, warns about unsigned labels
    /** Addresses already in the address book; matching entries are rejected. */
    existingAddresses?: Iterable<string>;
    /** Override MAX_IMPORT_ENTRIES (e.g. remaining capacity of the book). */
    maxEntries?: number;
  }
): ImportResult {
  const result: ImportResult = {
    success: false,
    imported: [],
    rejected: [],
    warnings: [],
  };

  if (typeof jsonText !== "string" || jsonText.length > MAX_IMPORT_CHARS) {
    result.warnings.push(
      `Import file is too large (limit ${MAX_IMPORT_CHARS.toLocaleString("en-US")} characters)`
    );
    return result;
  }

  // Parse JSON
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch (error) {
    result.warnings.push(`Failed to parse JSON: ${error}`);
    return result;
  }

  // Ensure we have an array
  if (!Array.isArray(data)) {
    if (data && typeof data === "object" && "addressBook" in data) {
      // Handle wrapped format: { addressBook: [...] }
      data = data.addressBook;
      if (!Array.isArray(data)) {
        result.warnings.push("Expected `addressBook` to be an array of entries");
        return result;
      }
    } else if (data && typeof data === "object") {
      // Handle single-entry wrapped format
      data = [data];
    } else {
      result.warnings.push("Expected JSON array of address book entries");
      return result;
    }
  }

  // Cap the number of entries. Excess entries are rejected (not silently
  // dropped) so the user can see exactly what was left out.
  // A non-finite override (NaN, Infinity) would make the comparison below
  // always false and silently disable the cap, so fall back to the default.
  const requested = options?.maxEntries;
  const maxEntries =
    typeof requested === "number" && Number.isFinite(requested)
      ? Math.max(0, Math.floor(requested))
      : MAX_IMPORT_ENTRIES;
  if (data.length > maxEntries) {
    result.warnings.push(
      `Import contains ${data.length} entries; only the first ${maxEntries} were processed`
    );
    for (const extra of data.slice(maxEntries)) {
      result.rejected.push({ entry: extra, reason: `Exceeds import limit of ${maxEntries} entries` });
    }
    data = data.slice(0, maxEntries);
  }

  // Validate and filter entries
  const seenAddresses = new Set<string>();
  const existing = new Set<string>();
  for (const address of options?.existingAddresses ?? []) {
    if (typeof address === "string") existing.add(address.trim().toUpperCase());
  }

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];

    // Validate entry structure
    const validationErrors = validateAddressBookEntry(entry);
    if (validationErrors.length > 0) {
      result.rejected.push({
        entry,
        reason: validationErrors.join("; "),
      });
      continue;
    }

    // Check for duplicates (StrKey is upper-case base32, so normalise case)
    const key = entry.address.toUpperCase();
    if (seenAddresses.has(key)) {
      result.rejected.push({
        entry,
        reason: "Duplicate address in import",
      });
      continue;
    }
    seenAddresses.add(key);
    if (existing.has(key)) {
      result.rejected.push({
        entry,
        reason: "Address already exists in address book",
      });
      continue;
    }

    // Warn about unsigned labels
    if (
      entry.label &&
      !entry.signedLabel &&
      options?.allowUnsigned !== false
    ) {
      result.warnings.push(
        `Unsigned label for ${entry.address}: "${entry.label}" (may be unverified)`
      );
    }

    // Add to import list
    result.imported.push({
      ...entry,
      id: entry.id || `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    });
  }

  result.success = result.imported.length > 0;
  return result;
}

/**
 * Export address book entries to JSON string.
 * 
 * Includes only cryptographically verifiable information:
 * - Address (validated)
 * - Label (only if signed)
 * - SignedLabel (with signature)
 * - GroupIds (for organization)
 * 
 * Strips UI-only fields like 'id', 'isFavorite' to prevent misuse.
 */
export function exportAddressBook(entries: AddressBookEntry[]): string {
  const exportData = entries.map((entry) => ({
    address: entry.address,
    label: entry.label || undefined,
    signedLabel: entry.signedLabel,
    groupIds: entry.groupIds && entry.groupIds.length > 0 ? entry.groupIds : undefined,
  }));

  return JSON.stringify(exportData, null, 2);
}
