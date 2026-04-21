import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Thermometer, Droplets, AlertTriangle, Activity } from 'lucide-react'
import './DashboardHome.css'

// 3D Car Model Component
function CarModel({ gyroData }) {
  const { gyro_x = 0, gyro_y = 0, gyro_z = 0 } = gyroData || {}
  
  return (
    <group rotation={[gyro_x * 0.01, gyro_y * 0.01, gyro_z * 0.01]}>
      {/* Car body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[4, 1, 2]} />
        <meshStandardMaterial color="#0a436f" />
      </mesh>
      
      {/* Wheels */}
      <mesh position={[-1.5, -0.8, 1]}>
        <cylinderGeometry args={[0.4, 0.4, 0.3]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[1.5, -0.8, 1]}>
        <cylinderGeometry args={[0.4, 0.4, 0.3]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[-1.5, -0.8, -1]}>
        <cylinderGeometry args={[0.4, 0.4, 0.3]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[1.5, -0.8, -1]}>
        <cylinderGeometry args={[0.4, 0.4, 0.3]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0, 2, 0]}
        fontSize={0.5}
        color="#78ba49"
        anchorX="center"
        anchorY="middle"
      >
        Drako
      </Text>
    </group>
  )
}

// 3D Scene Component
function Scene({ gyroData }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <CarModel gyroData={gyroData} />
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
    </>
  )
}

// Metric Card Component
function MetricCard({ title, value, unit, icon: Icon, color, status }) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <Icon size={24} color={color} />
        <span className="metric-title">{title}</span>
      </div>
      <div className="metric-value">
        {value !== null && value !== undefined ? (
          <>
            <span className="value">{value}</span>
            <span className="unit">{unit}</span>
          </>
        ) : (
          <span className="no-data">Sin datos</span>
        )}
      </div>
      {status && (
        <div className={metric-status }>
          {status.message}
        </div>
      )}
    </div>
  )
}

const DashboardHome = () => {
  const [dht22Data, setDht22Data] = useState(null)
  const [gyroData, setGyroData] = useState(null)
  const [hcsr04Data, setHcsr04Data] = useState(null)
  const [temperatureHistory, setTemperatureHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSensorData()
    const interval = setInterval(fetchSensorData, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchSensorData = async () => {
    try {
      const [dht22Res, gyroRes, hcsr04Res, tempHistoryRes] = await Promise.all([
        fetch('/api/sensors/dht22/latest'),
        fetch('/api/sensors/gy50/latest'),
        fetch('/api/sensors/hcsr04/latest'),
        fetch('/api/sensors/dht22/history?limit=20')
      ])

      if (dht22Res.ok) {
        const dht22 = await dht22Res.json()
        setDht22Data(dht22.data)
      }

      if (gyroRes.ok) {
        const gyro = await gyroRes.json()
        setGyroData(gyro.data)
      }

      if (hcsr04Res.ok) {
        const hcsr04 = await hcsr04Res.json()
        setHcsr04Data(hcsr04.data)
      }

      if (tempHistoryRes.ok) {
        const history = await tempHistoryRes.json()
        setTemperatureHistory(history.data.map(item => ({
          time: new Date(item.created_at).toLocaleTimeString(),
          temperature: parseFloat(item.temperatura),
          humidity: parseFloat(item.humedad)
        })))
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProximityStatus = (distance) => {
    if (!distance) return null
    if (distance < 50) return { type: 'danger', message: '¡Obstáculo cercano!' }
    if (distance < 100) return { type: 'warning', message: 'Obstáculo detectado' }
    return { type: 'safe', message: 'Área despejada' }
  }

  if (loading) {
    return (
      <div className="dashboard-home">
        <div className="loading">Cargando datos del vehículo...</div>
      </div>
    )
  }

  return (
    <div className="dashboard-home">
      <div className="dashboard-header">
        <h1>Dashboard Drako</h1>
        <p>Monitoreo en tiempo real del vehículo autónomo</p>
      </div>

      <div className="dashboard-grid">
        {/* 3D Visualization */}
        <div className="visualization-card">
          <h3>Visualización 3D - Orientación Espacial</h3>
          <div className="canvas-container">
            <Canvas camera={{ position: [8, 5, 8], fov: 50 }}>
              <Scene gyroData={gyroData} />
            </Canvas>
          </div>
          {gyroData && (
            <div className="gyro-values">
              <div>X: {gyroData.gyro_x?.toFixed(2)}°</div>
              <div>Y: {gyroData.gyro_y?.toFixed(2)}°</div>
              <div>Z: {gyroData.gyro_z?.toFixed(2)}°</div>
            </div>
          )}
        </div>

        {/* Metrics Cards */}
        <div className="metrics-grid">
          <MetricCard
            title="Temperatura Interior"
            value={dht22Data?.temperatura}
            unit="°C"
            icon={Thermometer}
            color="#ff6b6b"
          />
          
          <MetricCard
            title="Humedad Interior"
            value={dht22Data?.humedad}
            unit="%"
            icon={Droplets}
            color="#4ecdc4"
          />
          
          <MetricCard
            title="Proximidad"
            value={hcsr04Data?.distancia_cm}
            unit="cm"
            icon={AlertTriangle}
            color="#ffa726"
            status={getProximityStatus(hcsr04Data?.distancia_cm)}
          />
        </div>

        {/* Activity Chart */}
        <div className="chart-card">
          <h3>
            <Activity size={20} />
            Historial de Temperatura
          </h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={temperatureHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="temperature" 
                  stroke="#78ba49" 
                  strokeWidth={2}
                  name="Temperatura (°C)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardHome
