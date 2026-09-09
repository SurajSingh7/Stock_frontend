import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get("userSession")?.value;

  // Public routes
  const publicRoutes = ["/"];
  const isPublicRoute = publicRoutes.includes(pathname);

  // If already logged in, don't allow login page
  if (isPublicRoute && token) {
    // /home decides where to actually go: it reads the same filtered nav the
    // navbar does and forwards to the first page this user can open. A fixed
    // destination here would drop anyone without that module onto a screen
    // they are not allowed to see.
    return NextResponse.redirect(new URL("/home", req.url));
  }

  // Protect all private routes
  if (!isPublicRoute && !token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - api
     * - erp-api (server-side proxy to the ERP backend, see next.config.mjs;
     *   it serves JSON to fetch() and must not be redirected to /)
     * - _next
     * - static files
     * - favicon
     */
    "/((?!api|erp-api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};




















// import { NextResponse } from "next/server";

// export function middleware(req) {
//   const { pathname } = req.nextUrl;

//   const token = req.cookies.get("userSession")?.value;

//   // Public routes
//   const publicRoutes = ["/"];
//   const isPublicRoute = publicRoutes.includes(pathname);

//   // If already logged in, don't allow login page
//   if (isPublicRoute && token) {
//     return NextResponse.redirect(
//       new URL("/master/category", req.url)
//       // OR "/billing/account/pcd-closure" if that's still your dashboard
//     );
//   }

//   // Protect all private routes
//   if (!isPublicRoute && !token) {
//     return NextResponse.redirect(new URL("/", req.url));
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: [
//     /*
//      * Match all routes except:
//      * - api
//      * - _next
//      * - static files
//      * - favicon
//      */
//     "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
//   ],
// };







