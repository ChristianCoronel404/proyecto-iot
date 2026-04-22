import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'
import express from 'express'
import path from 'path'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
})

const { Pool } = pg
const app = express()
const PORT = process.env.PORT || 4000

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en el archivo .env')
}

const shouldUseSsl = process.env.DATABASE_URL.includes('localhost')
  ? false
  : {
    rejectUnauthorized: false,
  }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl,
})

pool.on('error', (error) => {
  // Evita que cortes temporales del pool tumben el proceso completo.
  console.error('[DB_POOL_ERROR]', error?.code || 'UNKNOWN', error?.message || error)
})

app.use(cors())
app.use(express.json())

const sseClients = new Set()

const dashboardCache = {
  dht22: [],
  gy50: [],
  hcsr04: [],
  auditoria: [],
}

const realtimeState = {
  dht22: null,
  gy50: null,
  hcsr04: null,
  updatedAt: null,
}

const displayRole = (role) => (String(role || '').toLowerCase() === 'admin' ? 'Admin' : 'Usuario')

const normalizeRoleForDb = (role) => {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'admin' || value === 'administrador total') {
    return 'admin'
  }
  return 'user'
}

const hashPassword = (password) => {
  return bcrypt.hashSync(password, 10)
}

const verifyPassword = (password, storedHash) => {
  if (typeof storedHash !== 'string' || !storedHash.length) {
    return false
  }

  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(password, storedHash)
    } catch {
      return false
    }
  }

  if (!storedHash.startsWith('scrypt$')) {
    return password === storedHash
  }

  const parts = storedHash.split('$')
  if (parts.length !== 3) {
    return false
  }

  const [, salt, originalKeyHex] = parts
  const comparisonKeyHex = crypto.scryptSync(password, salt, 64).toString('hex')
  const originalBuffer = Buffer.from(originalKeyHex, 'hex')
  const comparisonBuffer = Buffer.from(comparisonKeyHex, 'hex')

  if (originalBuffer.length !== comparisonBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(originalBuffer, comparisonBuffer)
}

