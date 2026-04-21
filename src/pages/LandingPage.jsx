import { motion } from 'framer-motion'
import { Car, Cpu, Thermometer, Zap } from 'lucide-react'
import './LandingPage.css'

const LandingPage = ({ onLoginClick }) => {
  return (
    <div className="landing-page">
      {/* Glassmorphism Header */}
      <header className="glass-header">
        <div className="header-content">
          <h1 className="logo">Drako</h1>
          <button className="login-btn" onClick={onLoginClick}>
            Login
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <motion.div 
            className="hero-text"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2>Autonomous IoT Vehicle</h2>
            <p>
              Experience the future of transportation with Drako, our cutting-edge 
              autonomous vehicle powered by advanced IoT sensors and AI-driven navigation.
            </p>
            <button className="cta-btn" onClick={onLoginClick}>
              Access Dashboard
            </button>
          </motion.div>
          
          <motion.div 
            className="hero-visual"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="car-placeholder">
              <Car size={120} />
              <div className="car-shadow"></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <motion.h3 
            className="section-title"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            Advanced IoT Components
          </motion.h3>
          
          <div className="features-grid">
            <motion.div 
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="feature-icon">
                <Cpu color="#78ba49" size={40} />
              </div>
              <h4>IMU Sensor</h4>
              <p>Gyroscope and accelerometer for precise spatial orientation tracking</p>
            </motion.div>

            <motion.div 
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="feature-icon">
                <Thermometer color="#78ba49" size={40} />
              </div>
              <h4>Temperature & Humidity</h4>
              <p>DHT22 sensor for environmental monitoring and climate control</p>
            </motion.div>

            <motion.div 
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="feature-icon">
                <Zap color="#78ba49" size={40} />
              </div>
              <h4>Obstacle Detection</h4>
              <p>HC-SR04 ultrasonic sensors for front and rear collision avoidance</p>
            </motion.div>

            <motion.div 
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="feature-icon">
                <Car color="#78ba49" size={40} />
              </div>
              <h4>Dual Motor System</h4>
              <p>Two rear motors and four wheels for superior traction and control</p>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
