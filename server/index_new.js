import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'drako-secret-key'

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en el archivo .env')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

app.use(cors())
app.use(express.json())

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invÃ¡lido' })
    }
    req.user = user
    next()
  })
}

// Middleware para verificar rol de admin
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de admin' })
  }
  next()
}

// FunciÃ³n para registrar en auditorÃ­a
const logAudit = async (usuarioId, accion, tablaAfectada, registroId, descripcion) => {
  try {
    await pool.query(
      'INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, descripcion) VALUES ($1, $2, $3, $4, $5)',
      [usuarioId, accion, tablaAfectada, registroId, descripcion]
    )
  } catch (error) {
    console.error('Error al registrar auditorÃ­a:', error)
  }
}

// Rutas de autenticaciÃ³n
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password requeridos' })
    }

    const result = await pool.query(
      'SELECT id, username, password_hash, rol, activo FROM usuarios WHERE username = $1',
      [username]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales invÃ¡lidas' })
    }

    const user = result.rows[0]

    if (!user.activo) {
      return res.status(401).json({ error: 'Usuario inactivo' })
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invÃ¡lidas' })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    await logAudit(user.id, 'LOGIN', 'usuarios', user.id, `Usuario ${user.username} iniciÃ³ sesiÃ³n`)

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol
      }
    })
  } catch (error) {
    console.error('Error en login:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Rutas protegidas
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, rol, activo, created_at FROM usuarios WHERE id = $1',
      [req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    res.json({ user: result.rows[0] })
  } catch (error) {
    console.error('Error obteniendo usuario:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// GestiÃ³n de usuarios (solo admin)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, rol, activo, created_at FROM usuarios ORDER BY created_at DESC'
    )
    res.json({ users: result.rows })
  } catch (error) {
    console.error('Error obteniendo usuarios:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, rol } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password requeridos' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await pool.query(
      'INSERT INTO usuarios (username, password_hash, rol) VALUES ($1, $2, $3) RETURNING id, username, rol, activo, created_at',
      [username, hashedPassword, rol || 'user']
    )

    await logAudit(req.user.id, 'CREATE', 'usuarios', result.rows[0].id, `Usuario ${username} creado por ${req.user.username}`)

    res.status(201).json({ user: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'El username ya existe' })
    }
    console.error('Error creando usuario:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Actualizar usuario propio
app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { username, password } = req.body

    let query = 'UPDATE usuarios SET username = $1'
    let params = [username]

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      query += ', password_hash = $2'
      params.push(hashedPassword)
    }

    query += ' WHERE id = $' + (params.length + 1) + ' RETURNING id, username, rol, activo, created_at'
    params.push(req.user.id)

    const result = await pool.query(query, params)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    await logAudit(req.user.id, 'UPDATE', 'usuarios', req.user.id, `Usuario ${req.user.username} actualizÃ³ su perfil`)

    res.json({ user: result.rows[0] })
  } catch (error) {
    if (error.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'El username ya existe' })
    }
    console.error('Error actualizando usuario:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Datos del sensor DHT22
app.get('/api/sensors/dht22/latest', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT temperatura, humedad, fecha, hora, created_at FROM dht22_data ORDER BY created_at DESC LIMIT 1'
    )
    res.json({ data: result.rows[0] || null })
  } catch (error) {
    console.error('Error obteniendo datos DHT22:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

app.get('/api/sensors/dht22/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const result = await pool.query(
      'SELECT temperatura, humedad, fecha, hora, created_at FROM dht22_data ORDER BY created_at DESC LIMIT $1',
      [limit]
    )
    res.json({ data: result.rows })
  } catch (error) {
    console.error('Error obteniendo historial DHT22:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Datos del sensor GY50
app.get('/api/sensors/gy50/latest', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT gyro_x, gyro_y, gyro_z, temp_raw, raw_x, raw_y, raw_z, fecha, hora, created_at FROM gy50_data ORDER BY created_at DESC LIMIT 1'
    )
    res.json({ data: result.rows[0] || null })
  } catch (error) {
    console.error('Error obteniendo datos GY50:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

app.get('/api/sensors/gy50/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const result = await pool.query(
      'SELECT gyro_x, gyro_y, gyro_z, temp_raw, raw_x, raw_y, raw_z, fecha, hora, created_at FROM gy50_data ORDER BY created_at DESC LIMIT $1',
      [limit]
    )
    res.json({ data: result.rows })
  } catch (error) {
    console.error('Error obteniendo historial GY50:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Datos del sensor HC-SR04
app.get('/api/sensors/hcsr04/latest', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT tiempo_echo, distancia_cm, fecha, hora, created_at FROM hcsr04_data ORDER BY created_at DESC LIMIT 1'
    )
    res.json({ data: result.rows[0] || null })
  } catch (error) {
    console.error('Error obteniendo datos HC-SR04:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

app.get('/api/sensors/hcsr04/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const result = await pool.query(
      'SELECT tiempo_echo, distancia_cm, fecha, hora, created_at FROM hcsr04_data ORDER BY created_at DESC LIMIT $1',
      [limit]
    )
    res.json({ data: result.rows })
  } catch (error) {
    console.error('Error obteniendo historial HC-SR04:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`ðŸš€ Servidor Drako ejecutÃ¡ndose en puerto ${PORT}`)
})
