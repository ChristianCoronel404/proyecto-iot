import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ThermometerSun, Droplets, Compass, Radar, Settings, Activity, ArrowUp, ArrowRight, ArrowLeft, CircleSlash, AlertTriangle } from 'lucide-react-native';
import Svg, { Circle, Line, Text as SvgText, G, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LineChart, AreaChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

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

// ── Widget DHT22: barras verticales ──
export const TempHumBars = ({ temp, hum }) => {
  const tVal   = Number.isFinite(temp) ? temp : null;
  const hVal   = Number.isFinite(hum)  ? hum  : null;
  const tPct   = tVal !== null ? Math.min(100, Math.max(2, (tVal / 50) * 100)) : 0;
  const hPct   = hVal !== null ? Math.min(100, Math.max(2, hVal))              : 0;
  const tColor = tempColor(tVal);
  const hColor = humColor(hVal);

  return (
    <View style={styles.tempHumContainer}>
      <View style={styles.barGroup}>
        <Text style={[styles.barBigNum, { color: tColor }]}>
          {tVal !== null ? `${tVal.toFixed(1)}°` : '—'}
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { height: `${tPct}%`, backgroundColor: tColor }]} />
        </View>
        <View style={styles.barLabelWrap}>
          <ThermometerSun size={12} color={tColor} />
          <Text style={styles.barLabel}>TEMP</Text>
        </View>
      </View>

      <View style={styles.barsDivider}>
        <Activity size={18} color="#64748b" />
      </View>

      <View style={styles.barGroup}>
        <Text style={[styles.barBigNum, { color: hColor }]}>
          {hVal !== null ? `${Math.round(hVal)}%` : '—'}
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { height: `${hPct}%`, backgroundColor: hColor }]} />
        </View>
        <View style={styles.barLabelWrap}>
          <Droplets size={12} color={hColor} />
          <Text style={styles.barLabel}>HUM</Text>
        </View>
      </View>
    </View>
  );
};

