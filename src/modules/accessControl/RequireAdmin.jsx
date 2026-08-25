'use client';
import React from 'react';
import { usePermissions } from '@/context/PermissionContext';

// The backend already rejects these calls for a non-admin (requireAdmin on
// every /access-control and /audit-log route) — this is just so the page
// shows a clear message instead of a form full of silent 403s.
const RequireAdmin = ({ children }) => {
  const { isAdmin, loading } = usePermissions();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50/60 p-6 text-center">
        <p className="text-base font-semibold text-slate-800">Admin access required</p>
        <p className="max-w-sm text-sm text-slate-500">This section is only available to admin accounts.</p>
      </div>
    );
  }

  return children;
};

export default RequireAdmin;
