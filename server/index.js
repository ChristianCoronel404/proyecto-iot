import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const app = express()
const PORT = process.env.PORT || 4000

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

const sseClients = new Set()

const factorial = (number) => {
  let result = 1
  for (let i = 2; i <= number; i += 1) {
    result *= i
  }
  return result
}

const fibonacciSeriesValues = (n) => {
  const values = []

  for (let i = 1; i <= n; i += 1) {
    if (i <= 2) {
      values.push(1)
      continue
    }

    values.push(values[i - 2] + values[i - 3])
  }

  return values
}

const taylorSinSeries = (n, x = Math.PI / 4) => {
  const values = []
  let sum = 0

  for (let k = 0; k < n; k += 1) {
    const sign = k % 2 === 0 ? 1 : -1
    sum += sign * (x ** (2 * k + 1)) / factorial(2 * k + 1)
    values.push(sum)
  }

  return values
}

const taylorLnSeries = (n, x = 2) => {
  const values = []
  let sum = 0

  for (let k = 1; k <= n; k += 1) {
    const sign = k % 2 === 1 ? 1 : -1
    sum += sign * ((x - 1) ** k) / k
    values.push(sum)
  }

  return values
}

const createDateAndTime = (baseTimestampMs, offsetMs) => {
  const date = new Date(baseTimestampMs + offsetMs)
  const iso = date.toISOString()
  return {
    fecha: iso.slice(0, 10),
    hora: iso.slice(11, 23),
  }
}

const createSeriesRows = ({ configs, usuario = 'anon' }) => {
  const fibonacciValues = configs.fibonacci ? fibonacciSeriesValues(configs.fibonacci.n) : []
  const sinValues = configs.senx ? taylorSinSeries(configs.senx.n, Math.PI / 4) : []
  const lnValues = configs.lnx ? taylorLnSeries(configs.lnx.n, 2) : []
  const sinExpected = Math.sin(Math.PI / 4)
  const lnExpected = Math.log(2)
  const baseTimestampMs = Date.now()
  let offsetCursor = 0

  const fibonacci = {
    n: [],
    r: [],
    usuario: [],
    valor: [],
    error: [],
    fecha: [],
    hora: [],
  }

  const senx = {
    n: [],
    r: [],
    usuario: [],
    x: [],
    aproximacion: [],
    error: [],
    fecha: [],
    hora: [],
  }

  const lnx = {
    n: [],
    r: [],
    usuario: [],
    x: [],
    aproximacion: [],
    error: [],
    fecha: [],
    hora: [],
  }

  if (configs.fibonacci) {
    for (let rep = 1; rep <= configs.fibonacci.r; rep += 1) {
      for (let term = 1; term <= configs.fibonacci.n; term += 1) {
        const offset = offsetCursor
        offsetCursor += 1
        const { fecha, hora } = createDateAndTime(baseTimestampMs, offset)
        const valueIndex = term - 1

        fibonacci.n.push(term)
        fibonacci.r.push(rep)
        fibonacci.usuario.push(usuario)
        fibonacci.valor.push(fibonacciValues[valueIndex])
        fibonacci.error.push(0)
        fibonacci.fecha.push(fecha)
        fibonacci.hora.push(hora)
      }
    }
  }

  if (configs.senx) {
    for (let rep = 1; rep <= configs.senx.r; rep += 1) {
      for (let term = 1; term <= configs.senx.n; term += 1) {
        const offset = offsetCursor
        offsetCursor += 1
        const { fecha, hora } = createDateAndTime(baseTimestampMs, offset)
        const valueIndex = term - 1

        senx.n.push(term)
        senx.r.push(rep)
        senx.usuario.push(usuario)
        senx.x.push(Math.PI / 4)
        senx.aproximacion.push(sinValues[valueIndex])
        senx.error.push(Math.abs(sinValues[valueIndex] - sinExpected))
        senx.fecha.push(fecha)
        senx.hora.push(hora)
      }
    }
  }

  if (configs.lnx) {
    for (let rep = 1; rep <= configs.lnx.r; rep += 1) {
      for (let term = 1; term <= configs.lnx.n; term += 1) {
        const offset = offsetCursor
        offsetCursor += 1
        const { fecha, hora } = createDateAndTime(baseTimestampMs, offset)
        const valueIndex = term - 1

        lnx.n.push(term)
        lnx.r.push(rep)
        lnx.usuario.push(usuario)
        lnx.x.push(2)
        lnx.aproximacion.push(lnValues[valueIndex])
        lnx.error.push(Math.abs(lnValues[valueIndex] - lnExpected))
        lnx.fecha.push(fecha)
        lnx.hora.push(hora)
      }
    }
  }

  return {
    totalRows: {
      fibonacci: configs.fibonacci ? configs.fibonacci.n * configs.fibonacci.r : 0,
      senx: configs.senx ? configs.senx.n * configs.senx.r : 0,
      lnx: configs.lnx ? configs.lnx.n * configs.lnx.r : 0,
    },
    maxRepetitions: Math.max(configs.fibonacci?.r || 0, configs.senx?.r || 0, configs.lnx?.r || 0),
    fibonacci,
    senx,
    lnx,
  }
}

