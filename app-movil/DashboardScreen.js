import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThermometerSun, Compass, Radar, Settings, AlertTriangle, ArrowUp, ArrowLeft, ArrowRight, CircleSlash, Radio, Activity } from 'lucide-react-native';
import { TempHumBars, GyroHeadingWidget, ScanAnglesWidget, ServoGaugeWidget, MotoresWidget } from './components/Widgets';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

// ── Helpers ──
const formatDateTimeLabels = (point) => {
  if (!point || typeof point !== 'object') return point;
  let timeLabel = '--:--';
  if (point.created_at) {
    const d = new Date(point.created_at);
    if (!Number.isNaN(d.getTime())) timeLabel = d.toLocaleTimeString('es-BO', { hour12: false, hour: '2-digit', minute: '2-digit' });
  } else if (point.hora) {
    timeLabel = point.hora.substring(0, 5);
  }
  return { ...point, timeLabel };
};

export default function DashboardScreen({ user }) {
  const [dht22Data, setDht22Data] = useState([]);
  const [gy50Data, setGy50Data] = useState([]);
  const [hcsr04Data, setHcsr04Data] = useState([]);
  const [realtimeDht, setRealtimeDht] = useState(null);
  const [realtimeGyro, setRealtimeGyro] = useState(null);
  const [realtimeDistance, setRealtimeDistance] = useState(null);
  const [realtimeMotores, setRealtimeMotores] = useState(null);
  const [gyro, setGyro] = useState({ x: 0, y: 0, z: 0 });
  const [heading, setHeading] = useState(0);
  const [scanReadings, setScanReadings] = useState({ 0: null, 45: null, 90: null, 135: null, 180: null, fijo: null });

  const lastGyroTimeRef = useRef(null);
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:4000';

  // ── Lógica de Estado Robot ──
  const robotStatus = useMemo(() => {
    const dist = realtimeDistance?.dist;
    if (dist === null || dist === undefined) {
      return { label: 'SIN SEÑAL', detail: 'Esperando datos...', color: '#64748b', Icon: CircleSlash };
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

  const inferredMotores = useMemo(() => {
    const SPEED = 22000, TURN = 45000;
    const label = robotStatus.label;
    if (label === 'CAMINO LIBRE') return { motorDer: { velocidad: SPEED, direccion: 'adelante' }, motorIzq: { velocidad: SPEED, direccion: 'adelante' } };
    if (label === 'OBSTÁCULO FRONTAL') return { motorDer: { velocidad: 0, direccion: 'stop' }, motorIzq: { velocidad: 0, direccion: 'stop' } };
    if (label === 'PARED IZQUIERDA') return { motorDer: { velocidad: TURN, direccion: 'adelante' }, motorIzq: { velocidad: TURN, direccion: 'atras' } };
    if (label === 'PARED DERECHA') return { motorDer: { velocidad: TURN, direccion: 'atras' }, motorIzq: { velocidad: TURN, direccion: 'adelante' } };
    return { motorDer: { velocidad: 0, direccion: 'stop' }, motorIzq: { velocidad: 0, direccion: 'stop' } };
  }, [robotStatus]);

  // Transform Data for Charts
  const hcsr04MovilChartData = useMemo(() => {
    const timeMap = {};
    for (const p of hcsr04Data) {
      const key = p.timeLabel || '--';
      if (!timeMap[key]) timeMap[key] = { timeLabel: key };
      if (p.anguloServo !== null && p.anguloServo !== undefined && Number.isFinite(p.distMovil)) {
        const snap = Math.round(Number(p.anguloServo) / 45) * 45;
        if ([0, 45, 90, 135, 180].includes(snap)) {
          timeMap[key][`a${snap}`] = Number(Number(p.distMovil).toFixed(1));
        }
      }
    }
    return Object.values(timeMap).slice(-10);
  }, [hcsr04Data]);

  const hcsr04FijoChartData = useMemo(() => {
    return hcsr04Data.filter(d => Number.isFinite(d.dist)).slice(-10);
  }, [hcsr04Data]);

  const gy50ChartData = useMemo(() => {
    return gy50Data.slice(-10);
  }, [gy50Data]);

  // ── Network ──
  const applyDashboardData = (payload) => {
    setDht22Data( Array.isArray(payload?.dht22) ? payload.dht22.map(formatDateTimeLabels) : []);
    setGy50Data( Array.isArray(payload?.gy50) ? payload.gy50.map(formatDateTimeLabels) : []);
    setHcsr04Data( Array.isArray(payload?.hcsr04) ? payload.hcsr04.map(formatDateTimeLabels) : []);
  };

  const appendRealtimePoint = (setter, point) => {
    if (!point || typeof point !== 'object') return;
    const normalized = formatDateTimeLabels(point);
    setter((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return [...list, normalized].slice(-50); // limit to 50 for mobile memory
    });
  };

  useEffect(() => {
    let isMounted = true;
    let events = null;
    let reconnectTimer = null;

    const loadRealtimeState = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/realtime-state`);
        const data = await res.json();
        if (res.ok && isMounted) {
          setRealtimeDht(data?.dht22 || null);
          setRealtimeGyro(data?.gy50 || null);
          setRealtimeDistance(data?.hcsr04 || null);
          if (data?.motores) setRealtimeMotores(data.motores);
        }
      } catch (e) { console.log('HTTP fetch error:', e.message); }
    };

    const loadDashboardData = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/dashboard-data`);
        const data = await res.json();
        if (res.ok && isMounted) applyDashboardData(data);
      } catch (e) { console.log('HTTP fetch error:', e.message); }
    };

    const connectWs = () => {
      if (!isMounted) return;
      // Reemplazar http:// o https:// por ws:// o wss://
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws-dashboard';
      events = new WebSocket(wsUrl);

      events.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'dashboard-update' && parsed.data) { applyDashboardData(parsed.data); }
          if (parsed.type === 'sensor-realtime' && parsed.data) {
            const { dht22, gy50, hcsr04, motores } = parsed.data;
            setRealtimeDht(dht22 || null);
            setRealtimeGyro(gy50 || null);
            setRealtimeDistance(hcsr04 || null);
            if (motores) setRealtimeMotores(motores);
            appendRealtimePoint(setDht22Data, dht22);
            appendRealtimePoint(setGy50Data, gy50);
            appendRealtimePoint(setHcsr04Data, hcsr04);
          }
          if (parsed.type === 'connected' && parsed.realtime) {
            setRealtimeDht(parsed.realtime.dht22 || null);
            setRealtimeGyro(parsed.realtime.gy50 || null);
            setRealtimeDistance(parsed.realtime.hcsr04 || null);
            if (parsed.realtime.motores) setRealtimeMotores(parsed.realtime.motores);
          }
        } catch (e) {}
      };

      events.onclose = () => {
        events = null;
        if (!isMounted) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectWs, 2000);
      };
      events.onerror = (e) => {
        events?.close();
      };
    };

    loadRealtimeState();
    loadDashboardData();
    connectWs();
    
    // HTTP Fallback if WS fails
    const realtimePoll = setInterval(loadRealtimeState, 3000);

    return () => {
      isMounted = false;
      events?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(realtimePoll);
    };
  }, []);

  // Update Gyro Heading
  useEffect(() => {
    const src = realtimeGyro;
    if (!src) return;
    const now = Date.now();
    if (lastGyroTimeRef.current) {
      const dt = (now - lastGyroTimeRef.current) / 1000;
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

  // Update Scan Readings
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

  const latestDht = realtimeDht || (dht22Data.length ? dht22Data[dht22Data.length - 1] : null);
  const latestDist = realtimeDistance || (hcsr04Data.length ? hcsr04Data[hcsr04Data.length - 1] : null);
  const motorData = realtimeMotores || inferredMotores;
  const { Icon: StatusIcon } = robotStatus;

  // Chart data prep (last 10 points)
  const chartDataDht = {
    labels: dht22Data.slice(-10).map(d => d.timeLabel || ''),
    datasets: [
      { data: dht22Data.slice(-10).map(d => d.temp || 0), color: () => '#78ba49' },
      { data: dht22Data.slice(-10).map(d => d.hum || 0), color: () => '#0ea5e9' }
    ],
    legend: ["Temp (°C)", "Hum (%)"]
  };
  const hasDhtChartData = dht22Data.length > 0;

  const chartDataFijo = {
    labels: hcsr04FijoChartData.map(d => d.timeLabel || ''),
    datasets: [{ data: hcsr04FijoChartData.map(d => d.dist || 0), color: () => '#8b5cf6' }],
    legend: ["Fijo (cm)"]
  };
  const hasFijoChartData = hcsr04FijoChartData.length > 0;

  const chartDataMovil = {
    labels: hcsr04MovilChartData.map(d => d.timeLabel || ''),
    datasets: [
      { data: hcsr04MovilChartData.map(d => d.a0 || 0), color: () => '#f97316' },
      { data: hcsr04MovilChartData.map(d => d.a45 || 0), color: () => '#f59e0b' },
      { data: hcsr04MovilChartData.map(d => d.a90 || 0), color: () => '#78ba49' },
      { data: hcsr04MovilChartData.map(d => d.a135 || 0), color: () => '#22d3ee' },
      { data: hcsr04MovilChartData.map(d => d.a180 || 0), color: () => '#8b5cf6' }
    ],
    legend: ["0°", "45°", "90°", "135°", "180°"]
  };
  const hasMovilChartData = hcsr04MovilChartData.length > 0;

  const chartDataGyro = {
    labels: gy50ChartData.map(d => d.timeLabel || ''),
    datasets: [
      { data: gy50ChartData.map(d => d.gyroX || 0), color: () => '#f59e0b' },
      { data: gy50ChartData.map(d => d.gyroY || 0), color: () => '#ef4444' },
      { data: gy50ChartData.map(d => d.gyroZ || 0), color: () => '#3b82f6' }
    ],
    legend: ["Pitch", "Roll", "Yaw"]
  };
  const hasGyroChartData = gy50ChartData.length > 0;

  const renderChart = (title, iconColor, hasData, chartData) => (
    <View style={styles.widgetCard}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetTitle}>{title}</Text>
        <Radar size={18} color={iconColor} />
      </View>
      {hasData ? (
        <LineChart
          data={chartData}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: '#000',
            backgroundGradientFromOpacity: 0,
            backgroundGradientTo: '#000',
            backgroundGradientToOpacity: 0,
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "3", strokeWidth: "2", stroke: "#070d19" }
          }}
          bezier
          style={{ marginVertical: 8, borderRadius: 16, marginLeft: -15 }}
          withInnerLines={false}
          withOuterLines={false}
        />
      ) : (
        <View style={{ height: 100, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#78ba49" />
          <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 10 }}>Cargando datos...</Text>
        </View>
      )}
    </View>
  );

  return (
    <LinearGradient colors={['#050b14', '#0f2010', '#050b14']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Drako Control Center</Text>
            <Text style={styles.subtitle}>Monitoreo de Telemetría IoT</Text>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>EN LÍNEA</Text>
          </View>
        </View>

        {/* Status Bar */}
        <View style={[styles.statusBar, { borderColor: robotStatus.color }]}>
          <StatusIcon size={24} color={robotStatus.color} />
          <View style={styles.statusTextGroup}>
            <Text style={[styles.statusLabel, { color: robotStatus.color }]}>{robotStatus.label}</Text>
            <Text style={styles.statusDetail}>{robotStatus.detail}</Text>
          </View>
          <View style={styles.statusSensor}>
            <Radio size={14} color={realtimeDistance ? '#8b5cf6' : '#64748b'} />
            <Text style={[styles.statusSensorText, { color: realtimeDistance ? '#8b5cf6' : '#64748b' }]}>
              {realtimeDistance ? `HC-SR04` : 'Sin señal'}
            </Text>
          </View>
        </View>

        {/* Widgets Grid */}
        <View style={styles.widgetCard}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetTitle}>DHT22 · Batería 11.1V</Text>
            <ThermometerSun size={18} color="#78ba49" />
          </View>
          <TempHumBars temp={latestDht?.temp} hum={latestDht?.hum} />
        </View>

        <View style={styles.widgetCard}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetTitle}>GY-50 · Giroscopio</Text>
            <Compass size={18} color="#3b82f6" />
          </View>
          <GyroHeadingWidget gyroX={gyro.x} gyroY={gyro.y} gyroZ={gyro.z} heading={heading} />
        </View>

        <View style={styles.widgetCard}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetTitle}>HC-SR04 · 5 Ángulos</Text>
            <Radar size={18} color="#8b5cf6" />
          </View>
          <ScanAnglesWidget scanReadings={scanReadings} currentAngle={latestDist?.anguloServo} />
        </View>

        <View style={styles.widgetCard}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetTitle}>Servomotor</Text>
            <Settings size={18} color="#8b5cf6" />
          </View>
          <ServoGaugeWidget angle={latestDist?.anguloServo} distMovil={latestDist?.distMovil} />
        </View>

        <View style={styles.widgetCard}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetTitle}>Motores DC</Text>
            <Activity size={18} color="#f59e0b" />
          </View>
          <MotoresWidget motorDer={motorData.motorDer} motorIzq={motorData.motorIzq} />
        </View>

        {/* Charts */}
        {renderChart('Histórico Temp/Hum', 'rgba(255,255,255,0.3)', hasDhtChartData, chartDataDht)}
        {renderChart('HC-SR04 Fijo · Histórico Frontal', 'rgba(255,255,255,0.3)', hasFijoChartData, chartDataFijo)}
        {renderChart('HC-SR04 Móvil · 5 Ángulos', 'rgba(255,255,255,0.3)', hasMovilChartData, chartDataMovil)}
        {renderChart('Estabilidad Inercial (GY-50)', 'rgba(255,255,255,0.3)', hasGyroChartData, chartDataGyro)}

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 10, paddingTop: 40, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 22, fontWeight: '900', color: '#78ba49', letterSpacing: 1 },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(120, 186, 73, 0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(120, 186, 73, 0.3)' },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#78ba49', marginRight: 6 },
  onlineText: { fontSize: 10, color: '#78ba49', fontWeight: 'bold' },
  statusBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.6)', padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
  statusTextGroup: { flex: 1, marginLeft: 15 },
  statusLabel: { fontSize: 14, fontWeight: '900' },
  statusDetail: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, textTransform: 'uppercase', fontFamily: 'monospace' },
  statusSensor: { alignItems: 'flex-end' },
  statusSensorText: { fontSize: 9, marginTop: 4, fontWeight: 'bold' },
  widgetCard: { backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 10, marginBottom: 10 },
  widgetTitle: { fontSize: 13, fontWeight: 'bold', color: 'rgba(255,255,255,0.8)' }
});
