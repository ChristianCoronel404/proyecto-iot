import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ComposedChart, Bar, Legend
} from 'recharts';
import {
  Compass, ThermometerSun, Droplets, Radar,
  Activity, ShieldCheck, Terminal, Cpu, AlertTriangle,
  ArrowUp, ArrowLeft, ArrowRight, CircleSlash, Radio
} from 'lucide-react';
import Cube3D from '../components/Cube3D';
import RobotCar3D from '../components/RobotCar3D';
import styles from './Dashboard.module.css';

const formatDateTimeLabels = (point) => {
  if (!point || typeof point !== 'object') return point;
  let parsedDate = null;
  if (point.created_at) {
    const d = new Date(point.created_at);
    if (!Number.isNaN(d.getTime())) parsedDate = d;
  }
  if (!parsedDate && point.fecha && point.hora) {
    const d = new Date(`${point.fecha}T${point.hora}`);
    if (!Number.isNaN(d.getTime())) parsedDate = d;
  }
  if (!parsedDate && point.fecha) {
    const d = new Date(point.fecha);
    if (!Number.isNaN(d.getTime())) parsedDate = d;
  }
  const dateLabel = parsedDate
    ? parsedDate.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '--/--/----';
  const timeLabel = parsedDate
    ? parsedDate.toLocaleTimeString('es-BO', { hour12: false })
    : (point.time || '--:--:--');
  return { ...point, dateLabel, time: timeLabel, dateTimeLabel: `${dateLabel} ${timeLabel}` };
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const src = payload[0]?.payload || {};
  return (
    <div className={styles.customTooltip}>
      <p className={styles.tooltipLabel}>{`Fecha: ${src.dateLabel || '--/--/----'}`}</p>
      <p className={styles.tooltipLabel}>{`Hora:  ${src.time  || label || '--:--:--'}`}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color, margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
          {entry.name}: {entry.value !== null ? entry.value : '—'}
        </p>
      ))}
    </div>
  );
};

// ── Indicador de un sensor de distancia (izq/centro/der) ──
const DistanceBadge = ({ label, value, threshold, color }) => {
  const isAlarm = Number.isFinite(value) && value > 0 && value < threshold;
  return (
    <div className={styles.distBadge} style={{ borderColor: isAlarm ? '#ef4444' : 'rgba(139,92,246,0.4)' }}>
      <span className={styles.distBadgeLabel}>{label}</span>
      <span
        className={styles.distBadgeValue}
        style={{ color: isAlarm ? '#ef4444' : (color || '#fff'), textShadow: isAlarm ? '0 0 8px #ef4444' : 'none' }}
      >
        {Number.isFinite(value) && value > 0 ? `${value} cm` : '— cm'}
      </span>
    </div>
  );
};

