import cors from 'cors'
import crypto from 'crypto'
import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import jwt from 'jsonwebtoken'
import path from 'path'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const { Pool } = pg
const app  = express()
const PORT = process.env.PORT || 4000

const JWT_SECRET  = process.env.JWT_SECRET || 'drako-secret-fallback-change-me'
const JWT_EXPIRES = '8h'

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en el archivo .env')
}

const shouldUseSsl = process.env.DATABASE_URL.includes('localhost')
  ? false
  : { rejectUnauthorized: false }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl,
})

pool.on('error', (error) => {
  console.error('[DB_POOL_ERROR]', error?.code || 'UNKNOWN', error?.message || error)
})

app.use(cors())
app.use(express.json())

// ──────────────────────────────────────────────────────────
// ESTADO EN MEMORIA
// ──────────────────────────────────────────────────────────

const browserClients = new Set()

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
  motores: null,
  updatedAt: null,
}

// ──────────────────────────────────────────────────────────
// HELPERS UTILITARIOS
// ──────────────────────────────────────────────────────────

const displayRole = (role) => (String(role || '').toLowerCase() === 'admin' ? 'Admin' : 'Usuario')

const normalizeRoleForDb = (role) => {
  const value = String(role || '').trim().toLowerCase()
  return value === 'admin' || value === 'administrador total' ? 'admin' : 'user'
}

const hashPassword   = (pw) => bcrypt.hashSync(pw, 10)

const verifyPassword = (password, storedHash) => {
  if (typeof storedHash !== 'string' || !storedHash.length) return false
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try { return bcrypt.compareSync(password, storedHash) } catch { return false }
  }
  if (!storedHash.startsWith('scrypt$')) return password === storedHash
  const parts = storedHash.split('$')
  if (parts.length !== 3) return false
  const [, salt, originalKeyHex] = parts
  const comparisonKeyHex = crypto.scryptSync(password, salt, 64).toString('hex')
  const originalBuffer   = Buffer.from(originalKeyHex, 'hex')
  const comparisonBuffer = Buffer.from(comparisonKeyHex, 'hex')
  if (originalBuffer.length !== comparisonBuffer.length) return false
  return crypto.timingSafeEqual(originalBuffer, comparisonBuffer)
}

