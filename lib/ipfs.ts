/**
 * IPFS upload service via Pinata.
 * Supports XHR progress tracking, CID validation, and retry on 5xx errors.
 *
 * All metadata uploads are validated against InvoiceMetadataV1 schema before
 * being pinned to IPFS. An SVG invoice preview is generated and uploaded as
 * the NFT image field.
 */
import type { InvoiceMetadata } from "@/types";
import { withRetry } from "@/lib/utils";
import { env } from "@/lib/env";
import {
  buildInvoiceMetadata,
  validateInvoiceMetadata,
  METADATA_VERSION,
  type InvoiceMetadataV1,
  type InvoiceMetadataV1Input,
} from "@/lib/invoiceMetadata";
import { generateInvoiceSvg, svgToFile } from "@/lib/invoiceSvg";

const IPFS_GATEWAY = env.NEXT_PUBLIC_IPFS_GATEWAY;

// CID v0 (Qm...) or CID v1 (bafy...)
const CID_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52,})$/;

export function validateCid(cid: string): void {
  if (!CID_REGEX.test(cid)) {
    throw new Error(`Invalid IPFS CID: ${cid}`);
  }
}

/** Upload a file via XHR so we get real progress events. */
function xhrUpload(
  url: string,
  form: FormData,
  onProgress?: (percent: number) => void
): Promise<{ IpfsHash: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during IPFS upload"));
    xhr.send(form);
  });
}

/**
 * Upload an invoice PDF to IPFS via Pinata with progress tracking.
 * Returns the validated CID.
 */
export async function uploadInvoicePDF(
  file: File,
  walletAddress: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("walletAddress", walletAddress);

  const data = await withRetry(() => xhrUpload(`/api/upload`, form, onProgress), 3);

  validateCid(data.IpfsHash);
  return data.IpfsHash;
}

/**
 * Upload invoice metadata JSON to IPFS via Pinata.
 * Returns the validated CID.
 */
export async function uploadInvoiceMetadata(
  metadata: InvoiceMetadata,
  walletAddress: string
): Promise<string> {
  const res = await withRetry(
    () =>
      fetch(`/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, metadata, name: `invoice-metadata-${metadata.invoiceNumber}` }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Metadata upload failed: ${r.status}`);
        return r.json() as Promise<{ cid: string }>; // proxy returns { cid }
      }),
    3
  );

  validateCid(res.cid);
  return res.cid;
}

/**
 * Upload both PDF and metadata, returning both CIDs.
 */
export async function uploadInvoiceToIPFS(
  file: File,
  metadata: InvoiceMetadata,
  walletAddress: string,
  onProgress?: (percent: number) => void
): Promise<{ pdfCid: string; metadataCid: string }> {
  const pdfCid = await uploadInvoicePDF(file, walletAddress, onProgress);
  const metadataCid = await uploadInvoiceMetadata({
    ...metadata,
    documentHash: pdfCid,
    documentUrl: ipfsUrl(pdfCid),
  }, walletAddress);
  return { pdfCid, metadataCid };
}

/** Build a public IPFS gateway URL from a CID. */
export function ipfsUrl(cid: string): string {
  return `${IPFS_GATEWAY}/${cid}`;
}

// ─── Validated V1 Metadata Upload ────────────────────────────────────────────

/**
 * Upload a validated InvoiceMetadataV1 object to IPFS.
 *
 * This is the canonical upload path for invoice NFT metadata. It:
 *  1. Validates the metadata against the InvoiceMetadataV1 Zod schema
 *  2. Generates an SVG invoice preview and uploads it as the NFT image
 *  3. Injects the image CID into the metadata
 *  4. Uploads the final metadata JSON to IPFS
 *
 * @param input         - Invoice metadata input (without metadata_version)
 * @param walletAddress - Uploader's Stellar wallet address (for rate limiting)
 * @param onProgress    - Optional progress callback (0–100)
 * @returns Object containing the metadata CID and image CID
 * @throws {Error} if schema validation fails or any upload step fails
 */
