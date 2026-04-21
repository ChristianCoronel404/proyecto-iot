import React, { useState, useEffect } from 'react';
import { User, Settings, Eye, EyeOff, Save, CheckCircle, XCircle } from 'lucide-react';
import './AccountSettings.css';

const AccountSettings = () => {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setFormData(prev => ({
          ...prev,
          username: userData.username
        }));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      
      // Update username
      if (formData.username !== user.username) {
        const usernameResponse = await fetch('/api/users/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ username: formData.username })
        });

        if (!usernameResponse.ok) {
          throw new Error('Error updating username');
        }
      }

      // Update password if provided
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('New passwords do not match');
        }

        const passwordResponse = await fetch('/api/users/me/password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword
          })
        });

        if (!passwordResponse.ok) {
          const errorData = await passwordResponse.json();
          throw new Error(errorData.message || 'Error updating password');
        }
      }

      setMessage({
        type: 'success',
        text: 'Account settings updated successfully!'
      });

      // Refresh user data
      await fetchUserData();

      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));

    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="account-settings">
      <div className="page-header">
        <div className="header-content">
          <h1>
            <Settings size={32} />
            Account Settings
          </h1>
          <p>Manage your account information and security settings</p>
        </div>
      </div>

      <div className="settings-card">
        {/* User Information Section */}
        <div className="user-info-section">
          <h3>
            <User size={20} />
            User Information
          </h3>
          <div className="user-details">
            <div className="detail-item">
              <span className="label">Username:</span>
              <span className="value">{user?.username}</span>
            </div>
            <div className="detail-item">
              <span className="label">Role:</span>
              <span className="value role-badge">{user?.rol}</span>
            </div>
            <div className="detail-item">
              <span className="label">Status:</span>
              <span className={`value status-badge ${user?.activo ? 'active' : 'inactive'}`}>
                {user?.activo ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Created:</span>
              <span className="value">
                {user?.fecha_creacion ? formatDate(user.fecha_creacion) : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <form className="settings-form" onSubmit={handleSubmit}>
          <h3>
            <Settings size={20} />
            Update Settings
          </h3>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          {/* Password Section */}
          <div className="password-section">
            <h4>Change Password</h4>
            <p className="password-note">Leave blank if you don't want to change your password</p>

            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <div className="password-input">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('current')}
                  disabled={loading}
                >
                  {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div className="password-input">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('new')}
                  disabled={loading}
                >
                  {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="password-input">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('confirm')}
                  disabled={loading}
                >
                  {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div className={`message-alert ${message.type}`}>
              {message.type === 'success' ? (
                <CheckCircle size={18} />
              ) : (
                <XCircle size={18} />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <button type="submit" className="save-btn" disabled={loading}>
            <Save size={18} />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccountSettings;