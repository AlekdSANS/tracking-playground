import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { usePageTracking } from './hooks/usePageTracking'
import AuthPage from './pages/AuthPage'
import FormsLabPage from './pages/FormsLabPage'
import HomePage from './pages/HomePage'
import PrivacyPage from './pages/PrivacyPage'
import ThankYouPage from './pages/ThankYouPage'
import TagLabPage from './pages/TagLabPage'
import TagWorkspacePage from './pages/TagWorkspacePage'
import UtmBuilderPage from './pages/UtmBuilderPage'

function TrackedLayout() {
  usePageTracking()
  return <Layout />
}

function App() {
  return (
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
  )
}

export default App
