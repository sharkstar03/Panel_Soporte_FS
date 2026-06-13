import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AssetsPage } from './pages/AssetsPage'
import { SessionsPage } from './pages/SessionsPage'
import { PrintersPage } from './pages/PrintersPage'
import { KBPage } from './pages/KBPage'
import { LinksPage } from './pages/LinksPage'
import { AccessPage } from './pages/AccessPage'
import { AuditPage } from './pages/AuditPage'
import { SettingsPage } from './pages/SettingsPage'
import { PasswordsPage } from './pages/PasswordsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { NewDocumentPage } from './pages/NewDocumentPage'
import { DocumentDetailPage } from './pages/DocumentDetailPage'
import { ApprovalPage } from './pages/ApprovalPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ProfilePage } from './pages/ProfilePage'
import { PageLoader } from './components/ui/Spinner'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-base flex items-center justify-center"><PageLoader /></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequirePerm({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { can, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-base flex items-center justify-center"><PageLoader /></div>
  if (!can(perm)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="printers" element={<RequirePerm perm="printers.view"><PrintersPage /></RequirePerm>} />
        <Route path="kb" element={<KBPage />} />
        <Route path="links" element={<LinksPage />} />
        <Route path="users" element={<RequirePerm perm="users.manage"><AccessPage /></RequirePerm>} />
        <Route path="rbac" element={<Navigate to="/users?tab=roles" replace />} />
        <Route path="doc-templates" element={<Navigate to="/settings?tab=templates" replace />} />
        <Route path="audit" element={<RequirePerm perm="audit.view"><AuditPage /></RequirePerm>} />
        <Route path="settings" element={<RequirePerm perm="settings.manage"><SettingsPage /></RequirePerm>} />
        <Route path="passwords" element={<RequireAuth><PasswordsPage /></RequireAuth>} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/new" element={<NewDocumentPage />} />
        <Route path="documents/:id" element={<DocumentDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="/approve/:token" element={<ApprovalPage />} />
      <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
