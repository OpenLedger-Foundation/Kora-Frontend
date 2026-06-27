/**
 * robots.txt — Issue #305
 *
 * Allows all crawlers to index public pages while blocking
 * /api/ and /dashboard/ routes from search engines.
 */
export function GET() {
  const body = `# Kora Protocol — robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard/

Sitemap: ${process.env.NEXT_PUBLIC_APP_URL || "https://kora.finance"}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