// ── Widget GY-50: brújula con SVG ──
export const GyroHeadingWidget = ({ gyroX, gyroY, gyroZ, heading }) => {
  const h = Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : null;
  const needleRot = h !== null ? h : 0;

  return (
    <View style={styles.gyroWidget}>
      <View style={styles.gyroCompassContainer}>
        <Svg width="120" height="120" viewBox="0 0 120 120">
          <Circle cx="60" cy="60" r="55" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <Circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          
          <G rotation={needleRot} origin="60, 60">
            {h !== null && (
              <>
                <Line x1="60" y1="60" x2="60" y2="14" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                <Path d="M60,8 L56.5,18 L63.5,18 Z" fill="#ef4444" />
                <Line x1="60" y1="60" x2="60" y2="102" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </G>
          <Circle cx="60" cy="60" r="5.5" fill="#3b82f6" />
          <Circle cx="60" cy="60" r="2.5" fill="#93c5fd" />
        </Svg>
      </View>

      <View style={styles.gyroValues}>
        <View style={styles.gyroHeadingVal}>
          <Text style={styles.gyroHeadingNum}>{h !== null ? `${Math.round(h)}°` : '—'}</Text>
          <Text style={styles.gyroHeadingLbl}>HEADING</Text>
        </View>
        <View style={styles.gyroAxisRow}>
          <View style={styles.gyroAxisItem}>
            <Text style={styles.gyroAxisLbl}>Pitch</Text>
            <Text style={[styles.gyroAxisVal, { color: '#f59e0b' }]}>{Number.isFinite(gyroX) ? `${gyroX.toFixed(1)}` : '—'}</Text>
          </View>
          <View style={styles.gyroAxisItem}>
            <Text style={styles.gyroAxisLbl}>Roll</Text>
            <Text style={[styles.gyroAxisVal, { color: '#3b82f6' }]}>{Number.isFinite(gyroY) ? `${gyroY.toFixed(1)}` : '—'}</Text>
          </View>
          <View style={styles.gyroAxisItem}>
            <Text style={styles.gyroAxisLbl}>Yaw/s</Text>
            <Text style={[styles.gyroAxisVal, { color: '#8b5cf6' }]}>{Number.isFinite(gyroZ) ? `${gyroZ.toFixed(1)}` : '—'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ── Widget HC-SR04: 5 ángulos de escaneo ──
const SCAN_LABELS = { 0: 'DER', 45: 'D-45°', 90: 'FRENTE', 135: 'I-135°', 180: 'IZQ' };
const SCAN_ANGLE_COLORS = { 0: '#f97316', 45: '#f59e0b', 90: '#78ba49', 135: '#22d3ee', 180: '#8b5cf6' };

export const ScanAnglesWidget = ({ scanReadings, currentAngle }) => {
  const MAX_DIST = 200;
  const angles = [0, 45, 90, 135, 180];

  return (
    <View style={styles.scanAnglesContainer}>
      <View style={styles.scanFijoRow}>
        <Radar size={14} color="rgba(255,255,255,0.5)" />
        <Text style={styles.scanFijoLabel}> FIJO frontal</Text>
        <Text
          style={[styles.scanFijoVal, { color: Number.isFinite(scanReadings.fijo) && scanReadings.fijo < 25 ? '#ef4444' : '#8b5cf6' }]}
        >
          {Number.isFinite(scanReadings.fijo) ? `${Math.round(scanReadings.fijo)} cm` : '— cm'}
        </Text>
      </View>

      <View style={styles.scanBarsGroup}>
        {angles.map(angle => {
          const dist = scanReadings[angle];
          const isActive = Number.isFinite(currentAngle) ? Math.round(currentAngle / 45) * 45 === angle : false;
          const hasVal = dist !== null && Number.isFinite(dist);
          const pct = hasVal ? Math.max(4, Math.min(100, (dist / MAX_DIST) * 100)) : 0;
          const base = SCAN_ANGLE_COLORS[angle];
          const color = !hasVal ? '#64748b' : dist < 25 ? '#ef4444' : dist < 60 ? '#f59e0b' : base;

          return (
            <View key={angle} style={[styles.scanBarRow, isActive && styles.scanBarActive]}>
              <Text style={[styles.scanAngleLabel, { color }]}>{SCAN_LABELS[angle]}</Text>
              <View style={styles.scanBarTrackNative}>
                <View style={[styles.scanBarFillNative, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
              <Text style={[styles.scanBarDist, { color }]}>
                {hasVal ? Math.round(dist) : '—'} <Text style={styles.scanBarUnit}>cm</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ── Gauge del Servomotor ──
export const ServoGaugeWidget = ({ angle, distMovil }) => {
  const a = Number.isFinite(angle) ? Math.max(0, Math.min(180, angle)) : null;

  const toXY = (deg) => ({
    x: (100 + 80 * Math.cos((deg * Math.PI) / 180)),
    y: (100 - 80 * Math.sin((deg * Math.PI) / 180)),
  });

  const endPt = a !== null && a > 0.5 ? toXY(a) : null;
  const arcColor = a === null ? '#64748b'
    : Math.abs(a - 90) < 30 ? '#8b5cf6'
    : Math.abs(a - 90) < 60 ? '#f59e0b'
    : '#f97316';
  const needleRot = a !== null ? -a : -90;

  return (
    <View style={styles.servoWidgetContent}>
      <Svg width="200" height="110" viewBox="0 0 200 110">
        <Path d="M 20,100 A 80,80 0 0 1 180,100" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round" />
        {endPt && (
          <Path d={`M 180,100 A 80,80 0 0 0 ${endPt.x},${endPt.y}`} fill="none" stroke={arcColor} strokeWidth="10" strokeLinecap="round" />
        )}
        <G rotation={needleRot} origin="100, 100">
          <Line x1="100" y1="100" x2="176" y2="100" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" />
          <Circle cx="176" cy="100" r="3.5" fill="#c4b5fd" />
        </G>
        <Circle cx="100" cy="100" r="7" fill="#8b5cf6" />
        <Circle cx="100" cy="100" r="3.5" fill="#c4b5fd" />
      </Svg>

      <View style={styles.servoStats}>
        <View style={styles.servoStatItem}>
          <Text style={styles.servoStatLabel}>ÁNGULO</Text>
          <Text style={[styles.servoStatValue, { color: arcColor }]}>{a !== null ? `${a}°` : '—'}</Text>
        </View>
        <View style={styles.servoStatItem}>
          <Text style={styles.servoStatLabel}>DIST. MÓVIL</Text>
          <Text style={[styles.servoStatValue, { color: '#78ba49' }]}>{Number.isFinite(distMovil) ? `${distMovil} cm` : '—'}</Text>
        </View>
      </View>
    </View>
  );
};

// ── Widget Motores DC ──
const DIR_COLOR = { adelante: '#78ba49', atras: '#f59e0b', stop: '#64748b' };
const DIR_LABEL = { adelante: 'ADELANTE', atras: 'ATRÁS', stop: 'DETENIDO' };

const MotorCard = ({ label, motor }) => {
  const m = motor || { velocidad: 0, direccion: 'stop' };
  const pct = Math.min(100, Math.max(0, (m.velocidad / 65535) * 100));
  const color = DIR_COLOR[m.direccion] || '#64748b';
  return (
    <View style={styles.motorCard}>
      <View style={styles.motorCardHeader}>
        <Text style={styles.motorLabel}>{label}</Text>
        <Text style={[styles.motorArrow, { color }]}>{m.direccion === 'adelante' ? '↑' : m.direccion === 'atras' ? '↓' : '◼'}</Text>
      </View>
      <View style={styles.motorSpeedTrack}>
        <View style={[styles.motorSpeedFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.motorCardFooter}>
        <Text style={{ color, fontWeight: '700', fontSize: 10 }}>{DIR_LABEL[m.direccion] || 'DESCONOCIDO'}</Text>
        <Text style={{ color: '#64748b', fontSize: 10 }}>{Math.round(pct)}% PWM</Text>
      </View>
    </View>
  );
};

export const MotoresWidget = ({ motorDer, motorIzq }) => (
  <View style={styles.motoresWidget}>
    <MotorCard label="Motor A · Derecho" motor={motorDer} />
    <View style={styles.motorDivider} />
    <MotorCard label="Motor B · Izquierdo" motor={motorIzq} />
  </View>
);

const styles = StyleSheet.create({
  tempHumContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 160 },
  barGroup: { alignItems: 'center', flex: 1 },
  barBigNum: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  barTrack: { width: 16, height: 80, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 8 },
  barsDivider: { marginHorizontal: 10 },
  barLabelWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  barLabel: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  gyroWidget: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  gyroCompassContainer: { width: 120, height: 120 },
  gyroValues: { flex: 1, marginLeft: 20 },
  gyroHeadingVal: { marginBottom: 10, alignItems: 'center' },
  gyroHeadingNum: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  gyroHeadingLbl: { fontSize: 10, color: '#64748b', fontWeight: 'bold' },
  gyroAxisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  gyroAxisItem: { alignItems: 'center' },
  gyroAxisLbl: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  gyroAxisVal: { fontSize: 12, fontWeight: 'bold' },
  scanAnglesContainer: { padding: 10 },
  scanFijoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  scanFijoLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1 },
  scanFijoVal: { fontSize: 14, fontWeight: 'bold' },
  scanBarsGroup: { gap: 8 },
  scanBarRow: { flexDirection: 'row', alignItems: 'center' },
  scanBarActive: { opacity: 1 },
  scanAngleLabel: { width: 55, fontSize: 10, fontWeight: 'bold' },
  scanBarTrackNative: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, marginHorizontal: 10, overflow: 'hidden' },
  scanBarFillNative: { height: '100%', borderRadius: 3 },
  scanBarDist: { width: 45, fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  scanBarUnit: { fontSize: 9, opacity: 0.7 },
  servoWidgetContent: { alignItems: 'center', paddingVertical: 10 },
  servoStats: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10 },
  servoStatItem: { alignItems: 'center' },
  servoStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  servoStatValue: { fontSize: 16, fontWeight: 'bold' },
  motoresWidget: { flexDirection: 'row', gap: 15 },
  motorCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 },
  motorCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  motorLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  motorArrow: { fontSize: 14, fontWeight: 'bold' },
  motorSpeedTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  motorSpeedFill: { height: '100%', borderRadius: 2 },
  motorCardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  motorDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }
});
