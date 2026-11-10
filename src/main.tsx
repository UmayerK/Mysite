import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './styles.css'
import { experiences, pathOf } from './experiences/registry'
import { ErrorBoundary } from './shell/ErrorBoundary'
import { TransitionProvider } from './shell/transition'
import Hub from './hub/Hub'
import { Notice } from './shell/Notice'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TransitionProvider>
        <Notice />
        <ErrorBoundary>
          {/* The curtain covers the screen while a chunk loads, so no visible fallback is needed. */}
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Hub />} />
              {experiences.map(({ meta, Component }) => (
                <Route key={meta.id} path={pathOf(meta)} element={<Component />} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </TransitionProvider>
    </BrowserRouter>
  </StrictMode>,
)
