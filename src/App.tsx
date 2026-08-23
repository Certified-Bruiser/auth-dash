import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from './lib/supabase'

import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'
import PanelVisual from './components/PanelVisual'

import DashboardApp from './app/App'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [view, setView] = useState<'login' | 'register'>('login')

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return

      setSession(session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#09090f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e2e4ef',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Checking authentication...
      </div>
    )
  }

  if (!session) {
    return (
      <div
        className="auth-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          minHeight: '100vh',
        }}
      >
        <PanelVisual view={view} />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '3rem 4rem',
            background: '#ffffff',
          }}
        >
          {view === 'login' ? (
            <LoginForm onSwitch={() => setView('register')} />
          ) : (
            <RegisterForm onSwitch={() => setView('login')} />
          )}
        </div>
      </div>
    )
  }

  return <DashboardApp />
}