const createAuditEntry = async ({ usuarioId = null, accion, tablaAfectada = null, registroId = null, descripcion = null }) => {
  try {
    await pool.query(
      `
      INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, descripcion)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [usuarioId, accion, tablaAfectada, registroId, descripcion],
    )
  } catch {
    // No bloquea la operacion principal si falla el log de auditoria.
  }
}

const toNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

const normalizeIotTable = (value) => {
  const table = String(value || '').trim().toLowerCase()
  const tableAliases = {
    dht22: 'dht22_data',
    dht: 'dht22_data',
    dht22_data: 'dht22_data',
    gy50: 'gy50_data',
    mpu6050: 'gy50_data',
    gy50_data: 'gy50_data',
    hcsr04: 'hcsr04_data',
    hc_sr04: 'hcsr04_data',
    hcsr04_data: 'hcsr04_data',
  }

  return tableAliases[table] || table
}

const parseDeviceId = (payload = {}) => {
  const candidates = [
    payload.dispositivo_id,
    payload.dispositivoId,
    payload.device_id,
    payload.deviceId,
    payload.id_dispositivo,
    payload.id,
  ]

  for (const candidate of candidates) {
    const parsed = Number.parseInt(candidate, 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return 1
}

const normalizeDhtPayload = (payload = {}) => ({
  temperatura: toNumber(payload.temperatura ?? payload.temp ?? payload.temperature),
  humedad: toNumber(payload.humedad ?? payload.hum ?? payload.humidity),
})

const normalizeGyroPayload = (payload = {}) => ({
  gyroX: toNumber(payload.gyro_x ?? payload.gyroX ?? payload.pitch ?? payload.x),
  gyroY: toNumber(payload.gyro_y ?? payload.gyroY ?? payload.yaw ?? payload.y),
  gyroZ: toNumber(payload.gyro_z ?? payload.gyroZ ?? payload.roll ?? payload.z),
  rawX: Number.isFinite(Number(payload.raw_x ?? payload.rawX))
    ? Number.parseInt(payload.raw_x ?? payload.rawX, 10)
    : null,
  rawY: Number.isFinite(Number(payload.raw_y ?? payload.rawY))
    ? Number.parseInt(payload.raw_y ?? payload.rawY, 10)
    : null,
  rawZ: Number.isFinite(Number(payload.raw_z ?? payload.rawZ))
    ? Number.parseInt(payload.raw_z ?? payload.rawZ, 10)
    : null,
  tempRaw: toNumber(payload.temp_raw ?? payload.tempRaw),
})

const normalizeHcsr04Payload = (payload = {}) => ({
  distanciaCm: toNumber(payload.distancia_cm ?? payload.distancia ?? payload.distance ?? payload.dist),
  tiempoEcho: Number.isFinite(Number(payload.tiempo_echo ?? payload.tiempoEcho ?? payload.echo_time))
    ? Number.parseInt(payload.tiempo_echo ?? payload.tiempoEcho ?? payload.echo_time, 10)
    : null,
})

const formatTimeLabel = (row) => {
  const rawHora = row.hora ? String(row.hora).slice(0, 8) : null
  if (rawHora) {
    return rawHora
  }

  if (!row.created_at) {
    return '--:--'
  }

  const parsed = new Date(row.created_at)
  if (Number.isNaN(parsed.getTime())) {
    return '--:--'
  }

  return parsed.toISOString().slice(11, 19)
}

const cloneDashboardCache = () => ({
  dht22: [...dashboardCache.dht22],
  gy50: [...dashboardCache.gy50],
  hcsr04: [...dashboardCache.hcsr04],
  auditoria: [...dashboardCache.auditoria],
})

const cloneRealtimeState = () => ({
  dht22: realtimeState.dht22,
  gy50: realtimeState.gy50,
  hcsr04: realtimeState.hcsr04,
  updatedAt: realtimeState.updatedAt,
})

const pushRealtimeUpdate = () => {
  sendSseMessage({
    type: 'sensor-realtime',
    data: cloneRealtimeState(),
  })
}

const appendAuditLog = ({ action, table, desc, user = 'esp32', type = 'info' }) => {
  const now = new Date()
  const newLog = {
    id: `rt-${now.getTime()}`,
    user,
    action,
    table,
    desc,
    time: now.toISOString().slice(11, 19),
    type,
  }

  dashboardCache.auditoria = [newLog, ...(dashboardCache.auditoria || [])].slice(0, 80)
}

const pushDashboardUpdate = () => {
  sendSseMessage({
    type: 'dashboard-update',
    data: cloneDashboardCache(),
  })
}

const syncAndPushDashboardUpdate = async () => {
  await refreshDashboardCacheFromDb()
  pushDashboardUpdate()
}

const fetchDashboardData = async () => {
  const [dht22Result, gy50Result, hcsr04Result, auditoriaResult] = await Promise.all([
    pool.query(`
      SELECT id, temperatura, humedad, dispositivo_id, fecha, hora, created_at
      FROM dht22_data
      ORDER BY created_at DESC, id DESC
      LIMIT 120
    `),
    pool.query(`
      SELECT id, gyro_x, gyro_y, gyro_z, raw_x, raw_y, raw_z, dispositivo_id, fecha, hora, created_at
      FROM gy50_data
      ORDER BY created_at DESC, id DESC
      LIMIT 120
    `),
    pool.query(`
      SELECT id, tiempo_echo, distancia_cm, dispositivo_id, fecha, hora, created_at
      FROM hcsr04_data
      ORDER BY created_at DESC, id DESC
      LIMIT 120
    `),
    pool.query(`
      SELECT
        a.id,
        a.usuario_id,
        COALESCE(u.username, 'system') AS usuario,
        a.accion,
        a.tabla_afectada,
        a.registro_id,
        a.descripcion,
        a.fecha
      FROM auditoria a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ORDER BY a.fecha DESC, a.id DESC
      LIMIT 80
    `),
  ])

  const dht22 = dht22Result.rows
    .reverse()
    .map((row) => ({
      id: row.id,
      time: formatTimeLabel(row),
      temp: toNumber(row.temperatura),
      hum: toNumber(row.humedad),
      dispositivoId: row.dispositivo_id,
      fecha: row.fecha,
      hora: row.hora,
      created_at: row.created_at,
    }))

  const gy50 = gy50Result.rows
    .reverse()
    .map((row) => ({
      id: row.id,
      time: formatTimeLabel(row),
      gyroX: toNumber(row.gyro_x),
      gyroY: toNumber(row.gyro_y),
      gyroZ: toNumber(row.gyro_z),
      dispositivoId: row.dispositivo_id,
      fecha: row.fecha,
      hora: row.hora,
      created_at: row.created_at,
    }))

  const hcsr04 = hcsr04Result.rows
    .reverse()
    .map((row) => ({
      id: row.id,
      time: formatTimeLabel(row),
      dist: toNumber(row.distancia_cm),
      tiempoEcho: row.tiempo_echo,
      dispositivoId: row.dispositivo_id,
      fecha: row.fecha,
      hora: row.hora,
      created_at: row.created_at,
    }))

  const auditoria = auditoriaResult.rows.map((row) => ({
    id: row.id,
    user: row.usuario,
    action: row.accion,
    table: row.tabla_afectada,
    desc: row.descripcion,
    time: row.fecha ? new Date(row.fecha).toISOString().slice(11, 19) : '--:--:--',
    type: String(row.accion || '').toLowerCase().includes('error')
      ? 'warning'
      : String(row.accion || '').toLowerCase().includes('login')
        ? 'success'
        : 'info',
  }))

  return {
    dht22,
    gy50,
    hcsr04,
    auditoria,
  }
}

const refreshDashboardCacheFromDb = async () => {
  const snapshot = await fetchDashboardData()
  dashboardCache.dht22 = snapshot.dht22
  dashboardCache.gy50 = snapshot.gy50
  dashboardCache.hcsr04 = snapshot.hcsr04
  dashboardCache.auditoria = snapshot.auditoria
}

const sendSseMessage = (payload) => {
  const message = `data: ${JSON.stringify(payload)}\n\n`
  for (const client of sseClients) {
    client.write(message)
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/realtime-state', (_req, res) => {
  res.json(cloneRealtimeState())
})

app.get('/api/iot/ping', (_req, res) => {
  res.json({ ok: true, service: 'iot-ingest' })
})

app.post('/api/iot/realtime', async (req, res) => {
  try {
    await syncAndPushDashboardUpdate()
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo sincronizar el dashboard' })
  }
})

app.post('/api/iot/stream', async (req, res) => {
  const payload = req.body || {}
  const dispositivoId = parseDeviceId(payload)
  const now = new Date()
  const timeLabel = now.toISOString().slice(11, 19)
  const accepted = []

  try {
    const dhtPayload = payload.dht22
    if (dhtPayload && typeof dhtPayload === 'object') {
      const { temperatura, humedad } = normalizeDhtPayload(dhtPayload)
      if (Number.isFinite(temperatura) && Number.isFinite(humedad)) {
        accepted.push('dht22_data')
        realtimeState.dht22 = {
          id: `rt-${now.getTime()}-dht`,
          time: timeLabel,
          temp: temperatura,
          hum: humedad,
          dispositivoId,
          created_at: now.toISOString(),
        }

        pool.query(
          `
          INSERT INTO dht22_data (temperatura, humedad, dispositivo_id)
          VALUES ($1, $2, $3)
        `,
          [temperatura, humedad, dispositivoId],
        ).catch(() => {
          appendAuditLog({
            action: 'IOT_WRITE_ERROR',
            table: 'dht22_data',
            desc: 'Falló persistencia de lectura DHT22',
            type: 'warning',
          })
        })
      }
    }

    const gyroPayload = payload.gy50
    if (gyroPayload && typeof gyroPayload === 'object') {
      const { gyroX, gyroY, gyroZ, rawX, rawY, rawZ, tempRaw } = normalizeGyroPayload(gyroPayload)
      if (Number.isFinite(gyroX) && Number.isFinite(gyroY) && Number.isFinite(gyroZ)) {
        accepted.push('gy50_data')
        realtimeState.gy50 = {
          id: `rt-${now.getTime()}-gy`,
          time: timeLabel,
          gyroX,
          gyroY,
          gyroZ,
          dispositivoId,
          created_at: now.toISOString(),
        }

        pool.query(
          `
          INSERT INTO gy50_data (gyro_x, gyro_y, gyro_z, raw_x, raw_y, raw_z, dispositivo_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [gyroX, gyroY, gyroZ, rawX, rawY, rawZ, dispositivoId],
        ).catch(() => {
          appendAuditLog({
            action: 'IOT_WRITE_ERROR',
            table: 'gy50_data',
            desc: 'Falló persistencia de lectura GY50',
            type: 'warning',
          })
        })
      }
    }

    const hcsr04Payload = payload.hcsr04
    if (hcsr04Payload && typeof hcsr04Payload === 'object') {
      const { distanciaCm, tiempoEcho } = normalizeHcsr04Payload(hcsr04Payload)
      if (Number.isFinite(distanciaCm) && Number.isInteger(tiempoEcho)) {
        accepted.push('hcsr04_data')
        realtimeState.hcsr04 = {
          id: `rt-${now.getTime()}-hc`,
          time: timeLabel,
          dist: distanciaCm,
          tiempoEcho,
          dispositivoId,
          created_at: now.toISOString(),
        }

        pool.query(
          `
          INSERT INTO hcsr04_data (tiempo_echo, distancia_cm, dispositivo_id)
          VALUES ($1, $2, $3)
        `,
          [tiempoEcho, distanciaCm, dispositivoId],
        ).catch(() => {
          appendAuditLog({
            action: 'IOT_WRITE_ERROR',
            table: 'hcsr04_data',
            desc: 'Falló persistencia de lectura HC-SR04',
            type: 'warning',
          })
        })
      }
    }

    if (accepted.length === 0) {
      return res.status(400).json({ error: 'Payload stream sin datos válidos de sensores' })
    }

    realtimeState.updatedAt = now.toISOString()
    pushRealtimeUpdate()
    return res.status(202).json({ ok: true, accepted })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error procesando stream IoT' })
  }
})