const fetchDashboardData = async () => {
  const results = {}

  const fibonacciQuery = `
    SELECT id, n, r, usuario, valor, error, fecha, hora
    FROM fibonacci_series
    ORDER BY fecha DESC, hora DESC, id DESC
    LIMIT 500
  `
  const fibonacciResult = await pool.query(fibonacciQuery)
  results.fibonacci = fibonacciResult.rows.reverse()

  const senxQuery = `
    SELECT id, n, r, usuario, x, aproximacion, error, fecha, hora
    FROM senx_series
    ORDER BY fecha DESC, hora DESC, id DESC
    LIMIT 500
  `
  const senxResult = await pool.query(senxQuery)
  results.senx = senxResult.rows.reverse()

  const lnxQuery = `
    SELECT id, n, r, usuario, x, aproximacion, error, fecha, hora
    FROM lnx_series
    ORDER BY fecha DESC, hora DESC, id DESC
    LIMIT 500
  `
  const lnxResult = await pool.query(lnxQuery)
  results.lnx = lnxResult.rows.reverse()

  return results
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

  res.write('data: {"type":"connected"}\n\n')
  sseClients.add(res)

  _req.on('close', () => {
    sseClients.delete(res)
  })
})

app.get('/api/dashboard-data', async (_req, res) => {
  try {
    const dashboardData = await fetchDashboardData()
    res.json(dashboardData)
  } catch (error) {
    res.status(500).json({
      error: error.message || 'No se pudieron obtener los datos del dashboard',
    })
  }
})

app.delete('/api/dashboard-data', async (_req, res) => {
  try {
    await pool.query(`
      TRUNCATE TABLE
        fibonacci_series,
        senx_series,
        lnx_series
    `)

    const dashboardData = await fetchDashboardData()
    sendSseMessage({
      type: 'dashboard-update',
      insertedCount: 0,
      currentRepetition: 0,
      totalRepetitions: 0,
      data: dashboardData,
    })

    return res.json({
      ok: true,
      message: 'Registros eliminados correctamente',
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'No se pudieron eliminar los registros',
    })
  }
})