export default function Dashboard() {
  const [dht22Data,       setDht22Data]       = useState([]);
  const [gy50Data,        setGy50Data]        = useState([]);
  const [hcsr04Data,      setHcsr04Data]      = useState([]);
  const [auditLogs,       setAuditLogs]       = useState([]);
  const [realtimeDht,     setRealtimeDht]     = useState(null);
  const [realtimeGyro,    setRealtimeGyro]    = useState(null);
  const [realtimeDistance,setRealtimeDistance]= useState(null);
  const [gyro,            setGyro]            = useState({ x: 15, y: -20, z: 0 });
  const [currentDist,     setCurrentDist]     = useState(45);

  // ── Estado de navegación del robot (inferido de las distancias) ──
  const robotStatus = useMemo(() => {
    const dist    = realtimeDistance?.dist;
    const distIzq = realtimeDistance?.distIzq;
    const distDer = realtimeDistance?.distDer;

    if (dist === null || dist === undefined) {
      return { label: 'SIN SEÑAL', detail: 'Esperando datos del robot...', color: '#64748b', Icon: CircleSlash };
    }
    if (Number.isFinite(dist) && dist > 0 && dist < 20) {
      const dir = (Number.isFinite(distIzq) && Number.isFinite(distDer))
        ? (distIzq > distDer ? '← GIRA IZQ' : 'GIRA DER →')
        : 'CALCULANDO';
      return { label: 'OBSTÁCULO FRONTAL', detail: dir, color: '#ef4444', Icon: AlertTriangle };
    }
    if (Number.isFinite(distIzq) && distIzq > 0 && distIzq < 15) {
      return { label: 'PARED IZQUIERDA', detail: 'CORRIGIENDO → DER', color: '#f59e0b', Icon: ArrowRight };
    }
    if (Number.isFinite(distDer) && distDer > 0 && distDer < 15) {
      return { label: 'PARED DERECHA', detail: '← IZQ CORRIGIENDO', color: '#f59e0b', Icon: ArrowLeft };
    }
    return { label: 'CAMINO LIBRE', detail: 'AVANZANDO', color: '#78ba49', Icon: ArrowUp };
  }, [realtimeDistance]);

  const appendRealtimePoint = (setter, point) => {
    if (!point || typeof point !== 'object') return;
    const normalized = formatDateTimeLabels(point);
    setter((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const last = list.length ? list[list.length - 1] : null;
      if (last?.id && normalized.id && String(last.id) === String(normalized.id)) return list;
      return [...list, normalized].slice(-120);
    });
  };

  const applyDashboardData = (payload) => {
    setDht22Data( Array.isArray(payload?.dht22)     ? payload.dht22.map(formatDateTimeLabels)  : []);
    setGy50Data(  Array.isArray(payload?.gy50)      ? payload.gy50.map(formatDateTimeLabels)   : []);
    setHcsr04Data(Array.isArray(payload?.hcsr04)    ? payload.hcsr04.map(formatDateTimeLabels) : []);
    setAuditLogs( Array.isArray(payload?.auditoria) ? payload.auditoria : []);
  };

  useEffect(() => {
    let isMounted = true;
    let reconnectTimer = null;
    let events = null;

    const loadDashboardData = async () => {
      try {
        const res  = await fetch('/api/dashboard-data');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error cargando dashboard');
        if (isMounted) applyDashboardData(data);
      } catch { /* conserva último estado válido */ }
    };

    const loadRealtimeState = async () => {
      try {
        const res  = await fetch('/api/realtime-state');
        const data = await res.json();
        if (!res.ok) throw new Error();
        if (isMounted) {
          setRealtimeDht(data?.dht22 || null);
          setRealtimeGyro(data?.gy50 || null);
          setRealtimeDistance(data?.hcsr04 || null);
        }
      } catch { /* usa estado anterior */ }
    };

    const connectWs = () => {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      events = new WebSocket(`${protocol}//${window.location.host}/ws-dashboard`);

      events.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'dashboard-update' && parsed.data) { applyDashboardData(parsed.data); return; }
          if (parsed.type === 'sensor-realtime' && parsed.data) {
            const { dht22, gy50, hcsr04 } = parsed.data;
            setRealtimeDht(dht22 || null);
            setRealtimeGyro(gy50 || null);
            setRealtimeDistance(hcsr04 || null);
            appendRealtimePoint(setDht22Data,  dht22);
            appendRealtimePoint(setGy50Data,   gy50);
            appendRealtimePoint(setHcsr04Data, hcsr04);
            return;
          }
          if (parsed.type === 'connected' && parsed.realtime) {
            setRealtimeDht(parsed.realtime.dht22 || null);
            setRealtimeGyro(parsed.realtime.gy50 || null);
            setRealtimeDistance(parsed.realtime.hcsr04 || null);
          }
        } catch { /* mensaje incompleto */ }
      };

      events.onclose = () => {
        events = null;
        if (!isMounted) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectWs, 1200);
      };

      events.onerror = () => events?.close();
    };

    loadDashboardData();
    loadRealtimeState();
    connectWs();
    const realtimePoll = setInterval(loadRealtimeState, 1500);
    const historyPoll  = setInterval(loadDashboardData, 10000);

    return () => {
      isMounted = false;
      events?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
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
    if (!gy50Data.length) return;
    const last = gy50Data[gy50Data.length - 1];
    setGyro({
      x: Number.isFinite(last.gyroX) ? last.gyroX : 15,
      y: Number.isFinite(last.gyroY) ? last.gyroY : -20,
      z: Number.isFinite(last.gyroZ) ? last.gyroZ : 0,
    });
  }, [realtimeGyro, gy50Data]);

  useEffect(() => {
    if (realtimeDistance && Number.isFinite(realtimeDistance.dist)) {
      setCurrentDist(Math.round(realtimeDistance.dist));
      return;
    }
    if (!hcsr04Data.length) return;
    const last = hcsr04Data[hcsr04Data.length - 1]?.dist;
    setCurrentDist(Number.isFinite(last) ? Math.round(last) : 45);
  }, [realtimeDistance, hcsr04Data]);

  const latestDht  = realtimeDht || (dht22Data.length ? dht22Data[dht22Data.length - 1] : null);
  const latestDist = realtimeDistance || (hcsr04Data.length ? hcsr04Data[hcsr04Data.length - 1] : null);
  const { Icon: StatusIcon } = robotStatus;

  return (
    <div className={styles.dashboardContainer}>

      {/* Header */}
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

      {/* ── Barra de estado del robot ── */}
      <div className={styles.robotStatusBar} style={{ borderColor: robotStatus.color }}>
        <StatusIcon size={20} style={{ color: robotStatus.color, flexShrink: 0 }} />
        <div className={styles.robotStatusText}>
          <span className={styles.robotStatusLabel} style={{ color: robotStatus.color }}>
            {robotStatus.label}
          </span>
          <span className={styles.robotStatusDetail}>{robotStatus.detail}</span>
        </div>
        <div className={styles.robotStatusSensors}>
          <Radio size={14} style={{ color: realtimeDistance ? '#8b5cf6' : '#64748b' }} />
          <span style={{ color: realtimeDistance ? '#8b5cf6' : '#64748b' }}>
            {realtimeDistance ? 'HC-SR04 · 3 sensores activos' : 'HC-SR04 · sin señal'}
          </span>
        </div>
      </div>

      <div className={styles.dashboardGrid}>

        {/* ── SENSOR 1: DHT22 ── */}
        <div className={`${styles.widget} ${styles.sensorWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>DHT22 · Ambiente</span>
            <Activity size={20} className={styles.iconGreen} />
          </div>
          <div className={styles.weatherData}>
            <div className={styles.dataValue}>
              <ThermometerSun size={28} color="#78ba49" className={styles.valueIcon} />
              <h3>{Number.isFinite(latestDht?.temp) ? `${latestDht.temp.toFixed(1)}°C` : '--'}</h3>
              <p>Temperatura</p>
            </div>
            <div className={styles.divider} />
            <div className={styles.dataValue}>
              <Droplets size={28} color="#0ea5e9" className={styles.valueIcon} />
              <h3 style={{ color: '#0ea5e9' }}>{Number.isFinite(latestDht?.hum) ? `${Math.round(latestDht.hum)}%` : '--'}</h3>
              <p>Humedad</p>
            </div>
          </div>
        </div>

        {/* ── SENSOR 2: GY-50 ── */}
        <div className={`${styles.widget} ${styles.sensorWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>GY-50 · Giroscopio</span>
            <Compass size={20} className={styles.iconBlue} />
          </div>
          <Cube3D gyroX={gyro.x} gyroY={gyro.y} gyroZ={gyro.z} />
          <div className={styles.cubeControls}>
            <div className={styles.axisData}>
              <span>Pitch</span>
              <strong style={{ color: '#f59e0b' }}>{gyro.x.toFixed(1)}°</strong>
            </div>
            <div className={styles.axisData}>
              <span>Yaw</span>
              <strong style={{ color: '#ef4444' }}>{gyro.y.toFixed(1)}°</strong>
            </div>
            <div className={styles.axisData}>
              <span>Roll</span>
              <strong style={{ color: '#3b82f6' }}>{gyro.z.toFixed(1)}°</strong>
            </div>
          </div>
        </div>

        {/* ── SENSOR 3: HC-SR04 × 3 ── */}
        <div className={`${styles.widget} ${styles.sensorWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>HC-SR04 · Sonar × 3</span>
            <Radar size={20} className={styles.iconPurple} />
          </div>
          <div className={styles.radarContainer}>
            <div className={styles.radarScreen}>
              <div className={styles.radarSweep} />
              <span className={`${styles.radarValue} ${currentDist < 20 ? styles.danger : ''}`}>
                {currentDist}cm
              </span>
            </div>
            <p className={styles.radarLabel}>Frontal</p>
          </div>
          <div className={styles.sensorTriple}>
            <DistanceBadge label="IZQ"    value={latestDist?.distIzq} threshold={15} color="#f59e0b" />
            <DistanceBadge label="CENTRO" value={latestDist?.dist}    threshold={20} color="#8b5cf6" />
            <DistanceBadge label="DER"    value={latestDist?.distDer} threshold={15} color="#f59e0b" />
          </div>
        </div>

        {/* ── ROBOT 3D: Dinámica del carro ── */}
        <div className={`${styles.widget} ${styles.sensorWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Drako · Dinámica 3D</span>
            <ArrowUp size={20} style={{ color: robotStatus.color }} />
          </div>
          <RobotCar3D
            navLabel={robotStatus.label}
            gyroX={gyro.x}
            gyroZ={gyro.z}
            distCentro={latestDist?.dist}
            distIzq={latestDist?.distIzq}
            distDer={latestDist?.distDer}
          />
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <span style={{
              display: 'inline-block',
              padding: '0.3rem 1rem',
              borderRadius: '20px',
              border: `1px solid ${robotStatus.color}55`,
              background: `${robotStatus.color}18`,
              color: robotStatus.color,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '1.5px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
            }}>
              {robotStatus.detail}
            </span>
          </div>
        </div>

        {/* Gráfica combinada: Temp & Humedad */}
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
                    <stop offset="5%"  stopColor="#78ba49" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#78ba49" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={10} />
                <YAxis yAxisId="left"  stroke="rgba(120,186,73,0.7)"  fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(14,165,233,0.7)" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area yAxisId="left"  type="monotone" dataKey="temp" name="Temp (°C)"   stroke="#78ba49" strokeWidth={2} fill="url(#colorTemp)" />
                <Line yAxisId="right" type="monotone" dataKey="hum"  name="Humedad (%)" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4, fill: '#070d19', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel de Auditoría */}
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
                   log.type === 'info'    ? <ShieldCheck   size={16} color="#3b82f6" /> :
                                            <Cpu           size={16} color="#78ba49" />}
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

        {/* Gráfica: Estabilidad Inercial GY-50 */}
        <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Estabilidad Inercial (GY-50)</span>
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
                <Line type="monotone" dataKey="gyroY" stroke="#ef4444" strokeWidth={2} dot={false} name="Yaw (Y)"   />
                <Line type="monotone" dataKey="gyroZ" stroke="#3b82f6" strokeWidth={2} dot={false} name="Roll (Z)"  />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfica: Histórico de Proximidad (3 sensores) */}
        <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Histórico de Proximidad (× 3)</span>
            <Radar size={20} className={styles.iconMuted} />
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hcsr04Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDistCentro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="colorDistIzq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="colorDistDer" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={10} />
                {/* reversed: 0 cm arriba = colisión inminente */}
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} reversed={true} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="step" dataKey="dist"    stroke="#8b5cf6" strokeWidth={2} fill="url(#colorDistCentro)" name="Centro (cm)" />
                <Area type="step" dataKey="distIzq" stroke="#f59e0b" strokeWidth={1.5} fill="url(#colorDistIzq)"   name="Izq (cm)"    connectNulls />
                <Area type="step" dataKey="distDer" stroke="#f97316" strokeWidth={1.5} fill="url(#colorDistDer)"   name="Der (cm)"    connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