app.post('/api/iot/:table', async (req, res) => {
  const table = normalizeIotTable(req.params.table)
  const payload = req.body || {}
  const dispositivoId = parseDeviceId(payload)

  if (!Number.isInteger(dispositivoId) || dispositivoId <= 0) {
    return res.status(400).json({ error: 'dispositivo_id inválido' })
  }

  const now = new Date()
  const timeLabel = now.toISOString().slice(11, 19)

  try {
    if (table === 'dht22_data') {
      const temperatura = toNumber(payload.temperatura)
      const humedad = toNumber(payload.humedad)

      if (!Number.isFinite(temperatura) || !Number.isFinite(humedad)) {
        return res.status(400).json({ error: 'temperatura/humedad inválidas' })
      }

      realtimeState.dht22 = {
        id: `rt-${now.getTime()}`,
        time: timeLabel,
        temp: temperatura,
        hum: humedad,
        dispositivoId,
        created_at: now.toISOString(),
      }
      realtimeState.updatedAt = now.toISOString()
      pushRealtimeUpdate()

      pool.query(
        `
        INSERT INTO dht22_data (temperatura, humedad, dispositivo_id)
        VALUES ($1, $2, $3)
      `,
        [temperatura, humedad, dispositivoId],
      ).catch(() => {
        appendAuditLog({
          action: 'IOT_WRITE_ERROR',
          table: 'dht22_data',
          desc: 'Falló persistencia de lectura DHT22',
          type: 'warning',
        })
      })

      return res.status(202).json({ ok: true, table })
    }

    if (table === 'gy50_data') {
      const gyroX = toNumber(payload.gyro_x)
      const gyroY = toNumber(payload.gyro_y)
      const gyroZ = toNumber(payload.gyro_z)
      const rawX = Number.isFinite(Number(payload.raw_x)) ? Number.parseInt(payload.raw_x, 10) : null
      const rawY = Number.isFinite(Number(payload.raw_y)) ? Number.parseInt(payload.raw_y, 10) : null
      const rawZ = Number.isFinite(Number(payload.raw_z)) ? Number.parseInt(payload.raw_z, 10) : null
      const tempRaw = toNumber(payload.temp_raw)

      if (!Number.isFinite(gyroX) || !Number.isFinite(gyroY) || !Number.isFinite(gyroZ)) {
        return res.status(400).json({ error: 'gyro_x/gyro_y/gyro_z inválidos' })
      }

      realtimeState.gy50 = {
        id: `rt-${now.getTime()}`,
        time: timeLabel,
        gyroX,
        gyroY,
        gyroZ,
        dispositivoId,
        created_at: now.toISOString(),
      }
      realtimeState.updatedAt = now.toISOString()
      pushRealtimeUpdate()

      pool.query(
        `
        INSERT INTO gy50_data (gyro_x, gyro_y, gyro_z, raw_x, raw_y, raw_z, dispositivo_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
        [gyroX, gyroY, gyroZ, rawX, rawY, rawZ, dispositivoId],
      ).catch(() => {
        appendAuditLog({
          action: 'IOT_WRITE_ERROR',
          table: 'gy50_data',
          desc: 'Falló persistencia de lectura GY50',
          type: 'warning',
        })
      })

      return res.status(202).json({ ok: true, table })
    }

    if (table === 'hcsr04_data') {
      const distanciaCm = toNumber(payload.distancia_cm)
      const tiempoEcho = Number.parseInt(payload.tiempo_echo, 10)

      if (!Number.isFinite(distanciaCm) || !Number.isInteger(tiempoEcho)) {
        return res.status(400).json({ error: 'distancia_cm/tiempo_echo inválidos' })
      }

      realtimeState.hcsr04 = {
        id: `rt-${now.getTime()}`,
        time: timeLabel,
        dist: distanciaCm,
        tiempoEcho,
        dispositivoId,
        created_at: now.toISOString(),
      }
      realtimeState.updatedAt = now.toISOString()
      pushRealtimeUpdate()

      pool.query(
        `
        INSERT INTO hcsr04_data (tiempo_echo, distancia_cm, dispositivo_id)
        VALUES ($1, $2, $3)
      `,
        [tiempoEcho, distanciaCm, dispositivoId],
      ).catch(() => {
        appendAuditLog({
          action: 'IOT_WRITE_ERROR',
          table: 'hcsr04_data',
          desc: 'Falló persistencia de lectura HC-SR04',
          type: 'warning',
        })
      })

      return res.status(202).json({ ok: true, table })
    }

    return res.status(404).json({ error: 'Tabla IoT no soportada' })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error procesando ingesta IoT' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' })
  }

  try {
    const result = await pool.query(
      `
      SELECT id, username, password_hash, rol, activo, created_at
      FROM usuarios
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
    `,
      [username],
    )

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const foundUser = result.rows[0]
    if (!foundUser.activo) {
      return res.status(403).json({ error: 'Usuario inactivo' })
    }

    const isValid = verifyPassword(password, foundUser.password_hash)
    if (!isValid) {
      await createAuditEntry({
        usuarioId: foundUser.id,
        accion: 'LOGIN_ERROR',
        tablaAfectada: 'usuarios',
        registroId: foundUser.id,
        descripcion: `Intento de login fallido para ${foundUser.username}`,
      })
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    await createAuditEntry({
      usuarioId: foundUser.id,
      accion: 'LOGIN',
      tablaAfectada: 'usuarios',
      registroId: foundUser.id,
      descripcion: `Inicio de sesión exitoso para ${foundUser.username}`,
    })

    return res.json({
      id: foundUser.id,
      username: foundUser.username,
      role: displayRole(foundUser.rol),
      email: `${foundUser.username}@drako.local`,
      activo: foundUser.activo,
      createdAt: foundUser.created_at,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo iniciar sesión' })
  }
})

app.get('/api/users', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, rol, activo, created_at
      FROM usuarios
      ORDER BY id ASC
    `)

    const users = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      rol: displayRole(row.rol),
      password_hash: '******',
      activo: row.activo,
      created_at: row.created_at,
    }))

    return res.json({ users })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo obtener usuarios' })
  }
})

