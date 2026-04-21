import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ComposedChart, Bar, Legend
} from 'recharts';
import {
  Compass, ThermometerSun, Droplets, Radar,
  Activity, ShieldCheck, Terminal, Cpu, AlertTriangle
} from 'lucide-react';
import Cube3D from '../components/Cube3D';
import styles from './Dashboard.module.css';

const formatDateTimeLabels = (point) => {
  if (!point || typeof point !== 'object') {
    return point;
  }

  let parsedDate = null;

  if (point.created_at) {
    const fromCreated = new Date(point.created_at);
    if (!Number.isNaN(fromCreated.getTime())) {
      parsedDate = fromCreated;
    }
  }

  if (!parsedDate && point.fecha && point.hora) {
    const fromFechaHora = new Date(`${point.fecha}T${point.hora}`);
    if (!Number.isNaN(fromFechaHora.getTime())) {
      parsedDate = fromFechaHora;
    }
  }

  if (!parsedDate && point.fecha) {
    const fromFecha = new Date(point.fecha);
    if (!Number.isNaN(fromFecha.getTime())) {
      parsedDate = fromFecha;
    }
  }

  const dateLabel = parsedDate
    ? parsedDate.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '--/--/----';

  const timeLabel = parsedDate
    ? parsedDate.toLocaleTimeString('es-BO', { hour12: false })
    : (point.time || '--:--:--');

  return {
    ...point,
    dateLabel,
    time: timeLabel,
    dateTimeLabel: `${dateLabel} ${timeLabel}`,
  };
};