app.post('/api/generate', async (req, res) => {
  const rawUsuario = req.body?.usuario
  const usuario = typeof rawUsuario === 'string' && rawUsuario.trim().length > 0
    ? rawUsuario.trim().slice(0, 100)
    : 'anon'

  const seriesPayload = req.body?.series && typeof req.body.series === 'object'
    ? req.body.series
    : {}

  const fallbackN = req.body?.n
  const fallbackR = req.body?.r

  const getSeriesConfig = (seriesKey, label) => {
    const rawSeries = seriesPayload[seriesKey] || {}
    const parsedN = Number.parseInt(rawSeries.n ?? fallbackN, 10)
    const parsedR = Number.parseInt(rawSeries.r ?? fallbackR, 10)

    if (!Number.isInteger(parsedN) || parsedN <= 0 || parsedN > 100) {
      throw new Error(`${label}: n debe ser un entero entre 1 y 100`)
    }

    if (!Number.isInteger(parsedR) || parsedR <= 0 || parsedR > 200) {
      throw new Error(`${label}: r debe ser un entero entre 1 y 200`)
    }

    return {
      n: parsedN,
      r: parsedR,
    }
  }

  const availableSeries = ['fibonacci', 'senx', 'lnx']
  const requestedSeries = availableSeries.filter((seriesKey) => Object.prototype.hasOwnProperty.call(seriesPayload, seriesKey))
  const useLegacyPayload = requestedSeries.length === 0 && (fallbackN !== undefined || fallbackR !== undefined)

  if (requestedSeries.length === 0 && !useLegacyPayload) {
    return res.status(400).json({
      error: 'Debes enviar al menos una serie para generar: fibonacci, senx o lnx',
    })
  }

  const selectedSeries = useLegacyPayload ? availableSeries : requestedSeries
  const configs = {}

  try {
    for (const seriesKey of selectedSeries) {
      const label = seriesKey === 'fibonacci' ? 'Fibonacci' : seriesKey === 'senx' ? 'Sen(x)' : 'Ln(x)'
      configs[seriesKey] = getSeriesConfig(seriesKey, label)
    }
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  try {
    const rows = createSeriesRows({ configs, usuario })
    const insertedRows = {
      fibonacci: 0,
      senx: 0,
      lnx: 0,
    }

    if (configs.fibonacci) {
      const fibonacciInsertResult = await pool.query(
        `
        INSERT INTO fibonacci_series (n, r, usuario, valor, error, fecha, hora)
        SELECT *
        FROM UNNEST(
          $1::int[],
          $2::int[],
          $3::varchar[],
          $4::bigint[],
          $5::numeric[],
          $6::date[],
          $7::time[]
        )
      `,
        [
          rows.fibonacci.n,
          rows.fibonacci.r,
          rows.fibonacci.usuario,
          rows.fibonacci.valor,
          rows.fibonacci.error,
          rows.fibonacci.fecha,
          rows.fibonacci.hora,
        ],
      )
      insertedRows.fibonacci = fibonacciInsertResult.rowCount || 0
    }

    if (configs.senx) {
      const senxInsertResult = await pool.query(
        `
        INSERT INTO senx_series (n, r, usuario, x, aproximacion, error, fecha, hora)
        SELECT *
        FROM UNNEST(
          $1::int[],
          $2::int[],
          $3::varchar[],
          $4::numeric[],
          $5::numeric[],
          $6::numeric[],
          $7::date[],
          $8::time[]
        )
      `,
        [
          rows.senx.n,
          rows.senx.r,
          rows.senx.usuario,
          rows.senx.x,
          rows.senx.aproximacion,
          rows.senx.error,
          rows.senx.fecha,
          rows.senx.hora,
        ],
      )
      insertedRows.senx = senxInsertResult.rowCount || 0
    }

    if (configs.lnx) {
      const lnxInsertResult = await pool.query(
        `
        INSERT INTO lnx_series (n, r, usuario, x, aproximacion, error, fecha, hora)
        SELECT *
        FROM UNNEST(
          $1::int[],
          $2::int[],
          $3::varchar[],
          $4::numeric[],
          $5::numeric[],
          $6::numeric[],
          $7::date[],
          $8::time[]
        )
      `,
        [
          rows.lnx.n,
          rows.lnx.r,
          rows.lnx.usuario,
          rows.lnx.x,
          rows.lnx.aproximacion,
          rows.lnx.error,
          rows.lnx.fecha,
          rows.lnx.hora,
        ],
      )
      insertedRows.lnx = lnxInsertResult.rowCount || 0
    }

    const totalInserted = insertedRows.fibonacci + insertedRows.senx + insertedRows.lnx
    const dashboardData = await fetchDashboardData()
    const updateMessage = `Actualizado: ${selectedSeries.join(', ')}`

    sendSseMessage({
      type: 'dashboard-update',
      insertedCount: totalInserted,
      currentRepetition: rows.maxRepetitions,
      totalRepetitions: rows.maxRepetitions,
      message: updateMessage,
      data: dashboardData,
    })

    return res.json({
      ok: true,
      insertedRows,
      totalInserted,
      expectedRowsPerSeries: rows.totalRows,
      selectedSeries,
      message: `Insertadas: Fibonacci ${insertedRows.fibonacci}, Sen(x) ${insertedRows.senx}, Ln(x) ${insertedRows.lnx}. Total ${totalInserted}.`,
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'No se pudo generar registros',
    })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listo en http://localhost:${PORT}`)
})