app.post('/api/users', async (req, res) => {
  const username = String(req.body?.username || '').trim().replace(/\s/g, '')
  const password = String(req.body?.password || '')
  const rol = normalizeRoleForDb(req.body?.rol)

  if (username.length < 3) {
    return res.status(400).json({ error: 'El username debe tener al menos 3 caracteres' })
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  }

  try {
    const passwordHash = hashPassword(password)
    const insertResult = await pool.query(
      `
      INSERT INTO usuarios (username, password_hash, rol, activo)
      VALUES ($1, $2, $3, true)
      RETURNING id, username, rol, activo, created_at
    `,
      [username, passwordHash, rol],
    )

    const createdUser = insertResult.rows[0]

    await createAuditEntry({
      accion: 'CREATE_USER',
      tablaAfectada: 'usuarios',
      registroId: createdUser.id,
      descripcion: `Usuario creado: ${createdUser.username}`,
    })

    return res.status(201).json({
      user: {
        id: createdUser.id,
        username: createdUser.username,
        rol: displayRole(createdUser.rol),
        password_hash: '******',
        activo: createdUser.activo,
        created_at: createdUser.created_at,
      },
    })
  } catch (error) {
    const message = String(error.message || '')
    if (message.includes('usuarios_username_key')) {
      return res.status(409).json({ error: 'Ese username ya existe' })
    }

    return res.status(500).json({ error: error.message || 'No se pudo crear el usuario' })
  }
})

