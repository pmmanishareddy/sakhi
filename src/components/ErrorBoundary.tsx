import { Component, type ReactNode } from 'react'

// A render crash anywhere below this boundary would otherwise unmount React and
// leave a blank white screen with no signal (especially painful in the installed
// PWA where there's no dev console). Show the actual error on screen instead, so
// it can be read and reported. Inline styles on purpose — must render even if the
// theme/CSS is what failed.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Sakhi crashed:', error, info)
  }

  render() {
    const e = this.state.error
    if (!e) return this.props.children
    return (
      <div style={{
        padding: '24px',
        paddingTop: 'calc(24px + env(safe-area-inset-top))',
        fontFamily: 'system-ui, sans-serif',
        color: '#eaeaea',
        background: '#1a1a1a',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Something broke</h2>
        <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 14px' }}>Screenshot this and send it over:</p>
        <pre style={{
          fontSize: 11,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: '#000',
          color: '#ff9b8a',
          padding: 12,
          borderRadius: 10,
          maxHeight: '55vh',
          overflow: 'auto',
          margin: 0,
        }}>{e.name}: {e.message}{'\n\n'}{e.stack}</pre>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '12px 22px', borderRadius: 12, border: 'none', background: '#c88b6e', color: '#fff', fontSize: 15, fontWeight: 600 }}
        >
          Reload
        </button>
      </div>
    )
  }
}
