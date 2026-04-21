import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts';
import Cube3D from '../components/Cube3D';
import styles from './Dashboard.module.css';

// Datos estáticos simulando la BD
const dht22Data = [
  { time: '10:00', temp: 22, hum: 55 },
  { time: '10:10', temp: 22.5, hum: 56 },
  { time: '10:20', temp: 23, hum: 58 },
  { time: '10:30', temp: 23.5, hum: 60 },
  { time: '10:40', temp: 24, hum: 62 },
  { time: '10:50', temp: 24.1, hum: 61 },
  { time: '11:00', temp: 24, hum: 60 }
];

const gy50Data = [
  { time: '10:00', gyroX: 12, gyroY: -18, gyroZ: 5 },
  { time: '10:10', gyroX: 13, gyroY: -19, gyroZ: 5 },
  { time: '10:20', gyroX: 15, gyroY: -20, gyroZ: 4 },
  { time: '10:30', gyroX: 14, gyroY: -22, gyroZ: 2 },
  { time: '10:40', gyroX: 10, gyroY: -15, gyroZ: 0 },
  { time: '10:50', gyroX: 5,  gyroY: -10, gyroZ: -2 },
  { time: '11:00', gyroX: 15, gyroY: -20, gyroZ: 0 }
];

const hcsr04Data = [
  { time: '10:00', dist: 40 },
  { time: '10:10', dist: 35 },
  { time: '10:20', dist: 25 },
  { time: '10:30', dist: 15 },
  { time: '10:40', dist: 12 },
  { time: '10:50', dist: 10 },
  { time: '11:00', dist: 15 }
];

export default function Dashboard() {
  const [gyro, setGyro] = useState({ x: 15, y: -20, z: 0 });

  // Animación libre suave base
  useEffect(() => {
    const interval = setInterval(() => {
      setGyro(prev => ({
        x: prev.x + (Math.random() > 0.5 ? 2 : -2),
        y: prev.y + (Math.random() > 0.5 ? 2 : -2),
        z: prev.z + (Math.random() > 0.5 ? 1 : -1)
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Interacción fluida con el mouse
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setGyro({ x: -y * 0.2, y: x * 0.2, z: (x+y)*0.05 });
  };

  return (
    <div className={styles.dashboardGrid}>
      {/* Widget 3D */}
      <div 
        className={`${styles.widget} ${styles.cubeWidget}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setGyro({ x: 15, y: -20, z: 0 })}
        style={{ cursor: 'crosshair', transition: 'box-shadow 0.3s' }}
      >
        <div className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Orientación (GY50)</span>
          <span className={styles.widgetIcon}>🧭</span>
        </div>
        <Cube3D gyroX={gyro.x} gyroY={gyro.y} gyroZ={gyro.z} />
        <div className={styles.cubeControls}>
          <span>Pitch: <strong>{gyro.x.toFixed(1)}°</strong></span>
          <span>Yaw: <strong>{gyro.y.toFixed(1)}°</strong></span>
          <span>Roll: <strong>{gyro.z.toFixed(1)}°</strong></span>
        </div>
      </div>

      {/* Widget de Clima */}
      <div className={`${styles.widget} ${styles.weatherWidget}`}>
        <div className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Clima Interior (DHT22)</span>
          <span className={styles.widgetIcon}>🌡️</span>
        </div>
        <div className={styles.weatherData}>
          <div className={styles.dataValue}>
            <h3>24°C</h3>
            <p>Temperatura</p>
          </div>
          <div className={styles.dataValue}>
            <h3 style={{ color: '#0ea5e9' }}>60%</h3>
            <p>Humedad Relativa</p>
          </div>
        </div>
      </div>

      {/* Widget de Proximidad */}
      <div className={`${styles.widget} ${styles.proximityWidget}`}>
        <div className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Radar Trasero (HC-SR04)</span>
          <span className={styles.widgetIcon}>🚨</span>
        </div>
        <div className={styles.radar}>
          <span className={styles.radarValue}>15cm</span>
        </div>
      </div>

      {/* Gráfico 1: Temperatura (DHT22) */}
      <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
        <div className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Histórico Temperatura (°C)</span>
          <span className={styles.widgetIcon}>📈</span>
        </div>
        <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dht22Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#78ba49" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#78ba49" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: 'white' }} />
              <Area type="monotone" dataKey="temp" stroke="#78ba49" fillOpacity={1} fill="url(#colorTemp)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Humedad (DHT22) */}
      <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
        <div className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Histórico Humedad (%)</span>
          <span className={styles.widgetIcon}>💧</span>
        </div>
        <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dht22Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: 'white' }} />
              <Area type="monotone" dataKey="hum" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorHum)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 3: Orientación X, Y (GY50) */}
      <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
        <div className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Tracking Giroscopio (X, Y)</span>
          <span className={styles.widgetIcon}>🔄</span>
        </div>
        <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gy50Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: 'white' }} />
              <Line type="step" dataKey="gyroX" stroke="#f59e0b" strokeWidth={2} dot={false} name="Eje X" />
              <Line type="step" dataKey="gyroY" stroke="#ef4444" strokeWidth={2} dot={false} name="Eje Y" />
              <Line type="step" dataKey="gyroZ" stroke="#3b82f6" strokeWidth={2} dot={false} name="Eje Z" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 4: Distancia HC-SR04 */}
      <div className={`${styles.widget} ${styles.chartWidgetHalf}`}>
        <div className={styles.widgetHeader}>
          <span className={styles.widgetTitle}>Histórico Proximidad (cm)</span>
          <span className={styles.widgetIcon}>📏</span>
        </div>
        <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hcsr04Data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: 'white' }}
                cursor={{fill: 'rgba(255,255,255,0.05)'}}
              />
              <Bar dataKey="dist" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Distancia" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
