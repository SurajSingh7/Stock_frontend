'use client'

import LoginComponent from '@/modules/core/auth/login/Login'
import React, { useEffect } from 'react'
import { usePermissions } from '@/context/PermissionContext'

const HOME = '/stock/home'
const BOUNCE_KEY = 'login-redirected-at'

/*
  Middleware already sends a signed-in visitor from "/" to Home, but this page
  can still be reached without asking it — a page restored from browser
  history, or the client router's cache. When the session turns out to be
  alive, go Home with a full load so middleware decides again.

  If the app cookie is really gone, middleware sends us straight back here;
  the timestamp stops that turning into a loop — within 10s we stay on the
  form, which is the right place to be anyway.
*/
const LoginPage = () => {
  const { userData, loading } = usePermissions()

  useEffect(() => {
    if (loading || !userData) return
    let last = 0
    try { last = Number(sessionStorage.getItem(BOUNCE_KEY)) || 0 } catch {}
    if (Date.now() - last < 10000) return
    try { sessionStorage.setItem(BOUNCE_KEY, String(Date.now())) } catch {}
    window.location.replace(HOME)
  }, [loading, userData])

  return (
    <div>
      <LoginComponent/>
    </div>
  )
}

export default LoginPage