const createAuditEntry = async ({ usuarioId = null, accion, tablaAfectada = null, registroId = null, descripcion = null }) => {
  try {
    await pool.query(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, descripcion)
       VALUES ($1, $2, $3, $4, $5)`,
      [usuarioId, accion, tablaAfectada, registroId, descripcion],
    )
  } catch { /* No bloquea la operación principal si falla el log. */ }
}

// ── Middlewares JWT ───────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' })
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado. Vuelve a iniciar sesión.' })
  }
}

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (String(req.user?.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Acceso restringido a administradores' })
    }
    next()
  })
}

const toNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

const normalizeIotTable = (value) => {
  const table = String(value || '').trim().toLowerCase()
  const aliases = {
    dht22: 'dht22_data', dht: 'dht22_data', dht22_data: 'dht22_data',
    gy50: 'gy50_data', mpu6050: 'gy50_data', gy50_data: 'gy50_data',
    hcsr04: 'hcsr04_data', hc_sr04: 'hcsr04_data', hcsr04_data: 'hcsr04_data',
  }
  return aliases[table] || table
}

const parseDeviceId = (payload = {}) => {
  for (const key of ['dispositivo_id', 'dispositivoId', 'device_id', 'deviceId', 'id_dispositivo', 'id']) {
    const parsed = Number.parseInt(payload[key], 10)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return 1
}

const normalizeDhtPayload = (p = {}) => ({
  temperatura: toNumber(p.temperatura ?? p.temp ?? p.temperature),
  humedad:     toNumber(p.humedad     ?? p.hum  ?? p.humidity),
})

const normalizeGyroPayload = (p = {}) => ({
  gyroX:   toNumber(p.gyro_x ?? p.gyroX ?? p.pitch ?? p.x),
  gyroY:   toNumber(p.gyro_y ?? p.gyroY ?? p.yaw   ?? p.y),
  gyroZ:   toNumber(p.gyro_z ?? p.gyroZ ?? p.roll  ?? p.z),
  rawX:    Number.isFinite(Number(p.raw_x ?? p.rawX)) ? Number.parseInt(p.raw_x ?? p.rawX, 10) : null,
  rawY:    Number.isFinite(Number(p.raw_y ?? p.rawY)) ? Number.parseInt(p.raw_y ?? p.rawY, 10) : null,
  rawZ:    Number.isFinite(Number(p.raw_z ?? p.rawZ)) ? Number.parseInt(p.raw_z ?? p.rawZ, 10) : null,
  tempRaw: toNumber(p.temp_raw ?? p.tempRaw),
})

const normalizeHcsr04Payload = (p = {}) => ({
  distanciaCm:    toNumber(p.distancia_cm     ?? p.distancia    ?? p.distance     ?? p.dist ?? p.fijo),
  tiempoEcho:     Number.isFinite(Number(p.tiempo_echo ?? p.tiempoEcho ?? p.echo_time))
    ? Number.parseInt(p.tiempo_echo ?? p.tiempoEcho ?? p.echo_time, 10)
    : null,
  distanciaIzqCm:  toNumber(p.distancia_izq_cm  ?? p.distanciaIzqCm  ?? null),
  distanciaDerCm:  toNumber(p.distancia_der_cm  ?? p.distanciaDerCm  ?? null),
  distanciaMovilCm: toNumber(p.distancia_movil_cm ?? p.distanciaMovilCm ?? p.movil ?? null),
  anguloServo:     Number.isFinite(Number(p.angulo_servo ?? p.anguloServo ?? p.servo_angle))
    ? Math.max(0, Math.min(180, Number.parseInt(p.angulo_servo ?? p.anguloServo ?? p.servo_angle, 10)))
    : null,
})

const formatTimeLabel = (row) => {
  const rawHora = row.hora ? String(row.hora).slice(0, 8) : null
  if (rawHora) return rawHora
  if (!row.created_at) return '--:--'
  const rawD = new Date(row.created_at)
  const parsed = new Date(rawD.getTime() - rawD.getTimezoneOffset() * 60000)
  return Number.isNaN(parsed.getTime()) ? '--:--' : parsed.toLocaleTimeString('es-BO', { hour12: false, timeZone: 'America/La_Paz' })
}

const cloneDashboardCache  = () => ({ dht22: [...dashboardCache.dht22], gy50: [...dashboardCache.gy50], hcsr04: [...dashboardCache.hcsr04], auditoria: [...dashboardCache.auditoria] })
const cloneRealtimeState   = () => ({ dht22: realtimeState.dht22, gy50: realtimeState.gy50, hcsr04: realtimeState.hcsr04, motores: realtimeState.motores, updatedAt: realtimeState.updatedAt })
const broadcastToBrowsers = (payload) => {
  const message = JSON.stringify(payload)
  for (const ws of browserClients) {
    if (ws.readyState === 1 /* OPEN */) ws.send(message)
  }
}

const pushRealtimeUpdate   = () => broadcastToBrowsers({ type: 'sensor-realtime', data: cloneRealtimeState() })
const pushDashboardUpdate  = () => broadcastToBrowsers({ type: 'dashboard-update', data: cloneDashboardCache() })
const syncAndPushDashboard = async () => { await refreshDashboardCacheFromDb(); pushDashboardUpdate() }

const appendAuditLog = ({ action, table, desc, user = 'esp32', type = 'info' }) => {
  createAuditEntry({ usuarioId: null, accion: action, tablaAfectada: table, registroId: null, descripcion: desc })
    .catch(e => console.error('[AUDITORIA] Fallo al guardar log persistente:', e.message))

  const now = new Date()
  dashboardCache.auditoria = [
    { id: `rt-${now.getTime()}`, user, action, table, desc, time: now.toLocaleTimeString('es-BO', { hour12: false, timeZone: 'America/La_Paz' }), type },
    ...(dashboardCache.auditoria || []),
  ].slice(0, 80)
}

// ──────────────────────────────────────────────────────────
// CARGA DE DATOS PARA EL DASHBOARD
// ──────────────────────────────────────────────────────────

const fetchDashboardData = async () => {
  const [dht22Result, gy50Result, hcsr04FijoResult, hcsr04MovilResult, auditoriaResult] = await Promise.all([
    pool.query(`
      SELECT id, temperatura, humedad, dispositivo_id, fecha, hora, created_at
      FROM dht22_data ORDER BY created_at DESC, id DESC LIMIT 120
    `),
    pool.query(`
      SELECT id, gyro_x, gyro_y, gyro_z, raw_x, raw_y, raw_z, dispositivo_id, fecha, hora, created_at
      FROM gy50_data ORDER BY created_at DESC, id DESC LIMIT 120
    `),
    pool.query(`
      SELECT id, distancia_cm, dispositivo_id, fecha, hora, created_at
      FROM hcsr04_fijo_data ORDER BY created_at DESC, id DESC LIMIT 120
    `),
    pool.query(`
      SELECT id, distancia_cm, angulo_servo, dispositivo_id, fecha, hora, created_at
      FROM hcsr04_movil_data ORDER BY created_at DESC, id DESC LIMIT 120
    `),
    pool.query(`
      SELECT a.id, a.usuario_id, COALESCE(u.username, 'system') AS usuario,
             a.accion, a.tabla_afectada, a.registro_id, a.descripcion, a.fecha
      FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
      ORDER BY a.fecha DESC, a.id DESC LIMIT 80
    `),
  ])

  const dht22 = dht22Result.rows.reverse().map((row) => ({
    id: row.id, time: formatTimeLabel(row),
    temp: toNumber(row.temperatura), hum: toNumber(row.humedad),
    dispositivoId: row.dispositivo_id, fecha: row.fecha, hora: row.hora, created_at: row.created_at,
  }))

  const gy50 = gy50Result.rows.reverse().map((row) => ({
    id: row.id, time: formatTimeLabel(row),
    gyroX: toNumber(row.gyro_x), gyroY: toNumber(row.gyro_y), gyroZ: toNumber(row.gyro_z),
    dispositivoId: row.dispositivo_id, fecha: row.fecha, hora: row.hora, created_at: row.created_at,
  }))

  const hcsr04Fijo = hcsr04FijoResult.rows.map((row) => ({
    id: `f-${row.id}`, time: formatTimeLabel(row),
    dist: toNumber(row.distancia_cm),
    dispositivoId: row.dispositivo_id, fecha: row.fecha, hora: row.hora, created_at: row.created_at,
  }))

  const hcsr04Movil = hcsr04MovilResult.rows.map((row) => ({
    id: `m-${row.id}`, time: formatTimeLabel(row),
    distMovil: toNumber(row.distancia_cm),
    anguloServo: row.angulo_servo !== null && row.angulo_servo !== undefined ? Number(row.angulo_servo) : null,
    dispositivoId: row.dispositivo_id, fecha: row.fecha, hora: row.hora, created_at: row.created_at,
  }))

  const hcsr04 = [...hcsr04Fijo, ...hcsr04Movil].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const auditoria = auditoriaResult.rows.map((row) => ({
    id: row.id, user: row.usuario, action: row.accion,
    table: row.tabla_afectada, desc: row.descripcion,
    time: row.fecha ? new Date(row.fecha).toLocaleTimeString('es-BO', { hour12: false, timeZone: 'America/La_Paz' }) : '--:--:--',
    type: String(row.accion || '').toLowerCase().includes('error') ? 'warning'
        : String(row.accion || '').toLowerCase().includes('login') ? 'success' : 'info',
  }))

  return { dht22, gy50, hcsr04, auditoria }
}

const refreshDashboardCacheFromDb = async () => {
  const snap = await fetchDashboardData()
  dashboardCache.dht22     = snap.dht22
  dashboardCache.gy50      = snap.gy50
  dashboardCache.hcsr04    = snap.hcsr04
  dashboardCache.auditoria = snap.auditoria
}

// ──────────────────────────────────────────────────────────
// PROCESADOR DE STREAM IoT  (compartido entre HTTP y WebSocket)
// Retorna el array de tablas aceptadas. Lanza si falla de forma irrecuperable.
// ──────────────────────────────────────────────────────────

let lastDbSaveTime = 0

const processIotStream = async (payload = {}, { skipDb = false } = {}) => {
  const now           = new Date()
  const timeLabel     = now.toLocaleTimeString('es-BO', { hour12: false, timeZone: 'America/La_Paz' })
  const dispositivoId = parseDeviceId(payload)
  const accepted      = []
  const shouldSaveToDb = !skipDb && (now.getTime() - lastDbSaveTime >= 1000)
  if (shouldSaveToDb) lastDbSaveTime = now.getTime()

  // ── DHT22 ──
  const dhtRaw = payload.dht22
  if (dhtRaw && typeof dhtRaw === 'object') {
    const { temperatura, humedad } = normalizeDhtPayload(dhtRaw)
    if (Number.isFinite(temperatura) && Number.isFinite(humedad)) {
      accepted.push('dht22_data')
      realtimeState.dht22 = {
        id: `rt-${now.getTime()}-dht`, time: timeLabel,
        temp: temperatura, hum: humedad,
        dispositivoId, created_at: now.toISOString(),
      }
      if (shouldSaveToDb) {
        pool.query(
          `INSERT INTO dht22_data (temperatura, humedad, dispositivo_id) VALUES ($1, $2, $3)`,
          [temperatura, humedad, dispositivoId],
        ).catch(() => appendAuditLog({ action: 'IOT_WRITE_ERROR', table: 'dht22_data', desc: 'Falló persistencia DHT22', type: 'warning' }))
      }
    }
  }

  // ── GY-50 ──
  const gyroRaw = payload.gy50
  if (gyroRaw && typeof gyroRaw === 'object') {
    const { gyroX, gyroY, gyroZ, rawX, rawY, rawZ } = normalizeGyroPayload(gyroRaw)
    if (Number.isFinite(gyroX) && Number.isFinite(gyroY) && Number.isFinite(gyroZ)) {
      accepted.push('gy50_data')
      realtimeState.gy50 = {
        id: `rt-${now.getTime()}-gy`, time: timeLabel,
        gyroX, gyroY, gyroZ, dispositivoId, created_at: now.toISOString(),
      }
      if (shouldSaveToDb) {
        pool.query(
          `INSERT INTO gy50_data (gyro_x, gyro_y, gyro_z, raw_x, raw_y, raw_z, dispositivo_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [gyroX, gyroY, gyroZ, rawX, rawY, rawZ, dispositivoId],
        ).catch(() => appendAuditLog({ action: 'IOT_WRITE_ERROR', table: 'gy50_data', desc: 'Falló persistencia GY50', type: 'warning' }))
      }
    }
  }

  // ── HC-SR04 (sensor fijo + sensor móvil/servo) ──
  const ultraRaw = payload.hcsr04
  if (ultraRaw && typeof ultraRaw === 'object') {
    const { distanciaCm, distanciaMovilCm, anguloServo } = normalizeHcsr04Payload(ultraRaw)
    const hasFijo = Number.isFinite(distanciaCm)
    const hasMovil = Number.isFinite(distanciaMovilCm)

    if (hasFijo || hasMovil) {
      if (hasFijo) accepted.push('hcsr04_fijo_data')
      if (hasMovil) accepted.push('hcsr04_movil_data')
      realtimeState.hcsr04 = {
        id: `rt-${now.getTime()}-hc`, time: timeLabel,
        dist:        hasFijo ? distanciaCm : null,
        distMovil:   hasMovil ? distanciaMovilCm : null,
        anguloServo: anguloServo !== null ? anguloServo : null,
        dispositivoId, created_at: now.toISOString(),
      }
      if (shouldSaveToDb) {
        if (hasFijo) {
          pool.query(
            `INSERT INTO hcsr04_fijo_data (distancia_cm, dispositivo_id) VALUES ($1, $2)`,
            [distanciaCm, dispositivoId]
          ).catch(() => appendAuditLog({ action: 'IOT_WRITE_ERROR', table: 'hcsr04_fijo_data', desc: 'Falló persistencia HC-SR04 Fijo', type: 'warning' }))
        }
        if (hasMovil) {
          pool.query(
            `INSERT INTO hcsr04_movil_data (distancia_cm, angulo_servo, dispositivo_id) VALUES ($1, $2, $3)`,
            [distanciaMovilCm, anguloServo, dispositivoId]
          ).catch(() => appendAuditLog({ action: 'IOT_WRITE_ERROR', table: 'hcsr04_movil_data', desc: 'Falló persistencia HC-SR04 Móvil', type: 'warning' }))
        }
      }
    }
  }

  // ── Motores (Motor A derecho + Motor B izquierdo) ──
  const motoresRaw = payload.motores
  if (motoresRaw && typeof motoresRaw === 'object') {
    const parseMotor = (vel, dir) => {
      const v = Number.isFinite(Number(vel)) ? Math.max(0, Math.min(65535, Number(vel))) : 0
      const d = ['adelante', 'atras', 'stop'].includes(dir) ? dir : 'stop'
      return { velocidad: v, direccion: d }
    }
    realtimeState.motores = {
      motorDer: parseMotor(motoresRaw.motor_der ?? motoresRaw.motorDer?.velocidad, motoresRaw.motor_der_dir ?? motoresRaw.motorDer?.direccion),
      motorIzq: parseMotor(motoresRaw.motor_izq ?? motoresRaw.motorIzq?.velocidad, motoresRaw.motor_izq_dir ?? motoresRaw.motorIzq?.direccion),
    }
    if (shouldSaveToDb) {
      pool.query(`INSERT INTO motor_der_data (velocidad_pwm, direccion, dispositivo_id) VALUES ($1, $2, $3)`, [realtimeState.motores.motorDer.velocidad, realtimeState.motores.motorDer.direccion, dispositivoId]).catch(()=>{})
      pool.query(`INSERT INTO motor_izq_data (velocidad_pwm, direccion, dispositivo_id) VALUES ($1, $2, $3)`, [realtimeState.motores.motorIzq.velocidad, realtimeState.motores.motorIzq.direccion, dispositivoId]).catch(()=>{})
      if (Number.isFinite(ultraRaw?.anguloServo) || Number.isFinite(payload.hcsr04?.anguloServo)) {
        const ang = Number(ultraRaw?.anguloServo ?? payload.hcsr04?.anguloServo)
        const duty = Math.floor(26 + (ang / 180.0) * (128 - 26))
        pool.query(`INSERT INTO servo_data (angulo_grados, duty_ciclo, dispositivo_id) VALUES ($1, $2, $3)`, [ang, duty, dispositivoId]).catch(()=>{})
      }
    }
  }

  if (accepted.length > 0 || realtimeState.motores) {
    realtimeState.updatedAt = now.toISOString()
    pushRealtimeUpdate()
  }

  return accepted
}