// Custom Tooltip para gráficas
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const source = payload[0]?.payload || {};
    const dateText = source.dateLabel || '--/--/----';
    const timeText = source.time || label || '--:--:--';

    return (
      <div className={styles.customTooltip}>
        <p className={styles.tooltipLabel}>{`Fecha: ${dateText}`}</p>
        <p className={styles.tooltipLabel}>{`Hora: ${timeText}`}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [dht22Data, setDht22Data] = useState([]);
  const [gy50Data, setGy50Data] = useState([]);
  const [hcsr04Data, setHcsr04Data] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [realtimeDht, setRealtimeDht] = useState(null);
  const [realtimeGyro, setRealtimeGyro] = useState(null);
  const [realtimeDistance, setRealtimeDistance] = useState(null);
  const [gyro, setGyro] = useState({ x: 15, y: -20, z: 0 });
  const [currentDist, setCurrentDist] = useState(45);

  const appendRealtimePoint = (setter, point) => {
    if (!point || typeof point !== 'object') {
      return;
    }

    const normalizedPoint = formatDateTimeLabels(point);

    setter((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const last = list.length ? list[list.length - 1] : null;

      // Evita duplicar el mismo paquete cuando llega tambien por dashboard-update.
      if (last && last.id && normalizedPoint.id && String(last.id) === String(normalizedPoint.id)) {
        return list;
      }

      return [...list, normalizedPoint].slice(-120);
    });
  };

  const applyDashboardData = (payload) => {
    setDht22Data(Array.isArray(payload?.dht22) ? payload.dht22.map(formatDateTimeLabels) : []);
    setGy50Data(Array.isArray(payload?.gy50) ? payload.gy50.map(formatDateTimeLabels) : []);
    setHcsr04Data(Array.isArray(payload?.hcsr04) ? payload.hcsr04.map(formatDateTimeLabels) : []);
    setAuditLogs(Array.isArray(payload?.auditoria) ? payload.auditoria : []);
  };

  useEffect(() => {
    let isMounted = true;
    let reconnectTimer = null;
    let events = null;

    const loadDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard-data');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'No se pudo cargar el dashboard');
        }

        if (isMounted) {
          applyDashboardData(data);
        }
      } catch {
        // Conserva el último estado válido si falla una lectura puntual.
      }
    };

    const loadRealtimeState = async () => {
      try {
        const response = await fetch('/api/realtime-state');
        const data = await response.json();
        if (!response.ok) {
          throw new Error();
        }

        if (isMounted) {
          setRealtimeDht(data?.dht22 || null);
          setRealtimeGyro(data?.gy50 || null);
          setRealtimeDistance(data?.hcsr04 || null);
        }
      } catch {
        // Usa fallback con historico si falla lectura del estado realtime.
      }
    };

    const connectEvents = () => {
      if (!isMounted) {
        return;
      }

      events = new EventSource('/api/events');
      events.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'dashboard-update' && parsed.data) {
            applyDashboardData(parsed.data);
            return;
          }

          if (parsed.type === 'sensor-realtime' && parsed.data) {
            const nextDht = parsed.data.dht22 || null;
            const nextGyro = parsed.data.gy50 || null;
            const nextDistance = parsed.data.hcsr04 || null;

            setRealtimeDht(nextDht);
            setRealtimeGyro(nextGyro);
            setRealtimeDistance(nextDistance);

            appendRealtimePoint(setDht22Data, nextDht);
            appendRealtimePoint(setGy50Data, nextGyro);
            appendRealtimePoint(setHcsr04Data, nextDistance);
            return;
          }

          if (parsed.type === 'connected' && parsed.realtime) {
            setRealtimeDht(parsed.realtime.dht22 || null);
            setRealtimeGyro(parsed.realtime.gy50 || null);
            setRealtimeDistance(parsed.realtime.hcsr04 || null);
          }
        } catch {
          // Ignora mensajes incompletos.
        }
      };

      events.onerror = () => {
        if (events) {
          events.close();
          events = null;
        }

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        reconnectTimer = setTimeout(() => {
          connectEvents();
        }, 1200);
      };
    };

    loadDashboardData();
    loadRealtimeState();
    connectEvents();

    const realtimePoll = setInterval(() => {
      loadRealtimeState();
    }, 1500);

    const historyPoll = setInterval(() => {
      loadDashboardData();
    }, 10000);

    return () => {
      isMounted = false;

      if (events) {
        events.close();
      }

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      clearInterval(realtimePoll);
      clearInterval(historyPoll);
    };
  }, []);

  useEffect(() => {
    if (realtimeGyro) {
      setGyro({
        x: Number.isFinite(realtimeGyro.gyroX) ? realtimeGyro.gyroX : 15,
        y: Number.isFinite(realtimeGyro.gyroY) ? realtimeGyro.gyroY : -20,
        z: Number.isFinite(realtimeGyro.gyroZ) ? realtimeGyro.gyroZ : 0,
      });
      return;
    }

    if (!gy50Data.length) {
      return;
    }

    const lastGyro = gy50Data[gy50Data.length - 1];
    setGyro({
      x: Number.isFinite(lastGyro.gyroX) ? lastGyro.gyroX : 15,
      y: Number.isFinite(lastGyro.gyroY) ? lastGyro.gyroY : -20,
      z: Number.isFinite(lastGyro.gyroZ) ? lastGyro.gyroZ : 0,
    });
  }, [realtimeGyro, gy50Data]);

  useEffect(() => {
    if (realtimeDistance && Number.isFinite(realtimeDistance.dist)) {
      setCurrentDist(Math.round(realtimeDistance.dist));
      return;
    }

    if (!hcsr04Data.length) {
      return;
    }

    const lastDistance = hcsr04Data[hcsr04Data.length - 1]?.dist;
    setCurrentDist(Number.isFinite(lastDistance) ? Math.round(lastDistance) : 45);
  }, [realtimeDistance, hcsr04Data]);

  const latestDht = realtimeDht || (dht22Data.length ? dht22Data[dht22Data.length - 1] : null);

  return (
    <div className={styles.dashboardContainer}>

      {/* Header del Dashboard */}
      <header className={styles.dashHeader}>
        <div>
          <h1 className={styles.mainTitle}>Drako Control Center</h1>
          <p className={styles.subTitle}>Monitoreo de Telemetría IoT en Tiempo Real</p>
        </div>
        <div className={styles.systemStatus}>
          <div className={styles.statusDot}></div>
          <span>SISTEMA EN LÍNEA</span>
        </div>
      </header>

      <div className={styles.dashboardGrid}>

        {/* ROW 1: WIDGETS PRINCIPALES */}
        {/* Widget 3D */}
        <div
          className={`${styles.widget} ${styles.cubeWidget}`}
        >
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Cinemática (GY50)</span>
            <Compass size={22} className={styles.iconBlue} />
          </div>
          <Cube3D gyroX={gyro.x} gyroY={gyro.y} gyroZ={gyro.z} />
          <div className={styles.cubeControls}>
            <div className={styles.axisData}>
              <span>Pitch (X)</span>
              <strong style={{ color: '#f59e0b' }}>{gyro.x.toFixed(1)}°</strong>
            </div>
            <div className={styles.axisData}>
              <span>Yaw (Y)</span>
              <strong style={{ color: '#ef4444' }}>{gyro.y.toFixed(1)}°</strong>
            </div>
            <div className={styles.axisData}>
              <span>Roll (Z)</span>
              <strong style={{ color: '#3b82f6' }}>{gyro.z.toFixed(1)}°</strong>
            </div>
          </div>
        </div>

        {/* Widget de Clima */}
        <div className={`${styles.widget} ${styles.weatherWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Condiciones (DHT22)</span>
            <Activity size={22} className={styles.iconGreen} />
          </div>
          <div className={styles.weatherData}>
            <div className={styles.dataValue}>
              <ThermometerSun size={32} color="#78ba49" className={styles.valueIcon} />
              <h3>{Number.isFinite(latestDht?.temp) ? `${latestDht.temp.toFixed(1)}°C` : '--'}</h3>
              <p>Temperatura</p>
            </div>
            <div className={styles.divider}></div>
            <div className={styles.dataValue}>
              <Droplets size={32} color="#0ea5e9" className={styles.valueIcon} />
              <h3 style={{ color: '#0ea5e9' }}>{Number.isFinite(latestDht?.hum) ? `${Math.round(latestDht.hum)}%` : '--'}</h3>
              <p>Humedad Rel.</p>
            </div>
          </div>
        </div>

        {/* Widget de Proximidad con Radar Animado */}
        <div className={`${styles.widget} ${styles.proximityWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Sonar (HC-SR04)</span>
            <Radar size={22} className={styles.iconPurple} />
          </div>
          <div className={styles.radarContainer}>
            <div className={styles.radarScreen}>
              <div className={styles.radarSweep}></div>
              <span className={`${styles.radarValue} ${currentDist < 20 ? styles.danger : ''}`}>
                {currentDist}cm
              </span>
            </div>
            <p className={styles.radarLabel}>Distancia Frontal</p>
          </div>
        </div>

        {/* ROW 2: GRAFICOS COMPUESTOS Y AUDITORIA */}
        {/* Gráfico Combinado: Temp & Humedad */}
        <div className={`${styles.widget} ${styles.chartWidgetLarge}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Análisis Ambiental Correlacionado</span>
            <ThermometerSun size={20} className={styles.iconMuted} />
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dht22Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#78ba49" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#78ba49" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={10} />
                <YAxis yAxisId="left" stroke="rgba(120, 186, 73, 0.7)" fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(14, 165, 233, 0.7)" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area yAxisId="left" type="monotone" dataKey="temp" name="Temp (°C)" stroke="#78ba49" strokeWidth={2} fill="url(#colorTemp)" />
                <Line yAxisId="right" type="monotone" dataKey="hum" name="Humedad (%)" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4, fill: '#070d19', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel de Auditoría (DB logs) */}
        <div className={`${styles.widget} ${styles.auditWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Auditoría del Sistema</span>
            <Terminal size={20} className={styles.iconMuted} />
          </div>
          <div className={styles.auditList}>
            {auditLogs.map((log) => (
              <div key={log.id} className={styles.auditItem}>
                <div className={styles.auditIconWrapper}>
                  {log.type === 'warning' ? <AlertTriangle size={16} color="#ef4444" /> :
                    log.type === 'info' ? <ShieldCheck size={16} color="#3b82f6" /> :
                      <Cpu size={16} color="#78ba49" />}
                </div>
                <div className={styles.auditDetails}>
                  <div className={styles.auditTopRow}>
                    <span className={styles.auditAction}>[{log.action}]</span>
                    <span className={styles.auditTime}>{log.time}</span>
                  </div>
                  <p className={styles.auditDesc}>{log.desc}</p>
                  <span className={styles.auditUser}>User: {log.user} | Tabla: {log.table}</span>
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className={styles.auditItem}>
                <div className={styles.auditDetails}>
                  <p className={styles.auditDesc}>Sin eventos de auditoría disponibles.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: GYRO Y DISTANCIA */}
        {/* Gráfico 3: Orientación GY50 */}
        <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Estabilidad Inercial (GY50)</span>
            <Activity size={20} className={styles.iconMuted} />
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gy50Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="gyroX" stroke="#f59e0b" strokeWidth={2} dot={false} name="Pitch (X)" />
                <Line type="monotone" dataKey="gyroY" stroke="#ef4444" strokeWidth={2} dot={false} name="Yaw (Y)" />
                <Line type="monotone" dataKey="gyroZ" stroke="#3b82f6" strokeWidth={2} dot={false} name="Roll (Z)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Distancia HC-SR04 */}
        <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Histórico de Proximidad</span>
            <Radar size={20} className={styles.iconMuted} />
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hcsr04Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} reversed={true} /> {/* Reversed: Cero arriba significa colisión */}
                <Tooltip content={<CustomTooltip />} />
                <Area type="step" dataKey="dist" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorDist)" name="Distancia (cm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}