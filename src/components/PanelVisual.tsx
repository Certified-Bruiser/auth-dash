import { useEffect, useRef, useState } from 'react'

interface Props {
  view: 'login' | 'register'
}

const GRID_COLS = 14
const GRID_ROWS = 18

export default function PanelVisual({ view }: Props) {
  const [tick, setTick] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const animate = () => {
      setTick(Date.now() - startRef.current)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const t = tick / 1000

  return (
    <div
      style={{
        position: 'relative',
        background: '#08080f',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3rem',
        minHeight: '100vh',
      }}
    >
      {/* Animated mesh gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 60% 50% at ${48 + Math.sin(t * 0.4) * 12}% ${40 + Math.cos(t * 0.3) * 10}%, rgba(91,59,255,0.35) 0%, transparent 65%),
            radial-gradient(ellipse 45% 40% at ${72 + Math.cos(t * 0.5) * 10}% ${65 + Math.sin(t * 0.4) * 8}%, rgba(139,107,255,0.2) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at ${25 + Math.sin(t * 0.3) * 8}% ${70 + Math.cos(t * 0.6) * 10}%, rgba(58,28,180,0.25) 0%, transparent 60%)
          `,
        }}
      />

      {/* Dot grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Animated grid cells */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          opacity: 0.12,
        }}
      >
        {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => {
          const col = i % GRID_COLS
          const row = Math.floor(i / GRID_COLS)
          const wave = Math.sin(t * 0.8 + col * 0.4 + row * 0.3)
          const isLit = wave > 0.72
          return (
            <div
              key={i}
              style={{
                border: '0.5px solid rgba(255,255,255,0.06)',
                backgroundColor: isLit ? 'rgba(91,59,255,0.6)' : 'transparent',
                transition: 'background-color 0.4s ease',
              }}
            />
          )
        })}
      </div>

      {/* Geometric accent lines */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}
        viewBox="0 0 600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <line x1="0" y1="0" x2="600" y2="900" stroke="white" strokeWidth="0.5" />
        <line x1="600" y1="0" x2="0" y2="900" stroke="white" strokeWidth="0.5" />
        <circle cx="300" cy="450" r="200" stroke="rgba(91,59,255,0.8)" strokeWidth="0.5" fill="none" />
        <circle cx="300" cy="450" r="120" stroke="rgba(139,107,255,0.5)" strokeWidth="0.5" fill="none" />
        <rect x="100" y="150" width="400" height="600" stroke="white" strokeWidth="0.4" fill="none" />
      </svg>

      <div />

      {/* Headline */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <h1
          style={{
            fontFamily: 'Epilogue, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(2.4rem, 4vw, 3.8rem)',
            lineHeight: 0.95,
            color: '#ffffff',
            letterSpacing: '-0.04em',
            margin: '0 0 28px 0',
          }}
        >
          {view === 'login' ? (
            <>The future<br /><span style={{ color: '#8b6bff' }}>starts here.</span></>
          ) : (
            <>Build what<br /><span style={{ color: '#8b6bff' }}>matters most.</span></>
          )}
        </h1>

        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 300,
            fontSize: '15px',
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.5)',
            maxWidth: '320px',
            margin: 0,
          }}
        >
          {view === 'login'
            ? 'Access your workspace, collaborate with your team, and ship faster than ever before.'
            : 'Build and deploy at scale. Everything your team needs, in one place.'}
        </p>
      </div>

      <div />
    </div>
  )
}
