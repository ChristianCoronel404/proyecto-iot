import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  User, 
  LogOut, 
  Menu, 
  X,
  Car
} from 'lucide-react'
import './Sidebar.css'

const Sidebar = ({ user, onLogout, isOpen, onToggle }) => {
  const location = useLocation()

  const menuItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'user']
    },
    {
      path: '/dashboard/users',
      label: 'Registro de Cuentas',
      icon: Users,
      roles: ['admin']
    },
    {
      path: '/dashboard/account',
      label: 'Gestión de Cuenta',
      icon: User,
      roles: ['admin', 'user']
    }
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user.rol)
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onToggle} />
      )}

      <aside className={sidebar }>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Car size={24} />
            {isOpen && <span>Drako</span>}
          </div>
          <button className="sidebar-toggle" onClick={onToggle}>
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={sidebar-link }
                title={!isOpen ? item.label : ''}
              >
                <Icon size={20} />
                {isOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            {isOpen && (
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className="user-role">{user.rol}</div>
              </div>
            )}
          </div>
          
          <button 
            className="sidebar-logout"
            onClick={onLogout}
            title={!isOpen ? 'Cerrar Sesión' : ''}
          >
            <LogOut size={20} />
            {isOpen && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
