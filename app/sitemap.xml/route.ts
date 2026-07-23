/**
 * sitemap.xml — Issues #305 / #375
 *
 * Generates a sitemap with all public pages plus marketplace invoice URLs
 * (mock or live listing). Dashboard and API routes are excluded.
 */

import { fetchInvoices } from "@/services/invoiceService";
import { buildInvoiceSitemapEntries } from "@/lib/invoiceSeo";

const STATIC_PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/marketplace", changefreq: "hourly", priority: "0.9" },
  { path: "/analytics", changefreq: "daily", priority: "0.6" },
  { path: "/transactions", changefreq: "daily", priority: "0.5" },
  { path: "/invoice/create", changefreq: "weekly", priority: "0.7" },
];

function escapeXml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(
  baseUrl: string,
  path: string,
  lastmod: string,
  changefreq: string,
  priority: string
) {
  return `  <url>
    <loc>${escapeXml(`${baseUrl}${path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://kora.finance";
  const now = new Date().toISOString().split("T")[0];

  const staticEntries = STATIC_PAGES.map((page) =>
    urlEntry(baseUrl, page.path, now, page.changefreq, page.priority)
  );

  // Dynamic invoice detail entries (mock + live via invoice service)
  let invoiceEntries: string[] = [];
  try {
    const page = await fetchInvoices(undefined, undefined, 1, 100);
    const entries = buildInvoiceSitemapEntries(page.data ?? []);
    invoiceEntries = entries.map((e) =>
      urlEntry(baseUrl, e.path, e.lastmod || now, e.changefreq, e.priority)
    );
  } catch {
    // Sitemap still returns static pages if invoice fetch fails
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...invoiceEntries].join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