// ──────────────────────────────────────────────────────────
// RUTAS HTTP
// ──────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  const networkInterfaces = os.networkInterfaces()
  let localIp = 'localhost'
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName]
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address
        break
      }
    }
  }
  return res.json({ ok: true, ip: localIp, port: PORT })
})
app.get('/api/realtime-state', (_req, res) => res.json(cloneRealtimeState()))
app.get('/api/iot/ping', (_req, res) => res.json({ ok: true, service: 'iot-ingest' }))

app.post('/api/iot/realtime', async (_req, res) => {
  try {
    await syncAndPushDashboard()
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo sincronizar el dashboard' })
  }
})

// Endpoint de stream batch (HTTP — compatibilidad con proyecto.py anterior)
app.post('/api/iot/stream', async (req, res) => {
  try {
    const accepted = await processIotStream(req.body || {})
    if (accepted.length === 0) {
      return res.status(400).json({ error: 'Payload sin datos válidos de sensores' })
    }
    return res.status(202).json({ ok: true, accepted })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error procesando stream IoT' })
  }
})

// Endpoints individuales por tabla
app.post('/api/iot/:table', async (req, res) => {
  const table         = normalizeIotTable(req.params.table)
  const payload       = req.body || {}
  const dispositivoId = parseDeviceId(payload)
  const now           = new Date()
  const timeLabel     = now.toLocaleTimeString('es-BO', { hour12: false, timeZone: 'America/La_Paz' })

  if (!Number.isInteger(dispositivoId) || dispositivoId <= 0) {
    return res.status(400).json({ error: 'dispositivo_id inválido' })
  }

  try {
    if (table === 'dht22_data') {
      const temperatura = toNumber(payload.temperatura)
      const humedad     = toNumber(payload.humedad)
      if (!Number.isFinite(temperatura) || !Number.isFinite(humedad)) {
        return res.status(400).json({ error: 'temperatura/humedad inválidas' })
      }
      realtimeState.dht22 = { id: `rt-${now.getTime()}`, time: timeLabel, temp: temperatura, hum: humedad, dispositivoId, created_at: now.toISOString() }
      realtimeState.updatedAt = now.toISOString()
      pushRealtimeUpdate()
      pool.query(`INSERT INTO dht22_data (temperatura, humedad, dispositivo_id) VALUES ($1, $2, $3)`, [temperatura, humedad, dispositivoId])
        .catch(() => appendAuditLog({ action: 'IOT_WRITE_ERROR', table: 'dht22_data', desc: 'Falló persistencia DHT22', type: 'warning' }))
      return res.status(202).json({ ok: true, table })
    }

    if (table === 'gy50_data') {
      const gyroX = toNumber(payload.gyro_x)
      const gyroY = toNumber(payload.gyro_y)
      const gyroZ = toNumber(payload.gyro_z)
      const rawX  = Number.isFinite(Number(payload.raw_x)) ? Number.parseInt(payload.raw_x, 10) : null
      const rawY  = Number.isFinite(Number(payload.raw_y)) ? Number.parseInt(payload.raw_y, 10) : null
      const rawZ  = Number.isFinite(Number(payload.raw_z)) ? Number.parseInt(payload.raw_z, 10) : null
      if (!Number.isFinite(gyroX) || !Number.isFinite(gyroY) || !Number.isFinite(gyroZ)) {
        return res.status(400).json({ error: 'gyro_x/gyro_y/gyro_z inválidos' })
      }
      realtimeState.gy50 = { id: `rt-${now.getTime()}`, time: timeLabel, gyroX, gyroY, gyroZ, dispositivoId, created_at: now.toISOString() }
      realtimeState.updatedAt = now.toISOString()
      pushRealtimeUpdate()
      pool.query(`INSERT INTO gy50_data (gyro_x, gyro_y, gyro_z, raw_x, raw_y, raw_z, dispositivo_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [gyroX, gyroY, gyroZ, rawX, rawY, rawZ, dispositivoId])
        .catch(() => appendAuditLog({ action: 'IOT_WRITE_ERROR', table: 'gy50_data', desc: 'Falló persistencia GY50', type: 'warning' }))
      return res.status(202).json({ ok: true, table })
    }

    if (table === 'hcsr04_fijo_data') {
      const distanciaCm = toNumber(payload.distancia_cm ?? payload.fijo)
      if (!Number.isFinite(distanciaCm)) return res.status(400).json({ error: 'Distancia inválida' })
      realtimeState.hcsr04 = { ...realtimeState.hcsr04, id: `rt-${now.getTime()}`, time: timeLabel, dist: distanciaCm, dispositivoId, created_at: now.toISOString() }
      realtimeState.updatedAt = now.toISOString()
      pushRealtimeUpdate()
      pool.query(`INSERT INTO hcsr04_fijo_data (distancia_cm, dispositivo_id) VALUES ($1, $2)`, [distanciaCm, dispositivoId])
      return res.status(202).json({ ok: true, table })
    }

    if (table === 'hcsr04_movil_data') {
      const distanciaMovilCm = toNumber(payload.distancia_cm ?? payload.movil)
      const anguloServo = Number.isFinite(Number(payload.angulo_servo)) ? Number(payload.angulo_servo) : null
      if (!Number.isFinite(distanciaMovilCm)) return res.status(400).json({ error: 'Distancia inválida' })
      realtimeState.hcsr04 = { ...realtimeState.hcsr04, id: `rt-${now.getTime()}`, time: timeLabel, distMovil: distanciaMovilCm, anguloServo, dispositivoId, created_at: now.toISOString() }
      realtimeState.updatedAt = now.toISOString()
      pushRealtimeUpdate()
      pool.query(`INSERT INTO hcsr04_movil_data (distancia_cm, angulo_servo, dispositivo_id) VALUES ($1, $2, $3)`, [distanciaMovilCm, anguloServo, dispositivoId])
      return res.status(202).json({ ok: true, table })
    }

    return res.status(404).json({ error: 'Tabla IoT no soportada' })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error procesando ingesta IoT' })
  }
})

// ── Autenticación ──────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  console.log(`[Server] Petición de login recibida. Usuario: "${username}" de IP: ${req.ip}`);
  if (!username || !password) {
    console.log('[Server] Login fallido: usuario o contraseña vacíos.');
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' })
  }

  try {
    const result = await pool.query(
      `SELECT id, username, password_hash, rol, activo, created_at FROM usuarios WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username],
    )
    if (result.rowCount === 0) {
      console.log(`[Server] Login fallido: Usuario "${username}" no encontrado.`);
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }
    const user = result.rows[0]
    if (!user.activo) {
      console.log(`[Server] Login fallido: Usuario "${username}" está inactivo.`);
      return res.status(403).json({ error: 'Usuario inactivo' })
    }
    if (!verifyPassword(password, user.password_hash)) {
      console.log(`[Server] Login fallido: Contraseña incorrecta para "${username}".`);
      await createAuditEntry({ usuarioId: user.id, accion: 'LOGIN_ERROR', tablaAfectada: 'usuarios', registroId: user.id, descripcion: `Intento fallido para ${user.username}` })
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }
    console.log(`[Server] Login exitoso para el usuario: "${username}"`);
    await createAuditEntry({ usuarioId: user.id, accion: 'LOGIN', tablaAfectada: 'usuarios', registroId: user.id, descripcion: `Login exitoso: ${user.username}` })
    const role = displayRole(user.rol)
    const token = jwt.sign({ id: user.id, username: user.username, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    return res.json({ id: user.id, username: user.username, role, email: `${user.username}@drako.local`, activo: user.activo, createdAt: user.created_at, token })
  } catch (error) {
    console.error('[Server] Error en proceso de login:', error);
    return res.status(500).json({ error: error.message || 'No se pudo iniciar sesión' })
  }
})

// ── Gestión de usuarios ────────────────────────────────────
app.get('/api/users', adminMiddleware, async (_req, res) => {
  try {
    const result = await pool.query(`SELECT id, username, rol, activo, created_at FROM usuarios ORDER BY id ASC`)
    return res.json({ users: result.rows.map((row) => ({ id: row.id, username: row.username, rol: displayRole(row.rol), password_hash: '******', activo: row.activo, created_at: row.created_at })) })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo obtener usuarios' })
  }
})

app.post('/api/users', adminMiddleware, async (req, res) => {
  const username = String(req.body?.username || '').trim().replace(/\s/g, '')
  const password = String(req.body?.password || '')
  const rol      = normalizeRoleForDb(req.body?.rol)
  if (username.length < 3) return res.status(400).json({ error: 'Username mínimo 3 caracteres' })
  if (password.length < 8) return res.status(400).json({ error: 'Contraseña mínimo 8 caracteres' })
  try {
    const r = await pool.query(
      `INSERT INTO usuarios (username, password_hash, rol, activo) VALUES ($1,$2,$3,true) RETURNING id, username, rol, activo, created_at`,
      [username, hashPassword(password), rol],
    )
    const created = r.rows[0]
    await createAuditEntry({ accion: 'CREATE_USER', tablaAfectada: 'usuarios', registroId: created.id, descripcion: `Usuario creado: ${created.username}` })
    return res.status(201).json({ user: { id: created.id, username: created.username, rol: displayRole(created.rol), password_hash: '******', activo: created.activo, created_at: created.created_at } })
  } catch (error) {
    if (String(error.message).includes('usuarios_username_key')) return res.status(409).json({ error: 'Username ya existe' })
    return res.status(500).json({ error: error.message || 'No se pudo crear el usuario' })
  }
})

app.put('/api/users/:id', adminMiddleware, async (req, res) => {
  const userId   = Number.parseInt(req.params.id, 10)
  const username = String(req.body?.username || '').trim().replace(/\s/g, '')
  const rol      = normalizeRoleForDb(req.body?.rol)
  const activo   = Boolean(req.body?.activo)
  const password = String(req.body?.password || '')
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'ID inválido' })
  if (username.length < 3) return res.status(400).json({ error: 'Username mínimo 3 caracteres' })
  try {
    const fields = ['username = $1', 'rol = $2', 'activo = $3']
    const values = [username, rol, activo]
    if (password.length > 0) { fields.push(`password_hash = $${values.length + 1}`); values.push(hashPassword(password)) }
    values.push(userId)
    const result = await pool.query(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING id, username, rol, activo, created_at`, values)
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
    const u = result.rows[0]
    await createAuditEntry({ accion: 'UPDATE_USER', tablaAfectada: 'usuarios', registroId: u.id, descripcion: `Usuario actualizado: ${u.username}` })
    return res.json({ user: { id: u.id, username: u.username, rol: displayRole(u.rol), password_hash: '******', activo: u.activo, created_at: u.created_at } })
  } catch (error) {
    if (String(error.message).includes('usuarios_username_key')) return res.status(409).json({ error: 'Username ya existe' })
    return res.status(500).json({ error: error.message || 'No se pudo actualizar' })
  }
})

app.patch('/api/users/:id/status', adminMiddleware, async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10)
  const activo = Boolean(req.body?.activo)
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'ID inválido' })
  try {
    const result = await pool.query(`UPDATE usuarios SET activo=$1 WHERE id=$2 RETURNING id, username, rol, activo, created_at`, [activo, userId])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
    const u = result.rows[0]
    await createAuditEntry({ accion: activo ? 'ENABLE_USER' : 'DISABLE_USER', tablaAfectada: 'usuarios', registroId: u.id, descripcion: `Estado ${u.username}: ${activo ? 'ACTIVO' : 'INACTIVO'}` })
    return res.json({ user: { id: u.id, username: u.username, rol: displayRole(u.rol), password_hash: '******', activo: u.activo, created_at: u.created_at } })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'No se pudo actualizar estado' })
  }
})

app.put('/api/profile/:id', authMiddleware, async (req, res) => {
  const userId   = Number.parseInt(req.params.id, 10)
  const username = String(req.body?.username || '').trim().replace(/\s/g, '')
  const password = String(req.body?.password || '')
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ error: 'ID inválido' })
  if (username.length < 3) return res.status(400).json({ error: 'Username mínimo 3 caracteres' })
  try {
    const fields = ['username = $1']
    const values = [username]
    if (password.length > 0) { fields.push(`password_hash = $${values.length + 1}`); values.push(hashPassword(password)) }
    values.push(userId)
    const result = await pool.query(`UPDATE usuarios SET ${fields.join(', ')} WHERE id=$${values.length} RETURNING id, username, rol, activo, created_at`, values)
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
    const u = result.rows[0]
    await createAuditEntry({ usuarioId: u.id, accion: 'UPDATE_PROFILE', tablaAfectada: 'usuarios', registroId: u.id, descripcion: `Perfil actualizado: ${u.username}` })
    return res.json({ user: { id: u.id, username: u.username, role: displayRole(u.rol), email: `${u.username}@drako.local`, activo: u.activo, createdAt: u.created_at } })
  } catch (error) {
    if (String(error.message).includes('usuarios_username_key')) return res.status(409).json({ error: 'Username ya existe' })
    return res.status(500).json({ error: error.message || 'No se pudo actualizar perfil' })
  }
})

// ── Estado DB ──────────────────────────────────────────────
app.get('/api/db-status', async (_req, res) => {
  try {
    const result = await pool.query(`SELECT current_database() AS database, NOW() AS server_time, (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS public_tables_count`)
    const row = result.rows[0]
    res.json({ database: row.database, serverTime: row.server_time, publicTablesCount: Number(row.public_tables_count) })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error consultando la base de datos' })
  }
})

app.get('/api/dashboard-data', async (_req, res) => {
  try {
    const data = await fetchDashboardData()
    dashboardCache.dht22 = data.dht22; dashboardCache.gy50 = data.gy50
    dashboardCache.hcsr04 = data.hcsr04; dashboardCache.auditoria = data.auditoria
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message || 'No se pudieron obtener datos del dashboard' })
  }
})

// ──────────────────────────────────────────────────────────
// SERVIDOR HTTP + DOS SERVIDORES WEBSOCKET
//
// /ws            → ESP32  (envía datos de sensores)
// /ws-dashboard  → Navegador (recibe datos en tiempo real)
//
// Flujo completo sin SSE:
//   ESP32 ─── ws://IP:4000/ws ──► Server ─── ws://host/ws-dashboard ──► Browser
// ──────────────────────────────────────────────────────────

const httpServer = http.createServer(app)

const wssEsp32 = new WebSocketServer({ noServer: true, perMessageDeflate: false })
const wssBrowser = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;

  if (pathname === '/ws') {
    wssEsp32.handleUpgrade(request, socket, head, (ws) => {
      wssEsp32.emit('connection', ws, request);
    });
  } else if (pathname === '/ws-dashboard') {
    wssBrowser.handleUpgrade(request, socket, head, (ws) => {
      wssBrowser.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wssEsp32.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress || 'desconocida'
  console.log(`[WS-ESP32] conectado desde ${remoteIp}`)

  ws.on('message', async (raw) => {
    try {
      const payload = JSON.parse(raw.toString())
      await processIotStream(payload, { skipDb: false })
    } catch {
      // Mensaje malformado — ignorar silenciosamente.
    }
  })

  ws.on('close', () => console.log(`[WS-ESP32] desconectado (${remoteIp})`))
  ws.on('error', (err) => console.error('[WS-ESP32] Error:', err.message))
})

// ── WebSocket para navegadores ─────────────────────────────
wssBrowser.on('connection', (ws) => {
  ws.isAlive = true
  ws.on('pong', () => { ws.isAlive = true })

  browserClients.add(ws)
  console.log(`[WS-BROWSER] cliente conectado (total: ${browserClients.size})`)

  // Envía estado actual al nuevo cliente
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'connected', realtime: cloneRealtimeState() }))
  }

  ws.on('close', () => {
    browserClients.delete(ws)
    console.log(`[WS-BROWSER] cliente desconectado (total: ${browserClients.size})`)
  })
  ws.on('error', () => browserClients.delete(ws))
})

// Ping cada 30s para detectar conexiones muertas del navegador
const pingInterval = setInterval(() => {
  for (const ws of browserClients) {
    if (!ws.isAlive) { browserClients.delete(ws); ws.terminate(); continue }
    ws.isAlive = false
    ws.ping()
  }
}, 30000)
pingInterval.unref()

// Sync del histórico cada 2s para los dashboards conectados
const dashboardHeartbeat = setInterval(async () => {
  if (browserClients.size === 0) return
  try { await syncAndPushDashboard() } catch { /* reintenta en el próximo tick */ }
}, 2000)
dashboardHeartbeat.unref()

httpServer.listen(PORT, '0.0.0.0', () => {
  refreshDashboardCacheFromDb().catch(() => { /* se repuebla con el heartbeat */ })
  
  const networkInterfaces = os.networkInterfaces()
  let localIp = 'localhost'
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName]
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address
        break
      }
    }
  }

  console.log(`Backend listo en      http://localhost:${PORT}/api/health`)
  console.log(`WS ESP32 en           ws://localhost:${PORT}/ws`)
  console.log(`WS Dashboard en       ws://localhost:${PORT}/ws-dashboard`)
  console.log(`Acceso en red LAN:    http://${localIp}:${PORT}`)
})
