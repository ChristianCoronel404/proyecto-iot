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

// --- DATOS SIMULADOS BASADOS EN TU ESQUEMA SQL ---

const dht22Data = [
  { time: '10:00', temp: 22.0, hum: 55 },
  { time: '10:10', temp: 22.5, hum: 56 },
  { time: '10:20', temp: 23.1, hum: 58 },
  { time: '10:30', temp: 23.5, hum: 60 },
  { time: '10:40', temp: 24.0, hum: 62 },
  { time: '10:50', temp: 24.1, hum: 61 },
  { time: '11:00', temp: 24.0, hum: 60 }
];

const gy50Data = [
  { time: '10:00', gyroX: 12, gyroY: -18, gyroZ: 5 },
  { time: '10:10', gyroX: 13, gyroY: -19, gyroZ: 5 },
  { time: '10:20', gyroX: 15, gyroY: -20, gyroZ: 4 },
  { time: '10:30', gyroX: 14, gyroY: -22, gyroZ: 2 },
  { time: '10:40', gyroX: 10, gyroY: -15, gyroZ: 0 },
  { time: '10:50', gyroX: 5, gyroY: -10, gyroZ: -2 },
  { time: '11:00', gyroX: 15, gyroY: -20, gyroZ: 0 }
];

const hcsr04Data = [
  { time: '10:00', dist: 120 },
  { time: '10:10', dist: 85 },
  { time: '10:20', dist: 60 },
  { time: '10:30', dist: 35 },
  { time: '10:40', dist: 18 },
  { time: '10:50', dist: 12 }, // Peligro colisión
  { time: '11:00', dist: 45 }
];

const auditLogs = [
  { id: 105, user: 'admin', action: 'ALERTA_FRENO', table: 'hcsr04_data', desc: 'Freno autónomo activado. Distancia < 15cm', time: '10:50:12', type: 'warning' },
  { id: 104, user: 'system', action: 'CALIBRACION', table: 'gy50_data', desc: 'Offset de giroscopio recalculado', time: '10:15:00', type: 'info' },
  { id: 103, user: 'alan_f', action: 'UPDATE', table: 'dht22_data', desc: 'Frecuencia de muestreo ajustada a 500ms', time: '09:45:22', type: 'success' },
  { id: 102, user: 'admin', action: 'LOGIN', table: 'usuarios', desc: 'Inicio de sesión exitoso desde UCB-WiFi', time: '09:00:15', type: 'success' },
];

// Custom Tooltip para gráficas
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.customTooltip}>
        <p className={styles.tooltipLabel}>{`Hora: ${label}`}</p>
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
  const [gyro, setGyro] = useState({ x: 15, y: -20, z: 0 });
  const [currentDist, setCurrentDist] = useState(45);

  // Animación libre suave base del cubo
  useEffect(() => {
    const interval = setInterval(() => {
      setGyro(prev => ({
        x: prev.x + (Math.random() > 0.5 ? 2 : -2),
        y: prev.y + (Math.random() > 0.5 ? 2 : -2),
        z: prev.z + (Math.random() > 0.5 ? 1 : -1)
      }));
      // Simular variación de distancia
      setCurrentDist(prev => prev + (Math.random() > 0.5 ? 2 : -2));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Interacción fluida con el mouse
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setGyro({ x: -y * 0.2, y: x * 0.2, z: (x + y) * 0.05 });
  };

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
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setGyro({ x: 15, y: -20, z: 0 })}
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
              <h3>24.0°C</h3>
              <p>Temperatura</p>
            </div>
            <div className={styles.divider}></div>
            <div className={styles.dataValue}>
              <Droplets size={32} color="#0ea5e9" className={styles.valueIcon} />
              <h3 style={{ color: '#0ea5e9' }}>60%</h3>
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