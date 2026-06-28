/**
 * sitemap.xml — Issue #305
 *
 * Generates a sitemap with all public pages. Marketplace invoice URLs
 * can be extended dynamically when a data source is available.
 * Dashboard and API routes are excluded.
 */

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

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://kora.finance";
  const now = new Date().toISOString().split("T")[0];

  // Build static page entries
  const staticEntries = STATIC_PAGES.map(
    (page) => `  <url>
    <loc>${escapeXml(`${baseUrl}${page.path}`)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  );

  // TODO: When an invoice listing API is available, fetch invoice IDs
  // and add dynamic entries:
  //   /marketplace/[id] for each published invoice

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
