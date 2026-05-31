import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/invoice/create", "/dashboard/sme", "/dashboard/investor"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  for (const p of PROTECTED) {
    if (pathname === p || pathname.startsWith(p + "/")) {
      // redirect to home and include intended destination so client can show modal
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("redirectTo", pathname + (search || ""));
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/invoice/create", "/dashboard/sme", "/dashboard/investor"],
};