app.put('/api/users/:id', async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10)
  const username = String(req.body?.username || '').trim().replace(/\s/g, '')
  const rol = normalizeRoleForDb(req.body?.rol)
  const activo = Boolean(req.body?.activo)
  const password = String(req.body?.password || '')

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'ID de usuario inválido' })
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'El username debe tener al menos 3 caracteres' })
  }

  try {
    const fields = ['username = $1', 'rol = $2', 'activo = $3']
    const values = [username, rol, activo]

    if (password.length > 0) {
      fields.push(`password_hash = $${values.length + 1}`)
      values.push(hashPassword(password))
    }

    values.push(userId)

    const query = `
      UPDATE usuarios
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, username, rol, activo, created_at
    `

    const result = await pool.query(query, values)

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const updatedUser = result.rows[0]

    await createAuditEntry({
      accion: 'UPDATE_USER',
      tablaAfectada: 'usuarios',
      registroId: updatedUser.id,
      descripcion: `Usuario actualizado: ${updatedUser.username}`,
    })

    return res.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        rol: displayRole(updatedUser.rol),
        password_hash: '******',
        activo: updatedUser.activo,
        created_at: updatedUser.created_at,
      },
    })
  } catch (error) {
    const message = String(error.message || '')
    if (message.includes('usuarios_username_key')) {
      return res.status(409).json({ error: 'Ese username ya existe' })
    }

    return res.status(500).json({ error: error.message || 'No se pudo actualizar el usuario' })
  }
})

