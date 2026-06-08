import styles from './RobotCar3D.module.css';

const STATE_MAP = {
  'CAMINO LIBRE':       'stateAvanzando',
  'OBSTÁCULO FRONTAL':  'stateObstaculo',
  'PARED IZQUIERDA':    'stateCorriendo',
  'PARED DERECHA':      'stateCorriendo',
  'SIN SEÑAL':          'stateSinSenal',
};

const GLOW_COLOR = {
  'CAMINO LIBRE':      '#78ba49',
  'OBSTÁCULO FRONTAL': '#ef4444',
  'PARED IZQUIERDA':   '#f59e0b',
  'PARED DERECHA':     '#f59e0b',
  'SIN SEÑAL':         '#64748b',
};

const WHEEL_ANGLE = {
  'CAMINO LIBRE':      0,
  'OBSTÁCULO FRONTAL': 0,
  'PARED IZQUIERDA':   35,   // gira a la derecha para corregir
  'PARED DERECHA':    -35,   // gira a la izquierda para corregir
  'SIN SEÑAL':         0,
};

/**
 * RobotCar3D
 *
 * Props:
 *   navLabel  – string del robotStatus.label
 *   gyroX     – pitch en grados (GY-50)
 *   gyroZ     – roll  en grados (GY-50)
 *   distCentro, distIzq, distDer – cm (pueden ser null)
 */
export default function RobotCar3D({
  navLabel   = 'SIN SEÑAL',
  gyroX      = 0,
  gyroZ      = 0,
  distCentro = null,
  distIzq    = null,
  distDer    = null,
}) {
  const stateClass  = STATE_MAP[navLabel]  || 'stateSinSenal';
  const glowColor   = GLOW_COLOR[navLabel] || '#64748b';
  const wheelAngle  = WHEEL_ANGLE[navLabel] ?? 0;
  const isObstaculo = navLabel === 'OBSTÁCULO FRONTAL';

  // Vista isométrica base + suavizado del gyro para no exagerar el tilt
  const pitchOffset = Math.max(-15, Math.min(15, gyroX * 0.4));
  const rollOffset  = Math.max(-15, Math.min(15, gyroZ * 0.4));

  const carTransform = `
    rotateX(${22 + pitchOffset}deg)
    rotateY(${-28 + rollOffset}deg)
  `;

  // Alarma de sensor central (< 20 cm)
  const centrAlarm = Number.isFinite(distCentro) && distCentro > 0 && distCentro < 20;
  const izqAlarm   = Number.isFinite(distIzq)    && distIzq    > 0 && distIzq    < 15;
  const derAlarm   = Number.isFinite(distDer)     && distDer    > 0 && distDer    < 15;

  // Color de los faros según estado
  const headlightColor = isObstaculo ? '#ef4444' : stateClass === 'stateAvanzando' ? '#ffffcc' : '#aaa';
  const headlightGlow  = isObstaculo ? '0 0 10px 3px rgba(239,68,68,0.9)' : '0 0 8px 2px rgba(255,255,200,0.8)';

  return (
    <div className={styles.scene}>
      <div className={styles.car} style={{ transform: carTransform }}>

        {/* ── Ruedas traseras (detrás del chasis en z) ── */}
        <WheelBox
          style={{ position: 'absolute', left: '155px', top: '52px', transform: 'rotateY(0deg) translateZ(-22px)' }}
          color={glowColor}
        />
        <WheelBox
          style={{ position: 'absolute', left: '155px', top: '100px', transform: 'rotateY(0deg) translateZ(-22px)' }}
          color={glowColor}
        />

        {/* ── Chasis principal ── */}
        <div className={styles.chassis}>
          {/* Cara superior */}
          <div className={`${styles.face} ${styles.faceTop} ${styles[stateClass]}`}>
            <span className={styles.chassisLabel}>DRAKO</span>
          </div>

          {/* Cara trasera */}
          <div className={`${styles.face} ${styles.faceBack}`}
            style={{ background: 'rgba(10,20,40,0.8)' }}
          />

          {/* Cara lateral derecha */}
          <div className={`${styles.face} ${styles.faceRight}`}
            style={{ background: 'rgba(15,25,50,0.7)' }}
          />

          {/* Cara lateral izquierda */}
          <div className={`${styles.face} ${styles.faceLeft}`}
            style={{ background: 'rgba(15,25,50,0.7)' }}
          />

          {/* Cara frontal – muestra faros y estado */}
          <div className={`${styles.face} ${styles.faceFront} ${styles[stateClass]}`}>
            <div
              className={styles.headlight}
              style={{ background: headlightColor, boxShadow: headlightGlow }}
            />
            <div
              className={styles.headlight}
              style={{ background: headlightColor, boxShadow: headlightGlow }}
            />
          </div>
        </div>

        {/* ── Barra de sensores ultrasónicos (frente del chasis) ── */}
        <div className={styles.sensorBar}>
          <div className={`${styles.sensorDot} ${izqAlarm ? styles.alarm : ''}`} title="Sensor IZQ" />
          <div className={`${styles.sensorDot} ${centrAlarm ? styles.alarm : ''}`} title="Sensor CENTRO" />
          <div className={`${styles.sensorDot} ${derAlarm ? styles.alarm : ''}`} title="Sensor DER" />
        </div>

        {/* ── Ruedas delanteras (con ángulo de giro) ── */}
        <WheelBox
          style={{
            position: 'absolute', left: '50px', top: '52px',
            transform: `rotateY(0deg) translateZ(-22px) rotateZ(${wheelAngle}deg)`,
          }}
          color={glowColor}
        />
        <WheelBox
          style={{
            position: 'absolute', left: '50px', top: '100px',
            transform: `rotateY(0deg) translateZ(-22px) rotateZ(${wheelAngle}deg)`,
          }}
          color={glowColor}
        />
      </div>

      {/* ── Sombra / glow en el piso ── */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120px',
        height: '18px',
        borderRadius: '50%',
        background: `radial-gradient(ellipse, ${glowColor}44 0%, transparent 70%)`,
        filter: 'blur(4px)',
        transition: 'background 0.4s ease',
      }} />
    </div>
  );
}

/* Sub-componente de rueda (caja con borde redondeado) */
function WheelBox({ style, color }) {
  return (
    <div style={{
      width: '14px',
      height: '32px',
      background: '#111827',
      border: `1.5px solid ${color}55`,
      borderRadius: '4px',
      boxShadow: `0 0 6px ${color}44`,
      transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
      ...style,
    }} />
  );
}
