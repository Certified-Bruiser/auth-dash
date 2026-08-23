import { useState } from 'react'
import InputField from './InputField'
import { supabase } from '../lib/supabase'

interface Props {
  onSwitch: () => void
}

export default function RegisterForm({ onSwitch }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  const strength = getStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!agreed) return

  setLoading(true)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  })

  setLoading(false)

  if (error) {
    alert(error.message)
    return
  }

  console.log('Registered user:', data.user)

  alert(
    'Account created! Check your email to confirm your account.'
  )
  onSwitch()
}

  return (
    <div style={{ width: '100%', maxWidth: '420px' }}>
      <div style={{ marginBottom: '36px' }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5b3bff', marginBottom: '12px' }}>
          Get started free
        </p>
        <h2 style={{ fontFamily: 'Epilogue, sans-serif', fontWeight: 800, fontSize: '2.1rem', letterSpacing: '-0.03em', color: '#0a0a10', margin: '0 0 10px 0', lineHeight: 1.1 }}>
          Create your account
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#7a7a8a', margin: 0 }}>
          Start building in under 2 minutes. No credit card required.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <InputField label="Full name" type="text" placeholder="Elena Chen" value={name} onChange={setName} autoComplete="name" />
          <InputField label="Work email" type="email" placeholder="elena@company.io" value={email} onChange={setEmail} autoComplete="email" />
        </div>

        <InputField label="Password" type="password" placeholder="Min. 12 characters" value={password} onChange={setPassword} autoComplete="new-password" />

        {password.length > 0 && (
          <div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ flex: 1, height: '3px', background: i < strength.score ? (strength.score <= 1 ? '#ff4444' : strength.score <= 2 ? '#ffaa00' : '#22cc88') : '#e4e4ec', transition: 'background 0.2s ease' }} />
              ))}
            </div>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#8a8a9a' }}>
              Strength: <strong style={{ color: strength.color }}>{strength.label}</strong>
            </span>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
          <div
            onClick={() => setAgreed(!agreed)}
            style={{ width: '16px', height: '16px', border: agreed ? '2px solid #5b3bff' : '2px solid #d0d0dc', background: agreed ? '#5b3bff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            {agreed && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#6a6a7a', lineHeight: 1.5, userSelect: 'none' }}>
            I agree to the{' '}
            <span style={{ color: '#5b3bff', textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>
            {' '}and{' '}
            <span style={{ color: '#5b3bff', textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !agreed}
          style={{
            marginTop: '4px', height: '48px',
            background: !agreed ? '#d0d0dc' : loading ? '#8b6bff' : '#5b3bff',
            color: !agreed ? '#9090a8' : '#ffffff',
            border: 'none', fontFamily: 'Epilogue, sans-serif', fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em',
            cursor: loading || !agreed ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'background 0.15s ease', borderRadius: 0,
          }}
          onMouseEnter={e => { if (agreed && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#4a2dee' }}
          onMouseLeave={e => { if (agreed && !loading) (e.currentTarget as HTMLButtonElement).style.background = '#5b3bff' }}
        >
          {loading ? <Spinner /> : 'Create account'}
          {!loading && agreed && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>

      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#9a9aaa', textAlign: 'center', marginTop: '28px' }}>
        Already have an account?{' '}
        <button onClick={onSwitch} style={{ background: 'none', border: 'none', padding: 0, color: '#5b3bff', fontFamily: 'Epilogue, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
          Sign in
        </button>
      </p>
    </div>
  )
}

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  const labels = ['Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#ff4444', '#ffaa00', '#ffaa00', '#22cc88']
  return { score, label: labels[score - 1] ?? 'Weak', color: colors[score - 1] ?? '#ff4444' }
}

function Spinner() {
  return (
    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  )
}

const style = document.createElement('style')
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
document.head.appendChild(style)