import React, { useCallback, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { X } from 'lucide-react';
import { api, getStoredToken, setStoredToken } from './services/api';
import type { AuthUser, DashboardPayload, Examination } from './types';
import { LoginView } from './components/LoginView';
import { Sidebar, SIDEBAR_NAV_ITEMS } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AcademicObservatory3D } from './components/AcademicObservatory3D';
import { AIChatPanel } from './components/AIChatPanel';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentFormPage } from './pages/StudentFormPage';
import { StudentProfilePage } from './pages/StudentProfilePage';
import { SubjectsPage } from './pages/SubjectsPage';
import { ExaminationsPage } from './pages/ExaminationsPage';
import { MarksPage } from './pages/MarksPage';
import { ResultsPage } from './pages/ResultsPage';
import { GradesPage } from './pages/GradesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ImportExportPage } from './pages/ImportExportPage';
import { PythonInspectorPage } from './pages/PythonInspectorPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';

function resolvePageTitle(pathname: string): string {
  if (pathname === '/students/add') return 'Add Student';
  if (/^\/students\/\d+\/edit$/.test(pathname)) return 'Edit Student';
  if (/^\/students\/\d+$/.test(pathname)) return 'Student Profile';
  const match = SIDEBAR_NAV_ITEMS.find((item) => item.to === pathname);
  return match?.label ?? 'Dashboard';
}