app.patch('/api/users/:id/status', async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10)
  const activo = Boolean(req.body?.activo)

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'ID de usuario inválido' })
  }

  try {
    const result = await pool.query(
      `
      UPDATE usuarios
      SET activo = $1
      WHERE id = $2
      RETURNING id, username, rol, activo, created_at
    `,
      [activo, userId],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const updatedUser = result.rows[0]

    await createAuditEntry({
      accion: activo ? 'ENABLE_USER' : 'DISABLE_USER',
      tablaAfectada: 'usuarios',
      registroId: updatedUser.id,
      descripcion: `Estado actualizado para ${updatedUser.username}: ${activo ? 'ACTIVO' : 'INACTIVO'}`,
    })

    return res.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        rol: displayRole(updatedUser.rol),
        password_hash: '******',
        activo: updatedUser.activo,
        created_at: updatedUser.created_at,
      },
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo actualizar el estado del usuario' })
  }
})

app.put('/api/profile/:id', async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10)
  const username = String(req.body?.username || '').trim().replace(/\s/g, '')
  const password = String(req.body?.password || '')

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'ID de usuario inválido' })
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'El username debe tener al menos 3 caracteres' })
  }

  try {
    const fields = ['username = $1']
    const values = [username]

    if (password.length > 0) {
      fields.push(`password_hash = $${values.length + 1}`)
      values.push(hashPassword(password))
    }

    values.push(userId)

    const query = `
      UPDATE usuarios
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, username, rol, activo, created_at
    `

    const result = await pool.query(query, values)

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const updatedUser = result.rows[0]

    await createAuditEntry({
      usuarioId: updatedUser.id,
      accion: 'UPDATE_PROFILE',
      tablaAfectada: 'usuarios',
      registroId: updatedUser.id,
      descripcion: `Perfil actualizado: ${updatedUser.username}`,
    })

    return res.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: displayRole(updatedUser.rol),
        email: `${updatedUser.username}@drako.local`,
        activo: updatedUser.activo,
        createdAt: updatedUser.created_at,
      },
    })
  } catch (error) {
    const message = String(error.message || '')
    if (message.includes('usuarios_username_key')) {
      return res.status(409).json({ error: 'Ese username ya existe' })
    }

    return res.status(500).json({ error: error.message || 'No se pudo actualizar el perfil' })
  }
})

