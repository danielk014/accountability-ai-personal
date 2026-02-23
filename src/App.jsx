import { Toaster } from "@/components/ui/toaster"
import { runCleanup } from '@/api/supabaseDB'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from './pages/Login';
import { Loader2 } from 'lucide-react';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout
  ? <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Runs cleanup once per login session for the current user
function CleanupRunner() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated) runCleanup();
  }, [isAuthenticated]);
  return null;
}

// Wraps protected routes — redirects to /Login if not authenticated
const AuthenticatedApp = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/Login" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <CleanupRunner />
          <Routes>
            {/* Public route — no layout */}
            <Route path="/Login" element={<LoginOrRedirect />} />
            {/* All other routes — protected */}
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

// If already logged in, redirect away from login page
function LoginOrRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
    </div>
  );
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Login />;
}

export default App;
