'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { API_PORTAL_BACKEND_URL } from '@/config/getEnvVariables';

/**
 * Shown when the signed-in account has no branch assigned.
 *
 * Stock is branch-scoped throughout, so such an account cannot read or write
 * anything meaningful — the backend refuses every route except the two the
 * frontend needs to discover this (see BRANCH_EXEMPT_PATHS in
 * stock-backend/middlewares/stock.auth.middleware.js). Without this screen the
 * app would render its normal shell over a wall of empty lists and 403s.
 *
 * The branch lives in HRMS, not here, so there is nothing the user can fix from
 * this app. That is why the only action offered is Logout: sign out, have an
 * administrator set the branch, sign back in. A "retry" button would just fail
 * again — the session's identity is fixed until they re-authenticate.
 */
const BranchRequired = () => {
  const [loggingOut, setLoggingOut] = useState(false);

  // Same call and same redirect as the profile menu's Logout — deliberately not
  // shared through a hook, because that one lives inside the header dropdown and
  // this screen replaces the page body.
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch(`${API_PORTAL_BACKEND_URL || ''}/hrms/logout`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (response.ok) {
        toast.success('Logged out successfully');
        window.location.href = '/';
        return;
      }
      throw new Error('Logout failed');
    } catch {
      // Left on this screen rather than half-signed-out with no explanation.
      toast.error('Could not sign you out. Please try again.');
      setLoggingOut(false);
    }
  };

  return (
    /* Same visual language as PermissionGuard's no-access screen — these are the
       app's dead ends and they should read as one product. */
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-xl -translate-x-1/2 rounded-full bg-amber-100/50 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-xl shadow-slate-900/5 backdrop-blur">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-inset ring-amber-200">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path
                d="M4 20V9.5L12 4l8 5.5V20"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M3 20h18M10 20v-5h4v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
            No branch assigned to your account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Stock is organised branch by branch, so your account needs one before
            you can use it. Ask an administrator to set your branch in HRMS, then
            sign in again — everything will be waiting for you.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M15 16.5 19.5 12 15 7.5M19.5 12H9M12 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H12"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {loggingOut ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BranchRequired;
