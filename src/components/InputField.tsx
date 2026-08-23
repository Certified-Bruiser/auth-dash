import { useState } from 'react'

interface Props {
  label: string
  type: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  hint?: React.ReactNode
}

export default function InputField({ label, type, placeholder, value, onChange, autoComplete, hint }: Props) {
  const [focused, setFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500, color: '#4a4a5a' }}>
          {label}
        </label>
        {hint}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            height: '44px',
            padding: '0 42px 0 14px',
            border: focused ? '1.5px solid #5b3bff' : '1.5px solid #e4e4ec',
            background: focused ? '#faf9ff' : '#ffffff',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: '#0a0a10',
            outline: 'none',
            transition: 'border-color 0.15s ease, background 0.15s ease',
            boxShadow: focused ? '0 0 0 3px rgba(91,59,255,0.08)' : 'none',
            borderRadius: 0,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9090a8',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588L13.36 11.238z" />
      <path d="M11.297 13.5A7.024 7.024 0 0 1 8 14c-5 0-8-5.5-8-5.5a13.17 13.17 0 0 1 2.704-3.238L11.297 13.5z" />
      <line x1="2" y1="2" x2="14" y2="14" />
    </svg>
  )
}