import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/reset-password");

    if (isAuthPage) {
      if (isAuth) {
        if (token.role === "ADMIN") {
          return NextResponse.redirect(new URL("/admin/dashboard", req.url));
        } else {
          return NextResponse.redirect(new URL("/vendor/dashboard", req.url));
        }
      }
      return null;
    }

    if (!isAuth) {
      let from = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        from += req.nextUrl.search;
      }
      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
      );
    }

    // Role-based protection
    if (req.nextUrl.pathname.startsWith("/admin") && token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/vendor/dashboard", req.url));
    }

    if (req.nextUrl.pathname.startsWith("/vendor") && token.role !== "VENDOR") {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
  },
  {
    callbacks: {
      async authorized() {
        // This is a workaround to make middleware always run
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/vendor/:path*", "/login", "/reset-password"],
};
