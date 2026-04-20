# series-dashboard

Dashboard interactivo para visualizar series matemáticas: Fibonacci, Sen(x) con Taylor, y Ln(x) con Taylor.

## Series Implementadas

1. **Fibonacci**: Serie de Fibonacci clásica
   - Fórmula: F(n) = F(n-1) + F(n-2) para n > 2, con F(1) = F(2) = 1

2. **Sen(x) - Serie de Taylor**: Aproximación de la función seno usando serie de Taylor
   - Centro: x = π/4
   - Fórmula: sen(x) = x - x³/3! + x⁵/5! - x⁷/7! + ...

3. **Ln(x) - Serie de Taylor**: Aproximación de la función logaritmo natural usando serie de Taylor
   - Centro: x = 2 (evalúa ln(2))
   - Fórmula: ln(x) = (x-1) - (x-1)²/2 + (x-1)³/3 - (x-1)⁴/4 + ...

## Instalación y Configuración

### Requisitos
- Node.js 18+
- PostgreSQL 12+
- npm o yarn

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone [repository-url]
cd series-dashboard
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
Crea un archivo `.env` en la raíz del proyecto:
```
DATABASE_URL=postgresql://usuario:contraseña@host:puerto/basedatos
PORT=4000
```

4. **Ejecutar Migración de Base de Datos**
Ejecuta el script de migración SQL en tu base de datos PostgreSQL:
```bash
# Usando psql
psql -U postgres -d postgres -f migrations/001_update_series_tables.sql
psql -U postgres -d postgres -f migrations/002_normalize_fibonacci_id.sql

# O copia el contenido del archivo migrations/001_update_series_tables.sql 
# y migrations/002_normalize_fibonacci_id.sql
# y ejecútalos en pgAdmin o tu cliente SQL favorito
```

Estos scripts:
- Elimina las tablas antiguas `maclaurin_series` y `taylor_series`
- Crea las nuevas tablas `senx_series` y `lnx_series`
- Normaliza `fibonacci_series.id` a `BIGSERIAL` para alinear el esquema con las otras series

### Tablas de Base de Datos

#### fibonacci_series
```sql
- id: BIGSERIAL PRIMARY KEY
- n: INTEGER (orden del término)
- r: INTEGER (número de repetición)
- valor: BIGINT (valor calculado)
- error: NUMERIC
- fecha: DATE
- hora: TIME
```

#### senx_series
```sql
- id: BIGSERIAL PRIMARY KEY
- n: INTEGER (orden del término)
- r: INTEGER (número de repetición)
- x: NUMERIC (valor de x en π/4)
- aproximacion: NUMERIC (valor aproximado de sen(x))
- error: NUMERIC (error respecto al valor real)
- fecha: DATE
- hora: TIME
```

#### lnx_series
```sql
- id: BIGSERIAL PRIMARY KEY
- n: INTEGER (orden del término)
- r: INTEGER (número de repetición)
- x: NUMERIC (valor de x = 2)
- aproximacion: NUMERIC (valor aproximado de ln(2))
- error: NUMERIC (error respecto al valor real ln(2))
- fecha: DATE
- hora: TIME
```

## Uso

### Iniciar el servidor backend
```bash
cd server
node index.js
```

### Iniciar el frontend (en otra terminal)
```bash
npm run dev
```

El dashboard estará disponible en `http://localhost:5173` (Vite) y el backend en `http://localhost:4000`.

### Funcionalidades

- **Generar Datos**: Especifica `n` (número de términos) y `r` (repeticiones) para generar nuevos registros
- **Visualizar Gráficos**: Tres gráficos interactivos muestran las últimas 500 entradas de cada serie
- **Actualización en Tiempo Real**: Los gráficos se actualizan automáticamente mediante Server-Sent Events (SSE)
- **Limpiar Datos**: Elimina todos los registros de las tres tablas
- **Estado de Conexión**: Indicador de conexión al backend

## Archivos Clave

- `server/index.js`: Backend Express con lógica de cálculo de series
- `src/App.jsx`: Componente principal de React
- `migrations/001_update_series_tables.sql`: Script de migración de base de datos
- `migrations/002_normalize_fibonacci_id.sql`: Ajuste de `fibonacci_series.id` a `BIGSERIAL`

## Cambios Recientes (Versión Actualizada)

- ✅ Cambio de series: Maclaurin/Taylor → Sen(x)/Ln(x)
- ✅ Nuevas funciones de cálculo con serie de Taylor
- ✅ Nuevas tablas en base de datos
- ✅ Interfaz de usuario actualizada
- ✅ Mensajes en español

## Tecnologías Utilizadas

- **Frontend**: React, Recharts, Vite
- **Backend**: Express.js, Node.js
- **Base de Datos**: PostgreSQL
- **Otros**: CORS, dotenv
