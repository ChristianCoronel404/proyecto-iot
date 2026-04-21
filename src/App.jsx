import { useState } from 'react';
import LandingPage from './pages/LandingPage';
import LoginModal from './components/LoginModal';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Profile from './pages/Profile';

function App() {
  const [currentView, setCurrentView] = useState('landing'); // landing, dashboard, admin, profile
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
    setShowLoginModal(false);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('landing');
  };

  // Renderizado del contenido interno del Layout Privado
  const renderPrivateView = () => {
    switch(currentView) {
      case 'dashboard': return <Dashboard />;
      case 'admin': return <Admin />;
      case 'profile': return <Profile user={user} />;
      default: return <Dashboard />;
    }
  };

  if (currentView === 'landing') {
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
      currentView={currentView} 
      onViewChange={setCurrentView} 
      onLogout={handleLogout}
    >
      {renderPrivateView()}
    </Layout>
  );
}

export default App;