interface WorkspaceShellProps {
  user: AuthUser;
  onLogout: () => void;
  examinations: Examination[];
  selectedExamId: number;
  onSelectExam: (id: number) => void;
  dashboard: DashboardPayload | null;
  onDataChanged: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  user,
  onLogout,
  examinations,
  selectedExamId,
  onSelectExam,
  dashboard,
  onDataChanged,
  onNotify,
}) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  const isObservatory = location.pathname === '/observatory-3d';
  const pageTitle = resolvePageTitle(location.pathname);

  return (
    <div className="min-h-screen flex bg-[#F7F7FC] text-[#24243A]">
      <Sidebar
        user={user}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          pageTitle={pageTitle}
          user={user}
          dashboard={dashboard}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenAiDrawer={() => setAiDrawerOpen(true)}
        />

        <main
          className={
            isObservatory
              ? 'flex-1 pb-16 lg:pb-0'
              : 'flex-1 p-5 lg:p-8 pb-24 lg:pb-8 max-w-[1380px] w-full mx-auto'
          }
        >
          <Routes>
            <Route
              path="/dashboard"
              element={
                <DashboardPage
                  data={dashboard}
                  examinations={examinations}
                  selectedExamId={selectedExamId}
                  onSelectExam={onSelectExam}
                  user={user}
                />
              }
            />
            <Route
              path="/observatory-3d"
              element={
                <AcademicObservatory3D
                  results={dashboard?.results ?? []}
                  subjectStats={dashboard?.subject_stats ?? []}
                  examId={selectedExamId}
                />
              }
            />
            <Route
              path="/students"
              element={
                <StudentsPage
                  currentUser={user}
                  onDataChanged={onDataChanged}
                  onNotify={onNotify}
                />
              }
            />
            <Route
              path="/students/add"
              element={
                <ProtectedRoute user={user} requireAdmin>
                  <StudentFormPage onDataChanged={onDataChanged} onNotify={onNotify} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/students/:id/edit"
              element={
                <ProtectedRoute user={user} requireAdmin>
                  <StudentFormPage onDataChanged={onDataChanged} onNotify={onNotify} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/students/:id"
              element={
                <StudentProfilePage
                  currentUser={user}
                  examinations={examinations}
                  selectedExamId={selectedExamId}
                  onSelectExam={onSelectExam}
                  onNotify={onNotify}
                />
              }
            />
            <Route
              path="/subjects"
              element={
                <SubjectsPage
                  currentUser={user}
                  onDataChanged={onDataChanged}
                  onNotify={onNotify}
                />
              }
            />
            <Route
              path="/examinations"
              element={
                <ExaminationsPage
                  currentUser={user}
                  examinations={examinations}
                  selectedExamId={selectedExamId}
                  onSelectExam={onSelectExam}
                  onDataChanged={onDataChanged}
                  onNotify={onNotify}
                />
              }
            />
            <Route
              path="/marks"
              element={
                <MarksPage
                  examinations={examinations}
                  selectedExamId={selectedExamId}
                  onSelectExam={onSelectExam}
                  onDataChanged={onDataChanged}
                  onNotify={onNotify}
                />
              }
            />
            <Route
              path="/results"
              element={
                <ResultsPage
                  results={dashboard?.results ?? []}
                  examinations={examinations}
                  selectedExamId={selectedExamId}
                  onSelectExam={onSelectExam}
                  onNotify={onNotify}
                />
              }
            />
            <Route
              path="/grades"
              element={
                <GradesPage
                  dashboard={dashboard}
                  examinations={examinations}
                  selectedExamId={selectedExamId}
                  onSelectExam={onSelectExam}
                />
              }
            />
            <Route
              path="/reports"
              element={
                <ReportsPage
                  dashboard={dashboard}
                  examinations={examinations}
                  selectedExamId={selectedExamId}
                  onSelectExam={onSelectExam}
                  onNotify={onNotify}
                />
              }
            />
            <Route
              path="/import-export"
              element={
                <ImportExportPage
                  currentUser={user}
                  selectedExamId={selectedExamId}
                  onDataChanged={onDataChanged}
                  onNotify={onNotify}
                />
              }
            />
            <Route path="/ai-advisor" element={<AIChatPanel examId={selectedExamId} />} />
            <Route path="/python-inspector" element={<PythonInspectorPage />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute user={user} requireAdmin>
                  <UsersPage currentUser={user} onNotify={onNotify} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={<SettingsPage currentUser={user} onNotify={onNotify} />}
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <MobileBottomNav />

      {/* Slide-over Quick AI Advisor Drawer */}
      {aiDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#24243A]/40 backdrop-blur-[2px]">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col">
            <div className="px-5 py-3.5 border-b border-[#ECEBF3] flex items-center justify-between">
              <span className="font-display text-sm font-bold text-[#24243A]">
                EduNova AI Advisor Drawer
              </span>
              <button
                type="button"
                onClick={() => setAiDrawerOpen(false)}
                className="p-1.5 rounded-lg text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-3 overflow-hidden">
              <AIChatPanel examId={selectedExamId} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number>(2);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    window.setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 4000);
  }, []);

  const loadWorkspaceData = useCallback(
    async (examIdOverride?: number) => {
      try {
        const exams = await api.getExaminations();
        setExaminations(exams);
        const targetExamId =
          examIdOverride ??
          (exams.some((e) => e.id === selectedExamId) ? selectedExamId : exams[0]?.id ?? 2);
        if (targetExamId !== selectedExamId) {
          setSelectedExamId(targetExamId);
        }
        const dash = await api.getDashboard(targetExamId);
        setDashboard(dash);
      } catch (err: any) {
        notify(err?.message || 'Failed to sync academic data', 'error');
      }
    },
    [selectedExamId, notify]
  );

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    api
      .me()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    if (user) {
      loadWorkspaceData(selectedExamId);
    }
  }, [user, selectedExamId]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Clear local session regardless of network outcome
    } finally {
      setStoredToken(null);
      setUser(null);
      setDashboard(null);
      navigate('/login', { replace: true });
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7FC] text-sm text-[#85859B]">
        Verifying EduNova session...
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginView
                onSuccess={(u) => {
                  setUser(u);
                  navigate('/dashboard', { replace: true });
                }}
              />
            )
          }
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute user={user}>
              {user && (
                <WorkspaceShell
                  user={user}
                  onLogout={handleLogout}
                  examinations={examinations}
                  selectedExamId={selectedExamId}
                  onSelectExam={(id) => setSelectedExamId(id)}
                  dashboard={dashboard}
                  onDataChanged={() => loadWorkspaceData(selectedExamId)}
                  onNotify={notify}
                />
              )}
            </ProtectedRoute>
          }
        />
      </Routes>

      {toast && (
        <div
          className={`fixed bottom-20 lg:bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg border ${
            toast.type === 'error'
              ? 'bg-[#FDECEC] border-[#EF6262]/40 text-[#C23E3E]'
              : 'bg-[#24243A] border-[#24243A] text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
