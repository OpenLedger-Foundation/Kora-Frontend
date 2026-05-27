/**
 * IPFS upload service via Pinata.
 * Handles invoice document and metadata uploads.
 */
import axios from "axios";

const PINATA_JWT = process.env.PINATA_JWT || "";
const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";

const pinataApi = axios.create({
  baseURL: "https://api.pinata.cloud",
  headers: { Authorization: `Bearer ${PINATA_JWT}` },
});

/**
 * Upload a file (e.g. invoice PDF) to IPFS via Pinata.
 * Returns the IPFS CID.
 */
export async function uploadFileToPinata(
  file: File,
  name: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name })
  );

  const { data } = await pinataApi.post("/pinning/pinFileToIPFS", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });

  return data.IpfsHash as string;
}

/**
 * Upload JSON metadata to IPFS via Pinata.
 * Returns the IPFS CID.
 */
export async function uploadJsonToPinata(
  metadata: Record<string, unknown>,
  name: string
): Promise<string> {
  const { data } = await pinataApi.post("/pinning/pinJSONToIPFS", {
    pinataMetadata: { name },
    pinataContent: metadata,
  });

  return data.IpfsHash as string;
}

/**
 * Build a public IPFS gateway URL from a CID.
 */
export function ipfsUrl(cid: string): string {
  return `${IPFS_GATEWAY}/${cid}`;
}