app.get('/api/db-status', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        NOW() AS server_time,
        (
          SELECT COUNT(*)
          FROM information_schema.tables
          WHERE table_schema = 'public'
        ) AS public_tables_count
    `)

    const row = result.rows[0]

    res.json({
      database: row.database,
      serverTime: row.server_time,
      publicTablesCount: Number(row.public_tables_count),
    })
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Error al consultar la base de datos',
    })
  }
})

app.get('/api/events', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write(`data: ${JSON.stringify({ type: 'connected', realtime: cloneRealtimeState() })}\n\n`)
  sseClients.add(res)

  _req.on('close', () => {
    sseClients.delete(res)
  })
})

app.get('/api/dashboard-data', async (_req, res) => {
  try {
    const dashboardData = await fetchDashboardData()
    dashboardCache.dht22 = dashboardData.dht22
    dashboardCache.gy50 = dashboardData.gy50
    dashboardCache.hcsr04 = dashboardData.hcsr04
    dashboardCache.auditoria = dashboardData.auditoria
    res.json(dashboardData)
  } catch (error) {
    res.status(500).json({
      error: error.message || 'No se pudieron obtener los datos del dashboard',
    })
  }
})

const sseHeartbeat = setInterval(async () => {
  if (sseClients.size === 0) {
    return
  }

  try {
    await syncAndPushDashboardUpdate()
  } catch {
    // Si falla temporalmente la consulta, el siguiente ciclo reintenta.
  }
}, 2000)

sseHeartbeat.unref()

app.listen(PORT, '0.0.0.0', () => {
  refreshDashboardCacheFromDb().catch(() => {
    // Si falla al arrancar, se repuebla con el heartbeat y /api/dashboard-data.
  })
  console.log(`Backend listo en LAN (0.0.0.0) puerto ${PORT}`)
  console.log(`Prueba local en http://localhost:${PORT}/api/health y en red en http://<TU_IP_LAN>:${PORT}/api/health`)
})
