import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import DashboardHome from '../components/DashboardHome'
import UserManagement from '../components/UserManagement'
import AccountSettings from '../components/AccountSettings'
import './Dashboard.css'

const Dashboard = ({ user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="dashboard">
      <Sidebar 
        user={user} 
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className={dashboard-main }>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/account" element={<AccountSettings user={user} />} />
        </Routes>
      </main>
    </div>
  )
}

export default Dashboard
