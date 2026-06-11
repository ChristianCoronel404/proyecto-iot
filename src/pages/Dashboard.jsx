import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from 'recharts';
import {
  Compass, ThermometerSun, Droplets, Radar,
  Activity, ShieldCheck, Terminal, Cpu, AlertTriangle,
  ArrowUp, ArrowLeft, ArrowRight, CircleSlash, Radio, Settings, Zap,
} from 'lucide-react';
import RobotCar3D from '../components/RobotCar3D';
import styles from './Dashboard.module.css';

// ── Helpers ──────────────────────────────────────────────────
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

// ── Color helpers ──
const tempColor = (t) => {
  if (!Number.isFinite(t)) return '#64748b';
  if (t < 15) return '#0ea5e9';
  if (t < 22) return '#22d3ee';
  if (t < 28) return '#78ba49';
  if (t < 35) return '#f59e0b';
  return '#ef4444';
};
const humColor = (h) => {
  if (!Number.isFinite(h)) return '#64748b';
  if (h < 30) return '#f59e0b';
  if (h < 50) return '#22d3ee';
  if (h < 70) return '#0ea5e9';
  return '#3b82f6';
};

// ── Widget DHT22: barras animadas verticales ──
const TempHumBars = ({ temp, hum }) => {
  const tVal   = Number.isFinite(temp) ? temp : null;
  const hVal   = Number.isFinite(hum)  ? hum  : null;
  const tPct   = tVal !== null ? Math.min(100, Math.max(2, (tVal / 50) * 100)) : 0;
  const hPct   = hVal !== null ? Math.min(100, Math.max(2, hVal))              : 0;
  const tColor = tempColor(tVal);
  const hColor = humColor(hVal);

  return (
    <div className={styles.tempHumBars}>
      <div className={styles.barGroup}>
        <span className={styles.barBigNum} style={{ color: tColor }}>
          {tVal !== null ? `${tVal.toFixed(1)}°` : '—'}
        </span>
        <div className={styles.barTrack}>
          <div
            className={styles.barFill}
            style={{
              height: `${tPct}%`,
              background: `linear-gradient(to top, ${tColor}88, ${tColor})`,
              boxShadow: `0 0 18px ${tColor}66`,
            }}
          />
          {[25, 50, 75].map(tick => (
            <div key={tick} className={styles.barTick} style={{ bottom: `${tick}%` }} />
          ))}
        </div>
        <span className={styles.barLabel}>
          <ThermometerSun size={12} style={{ color: tColor }} /> TEMP
        </span>
      </div>

      <div className={styles.barsDivider}>
        <Activity size={18} color="#64748b" />
      </div>

      <div className={styles.barGroup}>
        <span className={styles.barBigNum} style={{ color: hColor }}>
          {hVal !== null ? `${Math.round(hVal)}%` : '—'}
        </span>
        <div className={styles.barTrack}>
          <div
            className={styles.barFill}
            style={{
              height: `${hPct}%`,
              background: `linear-gradient(to top, ${hColor}88, ${hColor})`,
              boxShadow: `0 0 18px ${hColor}66`,
            }}
          />
          {[25, 50, 75].map(tick => (
            <div key={tick} className={styles.barTick} style={{ bottom: `${tick}%` }} />
          ))}
        </div>
        <span className={styles.barLabel}>
          <Droplets size={12} style={{ color: hColor }} /> HUM
        </span>
      </div>
    </div>
  );
};

