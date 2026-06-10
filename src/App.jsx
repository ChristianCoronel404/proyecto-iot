import { useEffect, useMemo, useState } from 'react';
import LandingPage from './pages/LandingPage';
import LoginModal from './components/LoginModal';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import { getUserCookie, loginCookies, logoutCookies, setUserCookie } from './utils/auth';

const STORAGE_VIEW_KEY = 'drako.view';

const isAdminUser = (user) => {
  const role = String(user?.role || user?.rol || '').trim().toLowerCase();
  return role === 'admin' || role === 'administrador total';
};

const readStoredUser = () => getUserCookie();

const readStoredView = () => {
  try {
    return localStorage.getItem(STORAGE_VIEW_KEY) || 'landing';
  } catch {
    return 'landing';
  }
};

function App() {
  const [user, setUser] = useState(() => readStoredUser());
  const [currentView, setCurrentView] = useState(() => readStoredView()); // landing, dashboard, admin, profile
  const [showLoginModal, setShowLoginModal] = useState(false);

  const isAdmin = useMemo(() => isAdminUser(user), [user]);

  useEffect(() => {
    if (!user) {
      setCurrentView('landing');
      try {
        localStorage.removeItem(STORAGE_VIEW_KEY);
      } catch { /* ignore */ }
      return;
    }

    if (currentView === 'landing') {
      setCurrentView('dashboard');
      return;
    }

    if (!isAdmin && currentView === 'admin') {
      setCurrentView('dashboard');
    }
  }, [user, currentView, isAdmin]);

  useEffect(() => {
    if (!user) return;
    try {
      setUserCookie(user);
      localStorage.setItem(STORAGE_VIEW_KEY, currentView);
    } catch { /* ignore */ }
  }, [user, currentView]);

  const handleViewChange = (nextView) => {
    if (!user) {
      setCurrentView('landing');
      return;
    }

    if (!isAdmin && nextView === 'admin') {
      setCurrentView('dashboard');
      return;
    }

    setCurrentView(nextView);
  };

  const handleLogin = (userData) => {
    loginCookies(userData);   // limpia todas las cookies del dominio y setea auth_drako
    setUser(userData);
    setShowLoginModal(false);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    logoutCookies();          // limpia todas las cookies del dominio
    setUser(null);
    setCurrentView('landing');
    setShowLoginModal(false);
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  // Renderizado del contenido interno del Layout Privado
  const renderPrivateView = () => {
    switch(currentView) {
      case 'dashboard': return <Dashboard />;
      case 'admin': return isAdmin ? <Admin /> : <Dashboard />;
      case 'profile': return <Profile user={user} onUserUpdate={handleUserUpdate} />;
      default: return <Dashboard />;
    }
  };

  if (currentView === 'landing' || !user) {
    return (
      <>
        <LandingPage onLoginClick={() => setShowLoginModal(true)} />
        {showLoginModal && (
          <LoginModal 
            onClose={() => setShowLoginModal(false)} 
            onLogin={handleLogin} 
          />
        )}
      </>
    );
  }

  // Si no está en 'landing', mostramos el Layout privado
  return (
    <Layout 
      user={user} 
      isAdmin={isAdmin}
      currentView={currentView} 
      onViewChange={handleViewChange} 
      onLogout={handleLogout}
    >
      {renderPrivateView()}
    </Layout>
  );
}

export default App;
