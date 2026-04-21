# Plan de Implementación de "Drako" (Frontend)

Este plan abarca la construcción de la interfaz completa de "Drako", cubriendo los 4 bloques descritos en tu solicitud para asegurar un flujo de trabajo estructurado y sin bloqueos.

> [!NOTE]
> Dado que solicitaste usar datos estáticos por ahora, toda la navegación y el manejo de estado se llevará a cabo de manera local en los componentes de React, utilizando renderizado condicional sin necesidad de configurar React Router o un Backend real todavía.

## Resumen del Flujo de Trabajo

### Bloque 1: Mejoras a la Landing Page y Características (Features)
- **Features Section**: Añadiremos a `App.jsx` y `App.module.css` las tarjetas con Glassmorphism para los sensores:
  - Orientación y Movimiento (GY50)
  - Temperatura y Humedad (DHT22)
  - Proximidad (HC-SR04)
- **Modal de Login**: Implementaremos un componente modal sobre la Landing que albergará un formulario vacío (o de demostración) con efecto de desenfoque.

### Bloque 2: Estructura del Sistema Privado (App Layout & Sidebar)
- **Estado Global Simulado**: Incorporaremos un estado en `App.jsx` (ej. `currentView` y `isAuthenticated`) para alternar entre la Landing y la zona privada.
- **Sidebar**: Construcción de una barra lateral izquierda responsiva.
  - Opciones de navegación simuladas: "Dashboard", "Usuarios (Admin)" y "Mi Cuenta".
  - Botón fijo de "Cerrar Sesión".

### Bloque 3: Dashboard de Telemetría (Widgets + Gráficos 3D)
- **Visualizador 3D CSS**: Para evitar sobrecargar el proyecto con `three.js` inmediatamente, crearemos un Cubo 3D usando puramente CSS 3D Transforms (`rotateX`, `rotateY`, `rotateZ`) para representar el giroscopio.
- **Widgets Glassmorphism**:
  - Clima (24°C / 60% HR).
  - Proximidad (Distancia física de alerta).
- **Gráfico de Actividad**: Reactivaremos el uso de `recharts` (ya presente en tu `package.json`) y crearemos un gráfico lineal con datos estáticos de temperatura simulados.

### Bloque 4: Vistas de Administración y Cuenta
- **Tabla de Usuarios**: Un diseño de tabla moderna para los usuarios (`username`, `rol`, `activo`, `password_hash` simulado).
- **Formularios de Gestión**: Formularios responsivos y alineados con la nomenclatura de la base de datos SQL que implementarás a futuro.

---

## Cambios Propuestos Por Componente

### Core & Estado (En `App.jsx`)
#### [MODIFY] `src/App.jsx`
- Se creará un enrutador basado en estados (`view = 'landing' | 'login' | 'dashboard' | 'admin' | 'profile'`).
- Inclusión del Modal de Login y gestión de inicio de sesión ficticio.

### Estilos (En `App.module.css`)
#### [MODIFY] `src/App.module.css`
- Se agregarán clases para las `featuresCards`, `modal`, `sidebar`, `dashboardGrid`, `widgets` y un `css-3d-cube`.

---

## User Review Required

> [!IMPORTANT]
> - ¿Estás de acuerdo con utilizar transiciones **CSS 3D** para la visualización de la orientación (Cubo 3D) en lugar de instalar una biblioteca externa como `three.js`? El rendimiento es mucho mejor e impacta menos en los tiempos de construcción en esta fase de prototipado temprano.
> - ¿Deseas que mantengamos todo el código consolidado de momento en `App.jsx` y `App.module.css` para el flujo rápido de prototipo, o prefieres que extraiga los componentes a sus propios archivos (`Sidebar.jsx`, `Dashboard.jsx`, etc.) para organizarlo desde ya? (Yo recomiendo extraerlos para que este proyecto masivo sea sostenible).

## Plan de Verificación

### Verificación Manual
1. Iniciarás el entorno de desarrollo usando el script de npm (veo que te falló el `concurrently` porque no estaba en el path, pero solo necesitamos correr `npm run dev:client` para Vite).
2. Deberás ver la landing iterada con las tarjetas de los chips (IoT).
3. Deberás probar hacer click en Login e ingresar al sistema privado, verificando que la Sidebar renderice la vista del Dashboard y la de Administración correctamente.
