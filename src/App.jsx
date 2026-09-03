import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { usePageTracking } from './hooks/usePageTracking'

const eagerPages = import.meta.env.MODE === 'test'
  ? await import('./pages/eagerPages')
  : null

function loadPageForRoute(name, importer) {
  return eagerPages?.[name] || lazy(importer)
}

const AuthPage = loadPageForRoute('AuthPage', () => import('./pages/AuthPage'))
const FormsLabPage = loadPageForRoute('FormsLabPage', () => import('./pages/FormsLabPage'))
const HomePage = loadPageForRoute('HomePage', () => import('./pages/HomePage'))
const PrivacyPage = loadPageForRoute('PrivacyPage', () => import('./pages/PrivacyPage'))
const ThankYouPage = loadPageForRoute('ThankYouPage', () => import('./pages/ThankYouPage'))
const TagLabPage = loadPageForRoute('TagLabPage', () => import('./pages/TagLabPage'))
const TagWorkspacePage = loadPageForRoute('TagWorkspacePage', () => import('./pages/TagWorkspacePage'))
const UtmBuilderPage = loadPageForRoute('UtmBuilderPage', () => import('./pages/UtmBuilderPage'))

function PageFallback() {
  return <div className="page-loading" role="status">Loading page…</div>
}

function TrackedLayout() {
  usePageTracking()
  return <Layout />
}

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="tag-workspace" element={<TagWorkspacePage />} />
        <Route element={<TrackedLayout />}>
          <Route index element={<HomePage />} />
          <Route path="forms" element={<FormsLabPage />} />
          <Route path="contact" element={<Navigate replace to="/forms?experiment=contact" />} />
          <Route path="callback" element={<Navigate replace to="/forms?experiment=callback" />} />
          <Route path="newsletter" element={<Navigate replace to="/forms?experiment=newsletter" />} />
          <Route path="utm-builder" element={<UtmBuilderPage />} />
          <Route path="tag-lab" element={<TagLabPage />} />
          <Route path="login" element={<AuthPage />} />
          <Route path="thank-you" element={<ThankYouPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
