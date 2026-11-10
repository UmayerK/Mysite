import { Component, type ReactNode } from 'react'
import { useCurtainReady } from './transition'

function Fallback({ onRetry }: { onRetry: () => void }) {
  useCurtainReady(true)
  return (
    <div className="route-error" role="alert">
      <p className="route-error__eyebrow">Something broke</p>
      <h1>This piece failed to load.</h1>
      <p>It may be a dropped connection, or a browser without WebGL.</p>
      <div className="route-error__actions">
        <button onClick={onRetry}>Try again</button>
        <a href="/">Back to the index</a>
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error(error)
  }
  render() {
    if (this.state.failed) return <Fallback onRetry={() => window.location.reload()} />
    return this.props.children
  }
}
