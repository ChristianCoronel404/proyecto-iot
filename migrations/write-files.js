const fs = require('fs');

const serverCode = `import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const logAudit = async (userId, action, tableName, recordId, description) => {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, description, timestamp) VALUES (\$1, \$2, \$3, \$4, \$5, NOW())',
      [userId, action, tableName, recordId, description]
    );
  } catch (error) {
    console.error('Audit logging error:', error);
  }
};

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const result = await pool.query(
      'SELECT id, username, password_hash, rol, activo FROM usuarios WHERE username = \$1',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    if (!user.activo) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    await logAudit(user.id, 'LOGIN', 'usuarios', user.id, \`Usuario \${user.username} inició sesión\`);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, rol, activo, created_at as fecha_creacion FROM usuarios WHERE id = \$1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const existingUser = await pool.query(
      'SELECT id FROM usuarios WHERE username = \$1 AND id != \$2',
      [username, req.user.id]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const result = await pool.query(
      'UPDATE usuarios SET username = \$1 WHERE id = \$2 RETURNING id, username, rol, activo, created_at as fecha_creacion',
      [username, req.user.id]
    );
    await logAudit(req.user.id, 'UPDATE', 'usuarios', req.user.id, \`Usuario actualizó su información\`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/me/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    const userResult = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = \$1',
      [req.user.id]
    );
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE usuarios SET password_hash = \$1 WHERE id = \$2',
      [hashedPassword, req.user.id]
    );
    await logAudit(req.user.id, 'UPDATE', 'usuarios', req.user.id, \`Usuario cambió su contraseña\`);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, rol, activo, created_at as fecha_creacion FROM usuarios ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { username, password, rol } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    const existingUser = await pool.query(
      'SELECT id FROM usuarios WHERE username = \$1',
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (username, password_hash, rol) VALUES (\$1, \$2, \$3) RETURNING id, username, rol, activo, created_at as fecha_creacion',
      [username, hashedPassword, rol || 'user']
    );
    await logAudit(req.user.id, 'CREATE', 'usuarios', result.rows[0].id, \`Usuario \${username} creado por \${req.user.username}\`);
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, rol, activo } = req.body;
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const existingUser = await pool.query(
      'SELECT id FROM usuarios WHERE username = \$1 AND id != \$2',
      [username, id]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const result = await pool.query(
      'UPDATE usuarios SET username = \$1, rol = \$2, activo = \$3 WHERE id = \$4 RETURNING id, username, rol, activo, created_at as fecha_creacion',
      [username, rol, activo, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    await logAudit(req.user.id, 'UPDATE', 'usuarios', id, \`Usuario \${username} actualizado por \${req.user.username}\`);
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const result = await pool.query(
      'DELETE FROM usuarios WHERE id = \$1 RETURNING username',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    await logAudit(req.user.id, 'DELETE', 'usuarios', id, \`Usuario \${result.rows[0].username} eliminado por \${req.user.username}\`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sensors/dht22', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(
      'SELECT id, temperature, humidity, timestamp FROM dht22_data ORDER BY timestamp DESC LIMIT \$1',
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get DHT22 data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sensors/gy50', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(
      'SELECT id, x, y, z, timestamp FROM gy50_data ORDER BY timestamp DESC LIMIT \$1',
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get GY50 data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sensors/hcsr04', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(
      'SELECT id, distance, timestamp FROM hcsr04_data ORDER BY timestamp DESC LIMIT \$1',
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get HC-SR04 data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`;

// Write using Buffer.from() to ensure UTF-8
const buf = Buffer.from(serverCode, 'utf8');
fs.writeFileSync('server/index.js', buf);
console.log('File created successfully with UTF-8 encoding');
