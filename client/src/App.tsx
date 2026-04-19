import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { SKIP_AUTH_FOR_TESTING } from './config/testAuth';
import { SkeletonBlock } from './components/shared/SkeletonBlock';
import { ForbiddenPage } from './features/system/ForbiddenPage';
import { NotFoundPage } from './features/system/NotFoundPage';

const LoginPage = lazy(() => import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./features/worker/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ShiftsPage = lazy(() => import('./features/worker/ShiftsPage').then((m) => ({ default: m.ShiftsPage })));
const ShiftLogForm = lazy(() => import('./features/worker/ShiftLogForm').then((m) => ({ default: m.ShiftLogForm })));
const CsvImportPage = lazy(() => import('./features/worker/CsvImportPage').then((m) => ({ default: m.CsvImportPage })));
const CertificatePage = lazy(() => import('./features/certificate/CertificatePage').then((m) => ({ default: m.CertificatePage })));
const VerificationQueuePage = lazy(() =>
  import('./features/verifier/VerificationQueuePage').then((m) => ({ default: m.VerificationQueuePage })),
);
const AnalyticsDashboardPage = lazy(() =>
  import('./features/advocate/AnalyticsDashboardPage').then((m) => ({ default: m.AnalyticsDashboardPage })),
);
const GrievanceBoardPage = lazy(() =>
  import('./features/grievance/GrievanceBoardPage').then((m) => ({ default: m.GrievanceBoardPage })),
);
const DevHubPage = lazy(() => import('./features/dev/DevHubPage').then((m) => ({ default: m.DevHubPage })));
const LandingPage = lazy(() => import('./features/landing/LandingPage').then((m) => ({ default: m.LandingPage })));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-8">
      <SkeletonBlock lines={3} />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/dev" element={<DevHubPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/unauthorized" element={<Navigate to="/403" replace />} />

        <Route element={<ProtectedRoute allowedRoles={['worker']} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/shifts/new" element={<ShiftLogForm />} />
          <Route path="/shifts/import" element={<CsvImportPage />} />
          <Route path="/certificate" element={<CertificatePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['verifier']} />}>
          <Route path="/verify" element={<VerificationQueuePage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['advocate']} />}>
          <Route path="/analytics" element={<AnalyticsDashboardPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['worker', 'advocate']} />}>
          <Route path="/community" element={<GrievanceBoardPage />} />
        </Route>

        <Route
          path="/"
          element={<Navigate to={SKIP_AUTH_FOR_TESTING ? '/dev' : '/dashboard'} replace />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
