import styles from './Cube3D.module.css';

export default function Cube3D({ gyroX = 0, gyroY = 0, gyroZ = 0 }) {
  // Aplicamos la rotación en base a los valores del giroscopio (en grados)
  const transformStyle = {
    transform: `rotateX(${gyroX}deg) rotateY(${gyroY}deg) rotateZ(${gyroZ}deg)`
  };

  return (
    <div className={styles.scene}>
      <div className={styles.cube} style={transformStyle}>
        <div className={`${styles.face} ${styles.front}`}><span className={styles.label}>FRENTE</span></div>
        <div className={`${styles.face} ${styles.back}`}><span className={styles.label}>ATRÁS</span></div>
        <div className={`${styles.face} ${styles.right}`}><span className={styles.label}>DER</span></div>
        <div className={`${styles.face} ${styles.left}`}><span className={styles.label}>IZQ</span></div>
        <div className={`${styles.face} ${styles.top}`}><span className={styles.label}>ARRIBA</span></div>
        <div className={`${styles.face} ${styles.bottom}`}><span className={styles.label}>ABAJO</span></div>
      </div>
    </div>
  );
}
