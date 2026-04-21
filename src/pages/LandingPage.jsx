import { MapPin, Thermometer, ShieldAlert, GraduationCap, Cpu, Activity, ChevronRight } from 'lucide-react';
import ParticleTextEffect from '../components/ParticleTextEffect';
import CircularTestimonials from '../components/CircularTestimonials';
import styles from './LandingPage.module.css';

const sensorFeatures = [
  {
    name: "Radar HC-SR04",
    designation: "Prevención de Colisiones (Tiempo Real)",
    quote: "A diferencia del ojo humano, los sensores ultrasónicos de Drako mapean los pasillos de la facultad emitiendo pulsos de sonido en milisegundos. Durante la alta congestión del OpenHouse, el robot detecta visitantes y frena autónomamente para evitar absolutamente cualquier tipo de impacto frontal.",
    src: "https://static.wixstatic.com/media/e250cb_44754a27340a4dc1bf4e6683187b302c~mv2.jpg/v1/fill/w_420,h_420,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/e250cb_44754a27340a4dc1bf4e6683187b302c~mv2.jpg"
  },
  {
    name: "Módulo DHT22",
    designation: "Inteligencia Ambiental de Laboratorios",
    quote: "El confort de los futuros ingenieros es prioridad. Este sensor escanea constantemente las variaciones climáticas interiores. Permite a Drako procesar datos ambientales en vivo y descubrir cuáles laboratorios de Sistemas ofrecen las condiciones térmicas ideales para estudiar sin distracciones.",
    src: "https://www.bastelgarage.ch/image/cache/catalog/Artikel/420101-420110/420102-9283-1000x1000.jpg"
  },
  {
    name: "Giroscopio GY-50",
    designation: "Navegación Inercial Optimizada",
    quote: "Sin equilibrio espacial dinámico, el hardware falla. El chip GY-50 le entrega a Drako un plano 3D riguroso midiendo ejes de Pitch, Yaw y Roll. Esto garantiza una corrección motriz inmediata al subir las rampas de la Universidad Católica Boliviana, haciendo su traslado suave e impecable.",
    src: "https://yorobotics.co/wp-content/uploads/2021/04/358031df5338e0a5ecc8831438d88c65.jpg"
  }
];

export default function LandingPage({ onLoginClick }) {
  return (
    <div className={styles.container}>
      {/* Navbar Superior */}
      <nav className={styles.navbar}>
        <div className={styles.logo}>
          Drako <span className={styles.logoTag}>// Ing. de Sistemas UCB</span>
        </div>
        <button className={styles.loginBtn} onClick={onLoginClick}>Acceder Sistema</button>
      </nav>

      {/* Hero Interactivo (Particle Canvas) a pantalla completa */}
      <main className={styles.hero}>
        <ParticleTextEffect />
      </main>

      {/* UCB Showcase Section */}
      <section className={styles.showcaseSection}>
        <div className={styles.showcaseHeader}>
          <div className={styles.badge}>Proyecto Destacado</div>
          <h2 className={styles.showcaseTitle}>
            El Protagonista del <span>OpenHouse UCB</span>
          </h2>
          <p className={styles.showcaseSubtitle}>
            Diseñado en la Facultad de Ingeniería, Drako es la prueba tangible de lo que logras en la carrera de Sistemas.
            Guiando a las familias y postulantes durante el evento, demuestra navegación asistida y recolección de telemetría IoT en vivo.
          </p>
        </div>

        <div className={styles.storyGrid}>
          {/* Bloque 1: Navegación UCB */}
          <div className={styles.storyContent}>
            <h2>La Guía Perfecta para el Futuro Estudiante</h2>
            <p>
              Durante el OpenHouse, la afluencia de personas hace complejo recorrer todo el campus.
              Drako interviene como un anfitrión robótico inteligente, conectando la teoría de ingeniería con
              soluciones prácticas, mapeando los laboratorios de Sistemas y demostrando poder computacional a los visitantes.
            </p>
            <div className={styles.featuresList}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <MapPin size={24} />
                </div>
                <div className={styles.featureText}>
                  <h4>Geolocalización en Interiores</h4>
                  <p>Guía de visitantes bloque por bloque asegurándose de cubrir el tour completo de Ingeniería.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <Cpu size={24} />
                </div>
                <div className={styles.featureText}>
                  <h4>Arquitectura IoT Escalonada</h4>
                  <p>Modelo de software/hardware construido por estudiantes usando protocolos de baja latencia.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.storyImageWrapper}>
            <div className={styles.imageOverlay}></div>
            <img
              src="https://www.ucb.edu.bo/wp-content/uploads/2025/11/DSC1013-scaled-e1762967199889.jpg"
              alt="Campus Universitario Moderno"
              className={styles.storyImage}
            />
            <div className={styles.imageTechDetail}>
              <Activity size={16} color="#78ba49" />
              <span>Sistemas en línea</span>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Oscura Intermedia con Carrusel de Sensores */}
      <section className={styles.carouselSection}>
        <div className={styles.carouselHeader}>
          <h2 className={styles.showcaseTitle} style={{ fontSize: '2.5rem' }}>Anatomía de <span>Drako</span></h2>
          <p className={styles.showcaseSubtitle}>Conoce los componentes sensoriales que otorgan autonomía a nuestro robot guía.</p>
        </div>

        {/* Componente Carrusel intacto */}
        <CircularTestimonials
          testimonials={sensorFeatures}
          colors={{
            name: "#ffffff",
            designation: "#78ba49",
            testimony: "#cbd5e1"
          }}
          fontSizes={{
            name: "2rem",
            designation: "1.2rem",
            quote: "1.1rem"
          }}
        />
      </section>

      {/* CTA Dinámico: Centro de Operaciones */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaContainer}>
          {/* Elementos HUD Decorativos */}
          <div className={styles.hudTopLeft}>[SYS.ONLINE_]</div>
          <div className={styles.hudTopRight}>TELEMETRÍA: ACTIVA</div>
          <div className={styles.hudBottomLeft}>LAT: -16.522 / LNG: -68.112</div>
          <div className={styles.hudBottomRight}>UCB // LA PAZ</div>

          <div className={styles.radarPing}></div>

          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Acceso al <span>Centro de Mando</span></h2>
            <p className={styles.ctaDescription}>
              Toda esta recolección de datos sensoriales no sería nada sin una interfaz de control en tiempo real.
              Ingresa al Dashboard IoT desarrollado por los estudiantes de Ingeniería de Sistemas y visualiza lo que Drako ve.
            </p>

            <button className={styles.cyberBtn} onClick={onLoginClick}>
              <span className={styles.btnText}>Inicializar Dashboard</span>
              <ChevronRight className={styles.btnIcon} size={24} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}