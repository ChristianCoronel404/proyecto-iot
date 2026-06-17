# Drako App Móvil

Aplicación móvil para el monitoreo de telemetría IoT del proyecto Drako. Desarrollada con React Native y Expo SDK 54.

## Requisitos Previos

- Node.js instalado.
- Dispositivo móvil con **Expo Go** instalado (Android o iOS).
- Conexión a internet (para usar localtunnel) o estar en la misma red Wi-Fi (para uso local).

## 1. Inicializar e Instalar Dependencias

Para instalar las dependencias necesarias de la aplicación, incluyendo Expo 54, asegúrate de estar dentro de la carpeta `app-movil` y ejecuta:

```bash
npm install
```

*(Si quisieras inicializar un proyecto de Expo 54 desde cero en un futuro, el comando sería `npx create-expo-app@latest --template blank`)*

## 2. Configuración del Entorno (.env)

Debes crear un archivo llamado `.env` en la raíz de esta carpeta (`app-movil`) para configurar la URL del backend al cual la app móvil se va a conectar.

**Ejemplo de archivo `.env`:**

```env
# URL del backend usando localtunnel (Recomendado para evitar problemas de Firewall)
EXPO_PUBLIC_API_URL=https://tu-url-de-localtunnel.loca.lt

# URL del backend en red local (Solo funciona si abriste el puerto en el firewall y la red lo permite)
# EXPO_PUBLIC_API_URL=http://192.168.1.7:4000
```

## 3. Exponer el Puerto del Backend al Público (Recomendado)

A menudo las redes Wi-Fi bloquean las peticiones entre el celular y la laptop (AP Isolation), o el Firewall de Windows bloquea el tráfico entrante. La manera más rápida de solucionarlo es hacer el puerto `4000` (el del backend) público mediante **localtunnel**.

1. Asegúrate de que tu backend está corriendo en la carpeta raíz del proyecto (`npm run dev`).
2. Abre una **nueva consola** en la carpeta principal del proyecto y ejecuta:

```bash
npx localtunnel --port 4000
```

3. La consola te arrojará una URL parecida a `https://algo-aleatorio.loca.lt`.
4. Copia esa URL y **ponla en tu archivo `.env`** como se muestra en el paso anterior.

## 4. Dar Permisos al Puerto en el Firewall (Alternativa de Red Local)

Si prefieres usar tu IP local y **NO** usar localtunnel, necesitas dar permisos en el Firewall de Windows para el puerto 4000:

1. Abre **PowerShell como Administrador**.
2. Ejecuta el siguiente comando para abrir el puerto 4000:

```powershell
New-NetFirewallRule -DisplayName "Drako Backend Port 4000" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
```

3. Asegúrate de que el perfil de tu red Wi-Fi en Windows esté configurado como **"Privada"** y no "Pública".
4. Usa la dirección IPv4 de tu computadora en el archivo `.env` (ejemplo: `http://192.168.1.7:4000`).

## 5. Ejecutar la Aplicación Móvil

Una vez que guardaste el archivo `.env` con la URL correcta, inicia el servidor de Expo:

```bash
npx expo start -c
```

> **Importante:** Siempre usa la bandera `-c` (clear) después de modificar el `.env` o instalar un nuevo paquete. Esto limpia la caché de Metro Bundler y se asegura de que la app tome la nueva URL.

Finalmente, abre la aplicación **Expo Go** en tu celular y **escanea el código QR** que aparece en la terminal.
