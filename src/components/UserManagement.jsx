import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit, Trash2, X, Eye, EyeOff, Users } from 'lucide-react'
import './UserManagement.css'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rol: 'user'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('drako_token')
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': Bearer 
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const token = localStorage.getItem('drako_token')
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': Bearer 
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error creando usuario')
      }

      setUsers([...users, data.user])
      setShowCreateModal(false)
      setFormData({ username: '', password: '', rol: 'user' })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    if (error) setError('')
  }

  if (loading) {
    return (
      <div className="user-management">
        <div className="loading">Cargando usuarios...</div>
      </div>
    )
  }

  return (
    <div className="user-management">
      <div className="page-header">
        <div className="header-content">
          <h1>
            <Users size={32} />
            Gestión de Usuarios
          </h1>
          <p>Administra las cuentas de usuario del sistema</p>
        </div>
        <button 
          className="create-user-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={20} />
          Nuevo Usuario
        </button>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Fecha de Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>
                  <span className={ole-badge }>
                    {user.rol}
                  </span>
                </td>
                <td>
                  <span className={status-badge }>
                    {user.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn edit" title="Editar">
                      <Edit size={16} />
                    </button>
                    <button className="action-btn delete" title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div 
              className="modal-content"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Crear Nuevo Usuario</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="user-form">
                <div className="form-group">
                  <label htmlFor="username">Usuario</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Ingresa el nombre de usuario"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Contraseña</label>
                  <div className="password-input">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Ingresa la contraseña"
                      required
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="rol">Rol</label>
                  <select
                    id="rol"
                    name="rol"
                    value={formData.rol}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  >
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default UserManagement
