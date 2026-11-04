import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = req.cookies.get("utu_admin")?.value;
    let ok = false;
    if (token && process.env.AUTH_SECRET) {
      ok = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET)).then(
        () => true,
        () => false,
      );
    }
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", pathname.startsWith("/admin") ? "DENY" : "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"] };
