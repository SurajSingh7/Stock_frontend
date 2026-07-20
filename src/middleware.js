import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get("userSession")?.value;

  // Public routes
  const publicRoutes = ["/"];
  const isPublicRoute = publicRoutes.includes(pathname);

  // If already logged in, don't allow login page
  if (isPublicRoute && token) {
    return NextResponse.redirect(
      new URL("/master/category", req.url)
      // OR "/billing/account/pcd-closure" if that's still your dashboard
    );
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
     * - _next
     * - static files
     * - favicon
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
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