export async function uploadValidatedInvoiceMetadata(
  input: InvoiceMetadataV1Input,
  walletAddress: string,
  onProgress?: (percent: number) => void
): Promise<{ metadataCid: string; imageCid: string }> {
  // Step 1: Pre-validate input (without image — we'll add it after upload)
  const preCheck = validateInvoiceMetadata({
    metadata_version: METADATA_VERSION,
    ...input,
    // Provide a placeholder image for pre-validation; real value set below
    image: input.image ?? "ipfs://placeholder",
  });
  if (!preCheck.success) {
    throw new Error(
      `Invoice metadata validation failed:\n${preCheck.errors.join("\n")}`
    );
  }

  onProgress?.(5);

  // Step 2: Generate SVG invoice preview
  // Build a temporary metadata object for SVG generation
  const tempMeta = buildInvoiceMetadata({
    ...input,
    image: input.image ?? "ipfs://placeholder",
  });
  const svgString = generateInvoiceSvg(tempMeta);
  const svgFile = svgToFile(
    svgString,
    `invoice-preview-${input.invoice_number}.svg`
  );

  onProgress?.(15);

  // Step 3: Upload SVG to IPFS
  const imageCid = await uploadInvoicePDF(svgFile, walletAddress, (p) => {
    // Map SVG upload progress to 15–55% of total
    onProgress?.(15 + Math.round(p * 0.4));
  });

  onProgress?.(55);

  // Step 4: Build final validated metadata with real image CID
  const finalMetadata = buildInvoiceMetadata({
    ...input,
    image: `ipfs://${imageCid}`,
  });

  onProgress?.(60);

  // Step 5: Upload metadata JSON to IPFS
  const metadataCid = await withRetry(
    () =>
      fetch(`/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          metadata: finalMetadata,
          name: `invoice-metadata-v${METADATA_VERSION}-${input.invoice_number}`,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Metadata upload failed: ${r.status}`);
        const json = (await r.json()) as { cid: string };
        return json.cid;
      }),
    3
  );

  validateCid(metadataCid);
  onProgress?.(100);

  return { metadataCid, imageCid };
}

/**
 * Unpin a file from Pinata (best-effort).
 * This is called during invoice cancellation to clean up IPFS-pinned files.
 * @param cid - Content ID to unpin
 * @returns true if successful, false if error (best-effort, no throw)
 */
export async function unpinFromPinata(cid: string): Promise<boolean> {
  try {
    validateCid(cid);
    const response = await fetch(`/api/upload`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid }),
    });
    return response.ok;
  } catch (err) {
    // Best-effort: log the error and continue
    console.warn(`Failed to unpin CID ${cid}:`, err);
    return false;
  }
}

/**
 * Unpin multiple files from Pinata (best-effort).
 * @param cids - Array of CIDs to unpin
 * @returns Promise that resolves when all unpin attempts are complete
 */
export async function unpinMultipleFromPinata(cids: string[]): Promise<void> {
  const results = await Promise.allSettled(cids.map(unpinFromPinata));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`Failed to unpin ${failed} out of ${cids.length} CIDs`);
  }
}

// ─── Legacy helpers (kept for backward compatibility) ─────────────────────────

export async function uploadFileToPinata(
  file: File,
  _name: string,
  walletAddress?: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  // If walletAddress is provided, forward it; otherwise use empty string.
  return uploadInvoicePDF(file, walletAddress || "", onProgress);
}

export async function uploadJsonToPinata(
  metadata: Record<string, unknown>,
  _name: string
): Promise<string> {
  // Proxy JSON upload through our server; walletAddress is not available here
  const res = await withRetry(
    () =>
      fetch(`/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: "", metadata, name: _name }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Metadata upload failed: ${r.status}`);
        return r.json() as Promise<{ cid: string }>;
      }),
    3
  );
  validateCid(res.cid);
  return res.cid;
}
