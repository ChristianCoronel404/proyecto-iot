import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

function SeriesChart({ title, data, color, valueKey }) {
  const chartData = data.map((item, index) => ({
    ...item,
    orden: index + 1,
  }))

  const chartValues = chartData
    .map((item) => Number(item[valueKey]))
    .filter((value) => Number.isFinite(value))

  const minValue = chartValues.length > 0 ? Math.min(...chartValues) : 0
  const maxValue = chartValues.length > 0 ? Math.max(...chartValues) : 1
  const range = maxValue - minValue
  const padding = range === 0 ? Math.max(Math.abs(maxValue) * 0.1, 1) : range * 0.08
  const yDomain = [minValue - padding, maxValue + padding]
  const repetitionBoundaries = []

  for (let i = 0; i < chartData.length; i += 1) {
    const currentRow = chartData[i]
    const nextRow = chartData[i + 1]
    const endOfRepetition = !nextRow || Number(nextRow.r) !== Number(currentRow.r)

    if (endOfRepetition) {
      repetitionBoundaries.push({
        orden: currentRow.orden,
        repetition: currentRow.r,
      })
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null
    const row = payload[0].payload
    const val = payload[0].value
    return (
      <div style={{
        background: '#1f2937',
        border: `2px solid ${color}`,
        borderRadius: '8px',
        padding: '8px 12px',
        color: '#fff',
        fontSize: '0.82rem',
        lineHeight: '1.6',
      }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Punto {label}</p>
        {row.usuario && <p style={{ margin: 0, color: '#a5b4fc' }}>Usuario: {row.usuario}</p>}
        <p style={{ margin: 0 }}>
          {title}: {typeof val === 'number' ? val.toFixed(6) : val}
        </p>
        {row.error !== undefined && (
          <p style={{ margin: 0, color: '#fca5a5' }}>
            Error: {Number(row.error).toExponential(4)}
          </p>
        )}
        {row.r !== undefined && <p style={{ margin: 0, color: '#86efac' }}>Repetición: {row.r}</p>}
      </div>
    )
  }

  return (
    <section className="series-section">
      <h2>{title}</h2>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 24, right: 28, left: 16, bottom: 32 }}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="orden"
              stroke="#9ca3af"
              style={{ fontSize: '0.85rem' }}
              tick={{ fill: '#6b7280' }}
              label={{ value: 'Orden de generación', position: 'bottom', offset: 10 }}
              minTickGap={16}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '0.85rem' }}
              tick={{ fill: '#6b7280' }}
              width={56}
              domain={yDomain}
            />

            <Tooltip
              content={<CustomTooltip />}
            />

            <Legend wrapperStyle={{ paddingTop: '1rem' }} />

            {repetitionBoundaries.map((boundary) => (
              <ReferenceLine
                key={`boundary-${title}-${boundary.orden}`}
                x={boundary.orden}
                stroke={color}
                strokeOpacity={0.45}
                strokeDasharray="6 6"
                label={
                  repetitionBoundaries.length <= 24
                    ? {
                      value: `R${boundary.repetition}`,
                      position: 'insideTopRight',
                      fill: color,
                      fontSize: 11,
                    }
                    : undefined
                }
              />
            ))}

            <Line
              type="linear"
              dataKey={valueKey}
              stroke={color}
              fill={`url(#gradient-${color})`}
              name={title}
              isAnimationActive
              animationDuration={800}
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="series-info">Últimos 500 registros</p>
    </section>
  )
}

