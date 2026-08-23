import { useState } from 'react'
import InputField from './InputField'
import { supabase } from '../lib/supabase'

interface Props {
  onSwitch: () => void
}

export default function LoginForm({ onSwitch }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  setLoading(true)

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  setLoading(false)

  if (error) {
    alert(error.message)
    return
  }
}







  return (
    <div style={{ width: '100%', maxWidth: '400px' }}>
      <div style={{ marginBottom: '40px' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5b3bff', marginBottom: '12px' }}>
          Welcome back
        </p>
        <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontWeight: 800, fontSize: '2.2rem', letterSpacing: '-0.03em', color: '#0a0a10', margin: '0 0 10px 0', lineHeight: 1.1 }}>
          Sign in
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#7a7a8a', margin: 0 }}>
          Enter your credentials to access your workspace.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px' }}>
        <SSOButton icon={<GoogleIcon />} label="Google" />
        <SSOButton icon={<GithubIcon />} label="GitHub" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div style={{ flex: 1, height: '1px', background: '#e4e4ec' }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#b0b0c0' }}>or continue with email</span>
        <div style={{ flex: 1, height: '1px', background: '#e4e4ec' }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <InputField
          label="Work email"
          type="email"
          placeholder="elena.chen@company.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <InputField
          label="Password"
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          hint={
            <button type="button" style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#5b3bff', cursor: 'pointer', fontWeight: 500 }}>
              Forgot password?
            </button>
          }
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <div
            onClick={() => setRemember(!remember)}
            style={{
              width: '16px', height: '16px',
              border: remember ? '2px solid #5b3bff' : '2px solid #d0d0dc',
              background: remember ? '#5b3bff' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            {remember && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#5a5a6a', userSelect: 'none' }}>
            Remember me for 30 days
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '8px', height: '48px',
            background: loading ? '#8b6bff' : '#5b3bff',
            color: '#ffffff', border: 'none',
            fontFamily: 'Epilogue, sans-serif', fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em',
            cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'background 0.15s ease', borderRadius: 0,
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#4a2dee' }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#5b3bff' }}
        >
          {loading ? <Spinner /> : 'Sign in to workspace'}
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>

      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#9a9aaa', textAlign: 'center', marginTop: '32px' }}>
        Don't have an account?{' '}
        <button onClick={onSwitch} style={{ background: 'none', border: 'none', padding: 0, color: '#5b3bff', fontFamily: 'Epilogue, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
          Create account
        </button>
      </p>

      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#c0c0cc', textAlign: 'center', marginTop: '16px', lineHeight: 1.6 }}>
        Protected by reCAPTCHA and subject to the{' '}
        <span style={{ color: '#9090a8', textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
        {' '}and{' '}
        <span style={{ color: '#9090a8', textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>.
      </p>
    </div>
  )
}

function SSOButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        height: '44px', border: hov ? '1px solid #5b3bff' : '1px solid #e4e4ec',
        background: hov ? '#f8f6ff' : '#ffffff', cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '13px', color: '#2a2a3a',
        transition: 'all 0.15s ease', borderRadius: 0,
      }}
    >
      {icon} {label}
    </button>
  )
}

function Spinner() {
  return (
    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z" fill="#4285F4" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const style = document.createElement('style')
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
document.head.appendChild(style)