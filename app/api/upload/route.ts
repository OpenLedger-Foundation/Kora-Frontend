import { NextResponse } from "next/server";

const PINATA_BASE = "https://api.pinata.cloud";
const PINATA_JWT = process.env.PINATA_JWT || "";
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || "";

// In-memory rate limit store: walletAddress -> timestamps (ms)
const RATE_LIMIT_WINDOW = 1000 * 60 * 60; // 1 hour
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, number[]>();

async function virusScan(buffer: Buffer, filename: string) {
  if (!VIRUSTOTAL_API_KEY) return { ok: true };

  try {
    const form = new FormData();
    form.append("file", new Blob([buffer]), filename);

    const uploadRes = await fetch("https://www.virustotal.com/api/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${VIRUSTOTAL_API_KEY}` },
      body: form as any,
    });

    if (!uploadRes.ok) return { ok: false, error: `VirusTotal upload failed: ${uploadRes.status}` };
    const uploadJson = await uploadRes.json();
    const analysisId = uploadJson.data?.id;
    if (!analysisId) return { ok: false, error: "VirusTotal returned no analysis id" };

    // Poll analysis result (short timeout)
    const start = Date.now();
    while (Date.now() - start < 15000) {
      const analysisRes = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: { Authorization: `Bearer ${VIRUSTOTAL_API_KEY}` },
      });
      if (!analysisRes.ok) break;
      const analysisJson = await analysisRes.json();
      const status = analysisJson.data?.attributes?.status;
      if (status === "completed") {
        const stats = analysisJson.data?.attributes?.stats || {};
        const malicious = stats.malicious || 0;
        const suspicious = stats.suspicious || 0;
        const totalThreats = malicious + suspicious;
        return { ok: totalThreats === 0, stats };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return { ok: true, note: "Virus scan timed out — treated as clean" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function checkRateLimit(wallet: string) {
  const now = Date.now();
  const arr = rateLimitMap.get(wallet) || [];
  const recent = arr.filter((t) => t > now - RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(wallet, recent);
  return true;
}

export async function POST(req: Request) {
  try {
    if (!PINATA_JWT) {
      return NextResponse.json({ error: "Pinata JWT not configured" }, { status: 500 });
    }

    const contentType = req.headers.get("content-type") || "";

    // Handle multipart file upload
    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      const wallet = form.get("walletAddress")?.toString();

      if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
      if (!wallet) return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });

      // Rate limit per wallet
      if (!checkRateLimit(wallet)) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Size check
      const MAX_BYTES = 10 * 1024 * 1024; // 10MB
      if (buffer.length > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 400 });

      // Magic byte validation for PDF: %PDF-
      const magic = buffer.slice(0, 5).toString("utf8");
      if (magic !== "%PDF-") return NextResponse.json({ error: "Invalid PDF file" }, { status: 400 });

      // Virus scan (optional)
      const scan = await virusScan(buffer, (file as any).name || "upload.pdf");
      if (!scan.ok) return NextResponse.json({ error: `Virus scan failed: ${scan.error || JSON.stringify(scan.stats)}` }, { status: 400 });

      // Forward to Pinata
      const forwardForm = new FormData();
      forwardForm.append("file", new Blob([buffer]), (file as any).name || "upload.pdf");
      forwardForm.append("pinataMetadata", JSON.stringify({ name: (file as any).name || "upload.pdf" }));

      const pinRes = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
        method: "POST",
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body: forwardForm as any,
      });

      const pinJson = await pinRes.json();
      if (!pinRes.ok) {
        return NextResponse.json({ error: `Pinata error: ${pinJson?.error || pinRes.status}` }, { status: 502 });
      }

      console.log("[pinata-proxy] upload", { wallet, ts: new Date().toISOString(), cid: pinJson.IpfsHash });
      return NextResponse.json({ cid: pinJson.IpfsHash });
    }

    // Handle JSON metadata upload
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const wallet = body.walletAddress;
      const metadata = body.metadata;
      const name = body.name || "metadata";

      if (!wallet || !metadata) return NextResponse.json({ error: "walletAddress and metadata are required" }, { status: 400 });

      if (!checkRateLimit(wallet)) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      }

      // Optional: could run lightweight metadata checks here

      const pinRes = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({ pinataMetadata: { name }, pinataContent: metadata }),
      });

      const pinJson = await pinRes.json();
      if (!pinRes.ok) return NextResponse.json({ error: `Pinata error: ${pinJson?.error || pinRes.status}` }, { status: 502 });

      console.log("[pinata-proxy] json", { wallet, ts: new Date().toISOString(), cid: pinJson.IpfsHash });
      return NextResponse.json({ cid: pinJson.IpfsHash });
    }

    return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
  } catch (err) {
    console.error("[pinata-proxy] error", (err as Error).message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