function App() {
  const [usuario, setUsuario] = useState('')
  const [formValues, setFormValues] = useState({
    fibonacci: { n: 10, r: 3 },
    senx: { n: 10, r: 3 },
    lnx: { n: 10, r: 3 },
  })
  const [dashboardData, setDashboardData] = useState({
    fibonacci: [],
    senx: [],
    lnx: [],
  })
  const [connectionState, setConnectionState] = useState('connecting')
  const [loading, setLoading] = useState(true)
  const [submittingSeries, setSubmittingSeries] = useState({
    fibonacci: false,
    senx: false,
    lnx: false,
  })
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const fetchDashboardData = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/dashboard-data')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron cargar los datos')
      }

      setDashboardData(data)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    const eventSource = new EventSource('/api/events')

    eventSource.onopen = () => {
      setConnectionState('connected')
    }

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'dashboard-update' && payload.data) {
          setDashboardData(payload.data)
          setMessage(payload.message || `Actualizado: repetición ${payload.currentRepetition}/${payload.totalRepetitions}`)
        }
      } catch {
        setConnectionState('error')
      }
    }

    eventSource.onerror = () => {
      setConnectionState('error')
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const handleChange = (seriesKey, field, value) => {
    setFormValues((previous) => ({
      ...previous,
      [seriesKey]: {
        ...previous[seriesKey],
        [field]: value,
      },
    }))
  }

  const handleGenerateSeries = async (seriesKey) => {
    if (!usuario.trim()) {
      setErrorMessage('Debes ingresar un identificador de usuario antes de generar')
      return
    }
    setSubmittingSeries((previous) => ({
      ...previous,
      [seriesKey]: true,
    }))
    setMessage('')
    setErrorMessage('')

    try {
      const currentSeries = formValues[seriesKey]
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usuario: usuario.trim(),
          series: {
            [seriesKey]: {
              n: Number(currentSeries.n),
              r: Number(currentSeries.r),
            },
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar el registro')
      }

      setMessage(data.message)
      await fetchDashboardData()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSubmittingSeries((previous) => ({
        ...previous,
        [seriesKey]: false,
      }))
    }
  }

  const handleClearData = async () => {
    setClearing(true)
    setMessage('')
    setErrorMessage('')

    try {
      const response = await fetch('/api/dashboard-data', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No se pudieron eliminar los registros')
      }

      setMessage(data.message)
      await fetchDashboardData()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setClearing(false)
    }
  }

  const connectionLabel =
    connectionState === 'connected'
      ? '● En línea'
      : '● Desconectado'

  return (
    <main className="app-container">
      <header className="app-header">
        <h1>Dashboard de Series Matemáticas</h1>
        <p className="subtitle">Fibonacci, Sen(x), Ln(x)</p>
      </header>

      <section className="control-panel">
        <div className="form-compact">
          <div className="usuario-row">
            <label className="usuario-label">
              <span>Identificador de usuario</span>
              <input
                type="text"
                placeholder="Ej: alumno01..."
                maxLength={100}
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="usuario-input"
              />
            </label>
          </div>
          <div className="series-input-grid">
            <fieldset className="series-input-group">
              <legend>Fibonacci</legend>
              <label>
                <span>Generación (n)</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formValues.fibonacci.n}
                  onChange={(event) => handleChange('fibonacci', 'n', event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Repetición (r)</span>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={formValues.fibonacci.r}
                  onChange={(event) => handleChange('fibonacci', 'r', event.target.value)}
                  required
                />
              </label>

              <button
                type="button"
                disabled={submittingSeries.fibonacci || clearing}
                className="btn-primary btn-series"
                onClick={() => handleGenerateSeries('fibonacci')}
              >
                {submittingSeries.fibonacci ? 'Generando...' : 'Generar Fibonacci'}
              </button>
            </fieldset>

            <fieldset className="series-input-group">
              <legend>Sen(x) - Taylor</legend>
              <label>
                <span>Generación (n)</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formValues.senx.n}
                  onChange={(event) => handleChange('senx', 'n', event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Repetición (r)</span>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={formValues.senx.r}
                  onChange={(event) => handleChange('senx', 'r', event.target.value)}
                  required
                />
              </label>

              <button
                type="button"
                disabled={submittingSeries.senx || clearing}
                className="btn-primary btn-series"
                onClick={() => handleGenerateSeries('senx')}
              >
                {submittingSeries.senx ? 'Generando...' : 'Generar Sen(x)'}
              </button>
            </fieldset>

            <fieldset className="series-input-group">
              <legend>Ln(x) - Taylor</legend>
              <label>
                <span>Generación (n)</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formValues.lnx.n}
                  onChange={(event) => handleChange('lnx', 'n', event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Repetición (r)</span>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={formValues.lnx.r}
                  onChange={(event) => handleChange('lnx', 'r', event.target.value)}
                  required
                />
              </label>

              <button
                type="button"
                disabled={submittingSeries.lnx || clearing}
                className="btn-primary btn-series"
                onClick={() => handleGenerateSeries('lnx')}
              >
                {submittingSeries.lnx ? 'Generando...' : 'Generar Ln(x)'}
              </button>
            </fieldset>
          </div>

          <div className="control-actions">
            <button type="button" disabled={clearing} className="btn-primary" onClick={handleClearData}>
              Limpiar datos
            </button>
          </div>
        </div>

        <div className="status-bar">
          <span className={`connection-badge ${connectionState}`}>{connectionLabel}</span>
          {message && <span className="msg-success">{message}</span>}
          {errorMessage && <span className="msg-error">{errorMessage}</span>}
        </div>
      </section>

      <div className="charts-grid">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Cargando datos...</p>
          </div>
        ) : (
          <>
            <SeriesChart
              title="Serie Fibonacci"
              data={dashboardData.fibonacci}
              color="#3b82f6"
              valueKey="valor"
            />
            <SeriesChart
              title="Serie Sen(x) - Taylor"
              data={dashboardData.senx}
              color="#10b981"
              valueKey="aproximacion"
            />
            <SeriesChart
              title="Serie Ln(x) - Taylor"
              data={dashboardData.lnx}
              color="#f59e0b"
              valueKey="aproximacion"
            />
          </>
        )}
      </div>
    </main>
  )
}

export default App