// ── Widget GY-50: brújula con heading acumulado ──
const GyroHeadingWidget = ({ gyroX, gyroY, gyroZ, heading }) => {
  const h = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : null;
  const cardinals = [
    { a: 0,   l: 'N',  main: true  },
    { a: 45,  l: 'NE', main: false },
    { a: 90,  l: 'E',  main: true  },
    { a: 135, l: 'SE', main: false },
    { a: 180, l: 'S',  main: true  },
    { a: 225, l: 'SO', main: false },
    { a: 270, l: 'O',  main: true  },
    { a: 315, l: 'NO', main: false },
  ];

  return (
    <div className={styles.gyroWidget}>
      <svg viewBox="0 0 120 120" className={styles.gyroCompassSvg}>
        <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

        {cardinals.map(({ a, l, main }) => {
          const rad = (a - 90) * Math.PI / 180;
          return (
            <g key={a}>
              <line
                x1={60 + 47 * Math.cos(rad)} y1={60 + 47 * Math.sin(rad)}
                x2={60 + 54 * Math.cos(rad)} y2={60 + 54 * Math.sin(rad)}
                stroke={main ? (l === 'N' ? '#78ba49' : 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.15)'}
                strokeWidth={main ? 2 : 1}
              />
              <text
                x={60 + 39 * Math.cos(rad)} y={60 + 39 * Math.sin(rad)}
                fontSize={main ? '7' : '5.5'}
                fill={l === 'N' ? '#78ba49' : 'rgba(255,255,255,0.4)'}
                textAnchor="middle" dominantBaseline="middle"
              >{l}</text>
            </g>
          );
        })}

        {h !== null && (
          <g style={{
            transformOrigin: '60px 60px',
            transform: `rotate(${h}deg)`,
            transition: 'transform 0.35s ease',
          }}>
            <line x1="60" y1="60" x2="60" y2="14" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
            <polygon points="60,8 56.5,18 63.5,18" fill="#ef4444" />
            <line x1="60" y1="60" x2="60" y2="102" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        <circle cx="60" cy="60" r="5.5" fill="#3b82f6" />
        <circle cx="60" cy="60" r="2.5" fill="#93c5fd" />
      </svg>

      <div className={styles.gyroValues}>
        <div className={styles.gyroHeadingVal}>
          <span className={styles.gyroHeadingNum}>{h !== null ? `${Math.round(h)}°` : '—'}</span>
          <span className={styles.gyroHeadingLbl}>HEADING</span>
        </div>
        <div className={styles.gyroAxisRow}>
          <div className={styles.gyroAxisItem}>
            <span>Pitch</span>
            <strong style={{ color: '#f59e0b' }}>{Number.isFinite(gyroX) ? `${gyroX.toFixed(1)}` : '—'}</strong>
          </div>
          <div className={styles.gyroAxisItem}>
            <span>Roll</span>
            <strong style={{ color: '#3b82f6' }}>{Number.isFinite(gyroY) ? `${gyroY.toFixed(1)}` : '—'}</strong>
          </div>
          <div className={styles.gyroAxisItem}>
            <span>Yaw/s</span>
            <strong style={{ color: '#8b5cf6' }}>{Number.isFinite(gyroZ) ? `${gyroZ.toFixed(1)}` : '—'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Widget HC-SR04: 5 ángulos de escaneo ──
const SCAN_LABELS = { 0: 'DER-0°', 45: 'D-45°', 90: 'FRENTE', 135: 'I-135°', 180: 'IZQ-180°' };
const SCAN_ANGLE_COLORS = { 0: '#f97316', 45: '#f59e0b', 90: '#78ba49', 135: '#22d3ee', 180: '#8b5cf6' };

const ScanAnglesWidget = ({ scanReadings, currentAngle }) => {
  const MAX_DIST = 200;
  const angles   = [0, 45, 90, 135, 180];

  return (
    <div className={styles.scanAnglesContainer}>
      <div className={styles.scanFijoRow}>
        <span className={styles.scanFijoLabel}><Radar size={11} /> FIJO frontal</span>
        <span
          className={styles.scanFijoVal}
          style={{ color: Number.isFinite(scanReadings.fijo) && scanReadings.fijo < 25 ? '#ef4444' : '#8b5cf6' }}
        >
          {Number.isFinite(scanReadings.fijo) ? `${Math.round(scanReadings.fijo)} cm` : '— cm'}
        </span>
      </div>

      <div className={styles.scanBarsGroup}>
        {angles.map(angle => {
          const dist     = scanReadings[angle];
          const isActive = Number.isFinite(currentAngle)
            ? Math.round(currentAngle / 45) * 45 === angle
            : false;
          const hasVal   = dist !== null && Number.isFinite(dist);
          const pct      = hasVal ? Math.max(4, Math.min(100, (dist / MAX_DIST) * 100)) : 0;
          const base     = SCAN_ANGLE_COLORS[angle];
          const color    = !hasVal ? '#64748b' : dist < 25 ? '#ef4444' : dist < 60 ? '#f59e0b' : base;

          return (
            <div key={angle} className={`${styles.scanBarRow} ${isActive ? styles.scanBarActive : ''}`}>
              <span className={styles.scanAngleLabel} style={{ color }}>{SCAN_LABELS[angle]}</span>
              <div className={styles.scanBarTrack}>
                <div
                  className={styles.scanBarFill}
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(to right, ${color}44, ${color})`,
                    boxShadow: isActive ? `0 0 8px ${color}88` : 'none',
                  }}
                />
              </div>
              <span className={styles.scanBarDist} style={{ color }}>
                {hasVal ? Math.round(dist) : '—'}<span className={styles.scanBarUnit}>cm</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Gauge del Servomotor ──
const ServoGaugeWidget = ({ angle, distMovil }) => {
  const a = Number.isFinite(angle) ? Math.max(0, Math.min(180, angle)) : null;

  const toXY = (deg) => ({
    x: (100 + 80 * Math.cos((deg * Math.PI) / 180)).toFixed(3),
    y: (100 - 80 * Math.sin((deg * Math.PI) / 180)).toFixed(3),
  });

  const endPt    = a !== null && a > 0.5 ? toXY(a) : null;
  const arcColor = a === null ? '#64748b'
    : Math.abs(a - 90) < 30 ? '#8b5cf6'
    : Math.abs(a - 90) < 60 ? '#f59e0b'
    : '#f97316';
  const needleRot = a !== null ? -a : -90;

  const ticks = [
    { deg: 0,   label: 'DER',    x: 188, y: 107 },
    { deg: 45,  label: '45°',   x: 158, y: 46  },
    { deg: 90,  label: 'FRENTE', x: 100, y: 12  },
    { deg: 135, label: '135°',  x: 42,  y: 46  },
    { deg: 180, label: 'IZQ',   x: 12,  y: 107 },
  ];

  return (
    <div className={styles.servoWidgetContent}>
      <svg viewBox="0 0 200 110" className={styles.servoGaugeSvgLarge}>
        <defs>
          <filter id="servoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d="M 20,100 A 80,80 0 0 1 180,100"
              fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round" />
        {endPt && (
          <path d={`M 180,100 A 80,80 0 0 0 ${endPt.x},${endPt.y}`}
                fill="none" stroke={arcColor} strokeWidth="10" strokeLinecap="round"
                filter="url(#servoGlow)" />
        )}
        {ticks.map(({ deg }) => {
          const inner   = toXY(deg);
          const outerPt = {
            x: (100 + 88 * Math.cos((deg * Math.PI) / 180)).toFixed(3),
            y: (100 - 88 * Math.sin((deg * Math.PI) / 180)).toFixed(3),
          };
          return (
            <line key={deg} x1={inner.x} y1={inner.y} x2={outerPt.x} y2={outerPt.y}
                  stroke={deg === 90 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={deg === 90 ? 2 : 1.5} />
          );
        })}
        {ticks.map(({ deg, label, x, y }) => (
          <text key={deg} x={x} y={y} fontSize="7" fill="rgba(255,255,255,0.4)" textAnchor="middle">
            {label}
          </text>
        ))}
        <g style={{
          transformOrigin: '100px 100px',
          transform: `rotate(${needleRot}deg)`,
          transition: 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <line x1="100" y1="100" x2="176" y2="100"
                stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round"
                filter="url(#servoGlow)" />
          <circle cx="176" cy="100" r="3.5" fill="#c4b5fd" />
        </g>
        <circle cx="100" cy="100" r="7" fill="#8b5cf6" />
        <circle cx="100" cy="100" r="3.5" fill="#c4b5fd" />
      </svg>

      <div className={styles.servoStats}>
        <div className={styles.servoStatItem}>
          <span className={styles.servoStatLabel}>ÁNGULO</span>
          <span className={styles.servoStatValue} style={{ color: arcColor }}>
            {a !== null ? `${a}°` : '—'}
          </span>
        </div>
        <div className={styles.servoStatDivider} />
        <div className={styles.servoStatItem}>
          <span className={styles.servoStatLabel}>DIST. MÓVIL</span>
          <span className={styles.servoStatValue} style={{ color: '#78ba49' }}>
            {Number.isFinite(distMovil) ? `${distMovil} cm` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Widget Motores DC ──
const DIR_COLOR = { adelante: '#78ba49', atras: '#f59e0b', stop: '#64748b' };
const DIR_LABEL = { adelante: 'ADELANTE', atras: 'ATRÁS', stop: 'DETENIDO' };
const DIR_ARROW = { adelante: '↑', atras: '↓', stop: '◼' };

const MotorCard = ({ label, motor }) => {
  const m     = motor || { velocidad: 0, direccion: 'stop' };
  const pct   = Math.min(100, Math.max(0, (m.velocidad / 65535) * 100));
  const color = DIR_COLOR[m.direccion] || '#64748b';
  return (
    <div className={styles.motorCard}>
      <div className={styles.motorCardHeader}>
        <span className={styles.motorLabel}>{label}</span>
        <span className={styles.motorArrow} style={{ color }}>{DIR_ARROW[m.direccion] || '?'}</span>
      </div>
      <div className={styles.motorSpeedTrack}>
        <div
          className={styles.motorSpeedFill}
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${color}44, ${color})`,
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      </div>
      <div className={styles.motorCardFooter}>
        <span style={{ color, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '1px' }}>
          {DIR_LABEL[m.direccion] || 'DESCONOCIDO'}
        </span>
        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{Math.round(pct)}% PWM</span>
      </div>
    </div>
  );
};

const MotoresWidget = ({ motorDer, motorIzq }) => (
  <div className={styles.motoresWidget}>
    <MotorCard label="Motor A · Derecho" motor={motorDer} />
    <div className={styles.motorDivider} />
    <MotorCard label="Motor B · Izquierdo" motor={motorIzq} />
  </div>
);

// ── Dashboard principal ───────────────────────────────────────
export default function Dashboard() {
  const [dht22Data,        setDht22Data]        = useState([]);
  const [gy50Data,         setGy50Data]         = useState([]);
  const [hcsr04Data,       setHcsr04Data]       = useState([]);
  const [auditLogs,        setAuditLogs]        = useState([]);
  const [realtimeDht,      setRealtimeDht]      = useState(null);
  const [realtimeGyro,     setRealtimeGyro]     = useState(null);
  const [realtimeDistance, setRealtimeDistance] = useState(null);
  const [realtimeMotores,  setRealtimeMotores]  = useState(null);
  const [gyro,             setGyro]             = useState({ x: 0, y: 0, z: 0 });
  const [heading,          setHeading]          = useState(0);
  const [scanReadings,     setScanReadings]     = useState({ 0: null, 45: null, 90: null, 135: null, 180: null, fijo: null });

  const lastGyroTimeRef = useRef(null);

  // Estado de navegación basado en scan readings reales
  const robotStatus = useMemo(() => {
    const dist = realtimeDistance?.dist;
    if (dist === null || dist === undefined) {
      return { label: 'SIN SEÑAL', detail: 'Esperando datos del robot...', color: '#64748b', Icon: CircleSlash };
    }
    if (Number.isFinite(dist) && dist > 0 && dist < 20) {
      const leftDist  = Math.max(scanReadings[135] ?? 0, scanReadings[180] ?? 0);
      const rightDist = Math.max(scanReadings[45]  ?? 0, scanReadings[0]   ?? 0);
      const dir = leftDist > rightDist ? '← GIRA IZQ' : 'GIRA DER →';
      return { label: 'OBSTÁCULO FRONTAL', detail: dir, color: '#ef4444', Icon: AlertTriangle };
    }
    const leftClose  = (scanReadings[135] ?? 999) < 15 || (scanReadings[180] ?? 999) < 15;
    const rightClose = (scanReadings[45]  ?? 999) < 15 || (scanReadings[0]   ?? 999) < 15;
    if (leftClose)  return { label: 'PARED IZQUIERDA', detail: 'CORRIGIENDO → DER', color: '#f59e0b', Icon: ArrowRight };
    if (rightClose) return { label: 'PARED DERECHA',   detail: '← IZQ CORRIGIENDO', color: '#f59e0b', Icon: ArrowLeft  };
    return { label: 'CAMINO LIBRE', detail: 'AVANZANDO', color: '#78ba49', Icon: ArrowUp };
  }, [realtimeDistance, scanReadings]);

  // Estado de motores inferido del navegador (fallback hasta recibir datos reales)
  const inferredMotores = useMemo(() => {
    const SPEED = 22000, TURN = 45000;
    const label = robotStatus.label;
    if (label === 'CAMINO LIBRE')
      return { motorDer: { velocidad: SPEED, direccion: 'adelante' }, motorIzq: { velocidad: SPEED, direccion: 'adelante' } };
    if (label === 'OBSTÁCULO FRONTAL')
      return { motorDer: { velocidad: 0, direccion: 'stop' }, motorIzq: { velocidad: 0, direccion: 'stop' } };
    if (label === 'PARED IZQUIERDA')
      return { motorDer: { velocidad: TURN, direccion: 'adelante' }, motorIzq: { velocidad: TURN, direccion: 'atras' } };
    if (label === 'PARED DERECHA')
      return { motorDer: { velocidad: TURN, direccion: 'atras' }, motorIzq: { velocidad: TURN, direccion: 'adelante' } };
    return { motorDer: { velocidad: 0, direccion: 'stop' }, motorIzq: { velocidad: 0, direccion: 'stop' } };
  }, [robotStatus]);

  // Datos históricos del HC-SR04 móvil agrupados por ángulo (5 series)
  const hcsr04MovilChartData = useMemo(() => {
    const timeMap = {};
    for (const p of hcsr04Data) {
      const key = p.time || '--';
      if (!timeMap[key]) timeMap[key] = { time: key };
      if (p.anguloServo !== null && p.anguloServo !== undefined && Number.isFinite(p.distMovil)) {
        const snap = Math.round(Number(p.anguloServo) / 45) * 45;
        if ([0, 45, 90, 135, 180].includes(snap)) {
          timeMap[key][`a${snap}`] = Number(Number(p.distMovil).toFixed(1));
        }
      }
    }
    return Object.values(timeMap);
  }, [hcsr04Data]);

  const hcsr04FijoChartData = useMemo(() => {
    return hcsr04Data.filter(d => Number.isFinite(d.dist));
  }, [hcsr04Data]);

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
    let isMounted      = true;
    let reconnectTimer = null;
    let events         = null;

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
          if (data?.motores) setRealtimeMotores(data.motores);
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
            const { dht22, gy50, hcsr04, motores } = parsed.data;
            setRealtimeDht(dht22 || null);
            setRealtimeGyro(gy50 || null);
            setRealtimeDistance(hcsr04 || null);
            if (motores) setRealtimeMotores(motores);
            appendRealtimePoint(setDht22Data,  dht22);
            appendRealtimePoint(setGy50Data,   gy50);
            appendRealtimePoint(setHcsr04Data, hcsr04);
            return;
          }
          if (parsed.type === 'connected' && parsed.realtime) {
            setRealtimeDht(parsed.realtime.dht22 || null);
            setRealtimeGyro(parsed.realtime.gy50 || null);
            setRealtimeDistance(parsed.realtime.hcsr04 || null);
            if (parsed.realtime.motores) setRealtimeMotores(parsed.realtime.motores);
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

  // Sincronizar giroscopio e integrar heading
  useEffect(() => {
    const src = realtimeGyro;
    if (!src) return;

    const now = Date.now();
    if (lastGyroTimeRef.current) {
      const dt   = (now - lastGyroTimeRef.current) / 1000;
      const rate = Number.isFinite(src.gyroZ) ? src.gyroZ : 0;
      setHeading(prev => prev + rate * dt);
    }
    lastGyroTimeRef.current = now;

    setGyro({
      x: Number.isFinite(src.gyroX) ? src.gyroX : 0,
      y: Number.isFinite(src.gyroY) ? src.gyroY : 0,
      z: Number.isFinite(src.gyroZ) ? src.gyroZ : 0,
    });
  }, [realtimeGyro]);

  // Actualizar scan readings cuando llega nueva lectura del HC-SR04
  useEffect(() => {
    const src = realtimeDistance;
    if (!src) return;
    if (Number.isFinite(src.dist)) {
      setScanReadings(prev => ({ ...prev, fijo: src.dist }));
    }
    if (Number.isFinite(src.distMovil) && Number.isFinite(src.anguloServo)) {
      const snap = Math.round(src.anguloServo / 45) * 45;
      if ([0, 45, 90, 135, 180].includes(snap)) {
        setScanReadings(prev => ({ ...prev, [snap]: src.distMovil }));
      }
    }
  }, [realtimeDistance]);

  const latestDht   = realtimeDht  || (dht22Data.length  ? dht22Data[dht22Data.length - 1]   : null);
  const latestDist  = realtimeDistance || (hcsr04Data.length ? hcsr04Data[hcsr04Data.length - 1] : null);
  const motorData   = realtimeMotores || inferredMotores;
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

      {/* Barra de estado */}
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
            {realtimeDistance
              ? `HC-SR04 · fijo + móvil${Number.isFinite(realtimeDistance?.anguloServo) ? ` · servo ${realtimeDistance.anguloServo}°` : ''}`
              : 'HC-SR04 · sin señal'}
          </span>
        </div>
      </div>

      <div className={styles.dashboardGrid}>

        {/* ── WIDGET 1: DHT22 — Temperatura Batería ── */}
        <div className={`${styles.widget} ${styles.sensorWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>DHT22 · Batería 11.1V</span>
            <ThermometerSun size={20} className={styles.iconGreen} />
          </div>
          <TempHumBars temp={latestDht?.temp} hum={latestDht?.hum} />
        </div>

        {/* ── WIDGET 2: GY-50 — Brújula + Heading ── */}
        <div className={`${styles.widget} ${styles.sensorWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>GY-50 · Giroscopio</span>
            <Compass size={20} className={styles.iconBlue} />
          </div>
          <GyroHeadingWidget
            gyroX={gyro.x}
            gyroY={gyro.y}
            gyroZ={gyro.z}
            heading={heading}
          />
        </div>

        {/* ── WIDGET 3: HC-SR04 — 5 Ángulos de Escaneo ── */}
        <div className={`${styles.widget} ${styles.sensorWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>HC-SR04 · 5 Ángulos</span>
            <Radar size={20} className={styles.iconPurple} />
          </div>
          <ScanAnglesWidget
            scanReadings={scanReadings}
            currentAngle={latestDist?.anguloServo}
          />
        </div>

        {/* ── WIDGET 4: Servomotor ── */}
        <div className={`${styles.widget} ${styles.sensorWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Servomotor</span>
            <Settings size={20} className={styles.iconPurple} />
          </div>
          <ServoGaugeWidget
            angle={latestDist?.anguloServo}
            distMovil={latestDist?.distMovil}
          />
        </div>

        {/* ── Robot 3D — Dinámica ── */}
        <div className={`${styles.widget} ${styles.robotWidget}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Drako · Dinámica 3D</span>
            <ArrowUp size={20} style={{ color: robotStatus.color }} />
          </div>
          <RobotCar3D
            navLabel={robotStatus.label}
            gyroX={gyro.x}
            gyroZ={gyro.z}
            distCentro={latestDist?.dist}
            distIzq={scanReadings[135] ?? scanReadings[180]}
            distDer={scanReadings[45]  ?? scanReadings[0]}
          />
          <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <span style={{
              display: 'inline-block', padding: '0.3rem 1rem', borderRadius: '20px',
              border: `1px solid ${robotStatus.color}55`, background: `${robotStatus.color}18`,
              color: robotStatus.color, fontSize: '0.75rem', fontWeight: 700,
              letterSpacing: '1.5px', fontFamily: 'monospace', textTransform: 'uppercase',
            }}>
              {robotStatus.detail}
            </span>
          </div>
        </div>

        {/* ── Gráfica: Histórico de Temperatura y Humedad de la Batería ── */}
        <div className={`${styles.widget} ${styles.chartWidgetMain}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Histórico de Temperatura y Humedad de la Batería</span>
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
                <Area yAxisId="left"  type="monotone" dataKey="temp" name="Temp Batería (°C)" stroke="#78ba49" strokeWidth={2} fill="url(#colorTemp)" />
                <Line yAxisId="right" type="monotone" dataKey="hum"  name="Humedad (%)"       stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4, fill: '#070d19', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Gráfica: HC-SR04 Fijo — Histórico frontal ── */}
        <div className={`${styles.widget} ${styles.chartWidgetSmall}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>HC-SR04 Fijo · Histórico Frontal</span>
            <Radar size={20} className={styles.iconMuted} />
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hcsr04FijoChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDistFijo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} reversed />
                <Tooltip content={<CustomTooltip />} />
                <Area type="step" dataKey="dist" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorDistFijo)" name="Fijo (cm)" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Gráfica: HC-SR04 Móvil — 5 Ángulos de Escaneo ── */}
        <div className={`${styles.widget} ${styles.chartWidgetLarge}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>HC-SR04 Móvil · 5 Ángulos de Escaneo</span>
            <Radar size={20} className={styles.iconMuted} />
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hcsr04MovilChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={11} tickMargin={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} reversed />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="a0"   name="0° DER"     stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="a45"  name="45° D-DG"   stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="a90"  name="90° FRENTE" stroke="#78ba49" strokeWidth={2}   dot={false} connectNulls />
                <Line type="monotone" dataKey="a135" name="135° I-DG"  stroke="#22d3ee" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="a180" name="180° IZQ"   stroke="#8b5cf6" strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Gráfica: Estabilidad GY-50 ── */}
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
                <Line type="monotone" dataKey="gyroY" stroke="#ef4444" strokeWidth={2} dot={false} name="Roll (Y)"  />
                <Line type="monotone" dataKey="gyroZ" stroke="#3b82f6" strokeWidth={2} dot={false} name="Yaw (Z)"   />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Motores DC — Estado en Tiempo Real ── */}
        <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
          <div className={styles.widgetHeader}>
            <span className={styles.widgetTitle}>Motores DC · Estado en Tiempo Real</span>
            <Zap size={20} className={styles.iconGreen} />
          </div>
          {!realtimeMotores && (
            <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '0 0 0.6rem', fontStyle: 'italic' }}>
              Estado inferido del navegador · conectando telemetría de motores…
            </p>
          )}
          <MotoresWidget motorDer={motorData.motorDer} motorIzq={motorData.motorIzq} />
        </div>

        {/* ── Panel de Auditoría ── */}
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

      </div>
    </div>
  );
}
