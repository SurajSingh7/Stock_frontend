'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { API_PORTAL_BACKEND_URL } from '@/config/getEnvVariables';
import { usePermissions } from '@/context/PermissionContext';
import { navCategories } from '@/layouts/header/components/NavBar/NavCategories';
import { useFilteredNav } from '@/layouts/header/components/NavBar/PermissionNavBuilder';

/**
 * Where login lands.
 *
 * It used to go straight to /master/category, hardcoded in two places. That
 * only worked while everyone could open Categories; the moment a module can be
 * hidden per user, a fixed landing page drops somebody onto a screen they are
 * not allowed to see. So the destination is derived instead: the first entry
 * of the same filtered navigation the navbar renders, which means nav order
 * doubles as landing priority and there is nothing separate to keep in sync.
 *
 * When that list is empty the user is at a dead end, and the screen is built
 * around getting them out of it rather than around apologising. It shows WHO
 * they are signed in as — the first thing an administrator will ask, and the
 * first thing worth double-checking if they signed in with the wrong account —
 * plus a way to re-check without signing out, because access is usually
 * granted while they are sitting on this page.
 */

const Spinner = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 animate-spin">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const HomePage = () => {
  const router = useRouter();
  const { permissions, isAdmin, loading, userData } = usePermissions();
  const filteredNav = useFilteredNav(navCategories, permissions);
  const [rechecking, setRechecking] = useState(false);

  // Admins are never filtered (see Navbar.jsx), so their landing comes from the
  // full list rather than the empty filtered one.
  const target = isAdmin
    ? navCategories[0]?.items?.[0]?.path
    : filteredNav[0]?.items?.[0]?.path;

  useEffect(() => {
    if (loading || !target) return;
    // replace, not push — Back should return to wherever they came from, not
    // bounce through this redirect again.
    router.replace(target);
  }, [loading, target, router]);

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_PORTAL_BACKEND_URL || ''}/hrms/logout`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Logged out successfully');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to log out', error);
      toast.error('Could not log out — please try again');
    }
  };

  // A full reload rather than a context refetch: permissions are read once at
  // mount, and reloading is the one thing guaranteed to pick up a grant an
  // administrator made a moment ago.
  const handleRecheck = () => {
    setRechecking(true);
    window.location.reload();
  };

  const fullName = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ');
  const initials =
    [userData?.firstName?.[0], userData?.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
    '?';

  /* ── Redirecting, or still resolving ─────────────────────────────────── */
  if (loading || target) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-slate-400">
        <Spinner />
        <p className="text-sm">Taking you to your workspace…</p>
      </div>
    );
  }

  /* ── Dead end ────────────────────────────────────────────────────────── */
  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4 py-12">
      {/* Ambient wash — keeps a blocking screen from feeling like a crash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-xl -translate-x-1/2 rounded-full bg-indigo-100/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-1/4 h-72 w-96 rounded-full bg-amber-100/40 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-slate-900/5 backdrop-blur">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-inset ring-amber-100">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                <path
                  d="M7 10V7a5 5 0 0 1 10 0v3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <rect
                  x="4.5"
                  y="10"
                  width="15"
                  height="10"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <circle cx="12" cy="15" r="1.4" fill="currentColor" />
              </svg>
            </span>

            <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
              No modules assigned yet
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Your account is signed in, but nothing has been shared with it so
              far. An administrator needs to grant you access before there is
              anything to open.
            </p>
          </div>

          {/* Who you are. The first thing an admin asks, and the first thing to
              check if the wrong account was used. */}
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            {userData?.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userData.profileImage}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full bg-white ring-1 ring-slate-200"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                {initials}
              </span>
            )}
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-slate-900">
                {fullName || 'Signed in'}
              </p>
              <p className="truncate text-xs text-slate-500">{userData?.email || '—'}</p>
              {(userData?.role || userData?.department) && (
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {[userData?.role, userData?.department].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleRecheck}
              disabled={rechecking}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rechecking ? (
                <>
                  <Spinner />
                  Checking…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path
                      d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Check again
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-rose-600/20 transition hover:bg-rose-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Log out
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
          If you were told access was granted, use{' '}
          <span className="font-medium text-slate-500">Check again</span> — it
          takes effect immediately, no need to sign out.
        </p>
      </div>
    </div>
  );
};

export default HomePage;
