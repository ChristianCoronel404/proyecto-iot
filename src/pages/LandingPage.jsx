import styles from './LandingPage.module.css';

export default function LandingPage({ onLoginClick }) {
  return (
    <div className={styles.container}>
      {/* Navbar con Glassmorphism */}
      <nav className={styles.navbar}>
        <div className={styles.logo}>Drako</div>
        <button className={styles.loginBtn} onClick={onLoginClick}>Login</button>
      </nav>

      {/* Hero Section */}
      <main className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>
            The Future of <span className={styles.highlightGreen}>Mobility</span> Is Here
          </h1>
          <p className={styles.subtitle}>
            Experience the ultimate ride with intelligent systems, eco-friendly performance, and breathtaking design. 
            Welcome to the new era of electric vehicles.
          </p>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={onLoginClick}>Explorar Sistema</button>
            <button className={styles.secondaryBtn}>Reservar Prueba</button>
          </div>
        </div>
        
        {/* Placeholder para la imagen o modelo 3D del auto */}
        <div className={styles.heroImagePlaceholder}>
          <div className={styles.carModel}>
            <span className={styles.placeholderText}>[ 3D Auto Model / Image ]</span>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className={styles.featuresSection}>
        <h2 className={styles.featuresTitle}>Tecnología de Sensores Avanzada</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🧭</div>
            <h3>Orientación Espacial (GY50)</h3>
            <p>Monitoreo en tiempo real de la inclinación y orientación del vehículo mediante acelerómetro y giroscopio de precisión.</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🌡️</div>
            <h3>Clima Interior (DHT22)</h3>
            <p>Control exacto de la temperatura y humedad en el habitáculo para maximizar el confort durante todo el viaje.</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🚨</div>
            <h3>Proximidad (HC-SR04)</h3>
            <p>Sistemas ultrasónicos para asistencia de estacionamiento y alertas tempranas contra colisiones frontales o traseras.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
