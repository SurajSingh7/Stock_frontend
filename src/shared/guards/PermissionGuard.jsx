'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/context/PermissionContext';
import BranchRequired from '@/shared/guards/BranchRequired';
import { navCategories } from '@/layouts/header/components/NavBar/NavCategories';
import {
  resolveModuleForPath,
  useFilteredNav,
} from '@/layouts/header/components/NavBar/PermissionNavBuilder';

/**
 * Stops a hidden module from being reached by typing its URL.
 *
 * What this is NOT: a security boundary. The API is, and it already holds —
 * someone with categories:READ can read categories through the API whatever
 * this component does, and they SHOULD, because category filters on other
 * screens depend on it. This only decides which pages a person is offered,
 * matching the navigation exactly.
 *
 * Mounted once in the root layout rather than wrapped around each page, so a
 * page added next month is covered without anyone remembering to.
 */

// Rendered outside the app shell's permission model — the login screen and the
// landing route must always render, or a user with no access could never even
// reach the screen telling them so.
const ALWAYS_ALLOWED = new Set(['/', '/home']);

// The login screen, and only the login screen. A signed-out visitor has no
// branch either, so gating '/' would replace the login form with a message
// telling them to sign in again — a loop with no way out.
const BRANCH_GATE_EXEMPT = new Set(['/']);

const PermissionGuard = ({ children }) => {
  const pathname = usePathname();
  const { permissions, isAdmin, loading, error, branchId } = usePermissions();
  const filteredNav = useFilteredNav(navCategories, permissions);

  const target = resolveModuleForPath(navCategories, pathname);
  const homePath = filteredNav[0]?.items?.[0]?.path || '/home';

  /* Branch prerequisite — checked before everything else below, including the
     admin bypass and ALWAYS_ALLOWED, because an account with no branch cannot
     use ANY stock screen (the backend refuses every route but two). /home is
     deliberately covered: it derives its landing destination from the nav and
     would otherwise drop the user onto a page that cannot load.

     Three conditions, all of them load-bearing:
       !loading  — branchId is null while the first fetch is still in flight,
                   so without this the gate flashes on every page load.
       !error    — a failed permissions fetch also leaves branchId null. That is
                   a network problem, not a missing branch, and telling the user
                   to get a branch assigned would send them down the wrong path.
       !branchId — the actual rule. Mirrors the backend's own check, so the two
                   agree instead of the UI rendering over a wall of 403s. */
  if (!BRANCH_GATE_EXEMPT.has(pathname) && !loading && !error && !branchId) {
    return <BranchRequired />;
  }

  if (ALWAYS_ALLOWED.has(pathname)) return children;

  // Admin bypasses, the same way the navbar does — otherwise an admin could
  // hide a module from themselves and lose the screen that undoes it.
  if (isAdmin) return children;

  // Paths the nav does not describe (detail screens, admin sections, anything
  // new) are left alone. See resolveModuleForPath for why this fails open.
  if (!target) return children;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  const allowed = filteredNav.some((c) =>
    (c.items || []).some((i) => i.path === target.path)
  );
  if (allowed) return children;

  // Same visual language as /home — these two are the only dead ends in the
  // app and it would read as a different product if they looked unrelated.
  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-xl -translate-x-1/2 rounded-full bg-indigo-100/50 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-xl shadow-slate-900/5 backdrop-blur">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path
                d="M7 10V7a5 5 0 0 1 10 0v3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <rect x="4.5" y="10" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
              <circle cx="12" cy="15" r="1.4" fill="currentColor" />
            </svg>
          </span>

          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
            You don&apos;t have access to this page
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            This module has not been shared with your account. Everything else
            you already have keeps working — ask an administrator if you need
            this one too.
          </p>

          <Link
            href={homePath}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M3 11.5 12 4l9 7.5M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PermissionGuard;
