import Sidebar from './Sidebar';
import styles from './Layout.module.css';

export default function Layout({ user, currentView, onViewChange, onLogout, children }) {
  const getTitle = () => {
    switch(currentView) {
      case 'dashboard': return 'Telemetría del Vehículo';
      case 'admin': return 'Gestión de Usuarios';
      case 'profile': return 'Mi Cuenta';
      default: return 'Drako OS';
    }
  };

  return (
    <div className={styles.layoutContainer}>
      <Sidebar 
        currentView={currentView} 
        onViewChange={onViewChange} 
        onLogout={onLogout} 
      />
      
      <main className={styles.mainContent}>
        <header className={styles.header}>
          <h1 className={styles.title}>{getTitle()}</h1>
          <div className={styles.userBadge}>
            👤 {user?.username} ({user?.role})
          </div>
        </header>
        
        {children}
      </main>
    </div>
  );
}
