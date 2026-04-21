import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import LoginModal from './components/LoginModal'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('drako_token')
    const userData = localStorage.getItem('drako_user')
    
    if (token && userData) {
      setIsAuthenticated(true)
      setUser(JSON.parse(userData))
    }
  }, [])

  const handleLogin = (token, userData) => {
    localStorage.setItem('drako_token', token)
    localStorage.setItem('drako_user', JSON.stringify(userData))
    setIsAuthenticated(true)
    setUser(userData)
    setShowLogin(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('drako_token')
    localStorage.removeItem('drako_user')
    setIsAuthenticated(false)
    setUser(null)
  }

  return (
    <div className="App">
      <Routes>
        <Route 
          path="/" 
          element={
            isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <LandingPage onLoginClick={() => setShowLogin(true)} />
          } 
        />
        <Route 
          path="/dashboard/*" 
          element={
            isAuthenticated ? 
              <Dashboard user={user} onLogout={handleLogout} /> : 
              <Navigate to="/" replace />
          } 
        />
      </Routes>
      
      {showLogin && (
        <LoginModal 
          onClose={() => setShowLogin(false)} 
          onLogin={handleLogin} 
        />
      )}
    </div>
  )
}

export default App
