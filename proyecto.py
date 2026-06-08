import network
import urequests
import socket
import struct
import ubinascii
import os
import time
import ujson
from machine import Pin, I2C
import dht

# ==========================================
# CONFIG
# ==========================================

SSID     = "POCO F8 Pro"
PASSWORD = "del1al8xd"

DISPOSITIVO_ID = 1

WS_HOST = "10.33.140.72"
WS_PORT = 4000
WS_PATH = "/ws"

SUPABASE_BASE_URL = "https://xouaqsjvpoolhszemuav.supabase.co/rest/v1/"
SUPABASE_API_KEY  = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvdWFxc2p2cG9vbGhzemVtdWF2Iiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3NzMxNjY3ODQsImV4cCI6MjA4ODc0Mjc4NH0"
    ".u8dSR6TEz-4a8X_pUcRW2FGZtAt4OGnRiJ74KNZrwXA"
)
SUPABASE_HEADERS = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_API_KEY,
    "Authorization": "Bearer " + SUPABASE_API_KEY,
    "Prefer": "return=minimal",
}

# Cada cuántas iteraciones (200ms c/u) se persiste en Supabase directamente.
# 25 iteraciones = ~5 segundos.
SUPABASE_INTERVAL = 25

# ==========================================
# WIFI
# ==========================================

wifi = network.WLAN(network.STA_IF)

def conectar_wifi():
    wifi.active(True)
    if not wifi.isconnected():
        wifi.connect(SSID, PASSWORD)
        print("Conectando WiFi...")
        timeout = 15
        while not wifi.isconnected() and timeout > 0:
            time.sleep(1)
            timeout -= 1
    if wifi.isconnected():
        print("WiFi OK:", wifi.ifconfig())
    else:
        print("WiFi: tiempo de espera agotado, reintentando en el bucle")

def asegurar_wifi():
    if not wifi.isconnected():
        conectar_wifi()

# ==========================================
# CLIENTE WEBSOCKET (MicroPython nativo)
# Protocolo RFC 6455 — frames de texto con máscara de cliente.
# ==========================================

class WSClient:
    def __init__(self):
        self._sock = None

    # ── Conexión ──────────────────────────────────────────────
    def connect(self, host, port, path="/ws"):
        self._close()
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            addr = socket.getaddrinfo(host, port)[0][-1]
            s.settimeout(5)
            s.connect(addr)

            key = ubinascii.b2a_base64(os.urandom(16)).decode().strip()
            handshake = (
                "GET {} HTTP/1.1\r\n"
                "Host: {}\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                "Sec-WebSocket-Key: {}\r\n"
                "Sec-WebSocket-Version: 13\r\n"
                "\r\n"
            ).format(path, host, key)
            s.send(handshake.encode())

            # Leer respuesta hasta el fin de cabeceras
            buf = b""
            while b"\r\n\r\n" not in buf:
                chunk = s.recv(64)
                if not chunk:
                    break
                buf += chunk

            if b"101" not in buf:
                s.close()
                print("WS: handshake rechazado")
                return False

            s.settimeout(2)
            self._sock = s
            print("WS: conectado a ws://{}:{}{}".format(host, port, path))
            return True
        except Exception as e:
            print("WS connect error:", e)
            return False

    # ── Envío de frame de texto (RFC 6455 §5.6) ───────────────
    def send(self, text):
        if not self._sock:
            return False
        try:
            data   = text.encode() if isinstance(text, str) else text
            length = len(data)
            mask   = os.urandom(4)

            if length < 126:
                header = bytes([0x81, 0x80 | length])
            else:
                header = bytes([0x81, 0xFE]) + struct.pack("!H", length)

            masked = bytearray(length)
            for i in range(length):
                masked[i] = data[i] ^ mask[i % 4]

            self._sock.send(header + mask + bytes(masked))
            return True
        except Exception as e:
            print("WS send error:", e)
            self._close()
            return False

    # ── Cierre limpio ─────────────────────────────────────────
    def _close(self):
        if self._sock:
            try:
                # Frame de cierre (opcode 0x8, sin payload)
                self._sock.send(b"\x88\x80\x00\x00\x00\x00")
            except:
                pass
            try:
                self._sock.close()
            except:
                pass
            self._sock = None

    def close(self):
        self._close()

    @property
    def connected(self):
        return self._sock is not None

# Instancia global del cliente WS
ws = WSClient()

# ==========================================
# SENSOR DHT22  (pin 4)
# Mide temperatura y humedad ambiental/batería.
# ==========================================

dht_sensor = dht.DHT22(Pin(4))

def leer_dht22():
    try:
        dht_sensor.measure()
        return {
            "temperatura": round(dht_sensor.temperature(), 2),
            "humedad":     round(dht_sensor.humidity(), 2),
        }
    except:
        return None

# ==========================================
# SENSOR GY-50  (I2C bus 0: SCL=22, SDA=21)
# Giroscopio L3G4200D — velocidad angular en 3 ejes.
# ==========================================

i2c       = I2C(0, scl=Pin(22), sda=Pin(21), freq=400000)
GY50_ADDR = 0x69

gy50_ok            = False
offset_x = offset_y = offset_z = 0.0
fx = fy = fz       = 0.0
ALPHA              = 0.6   # factor filtro paso-bajo exponencial

def _read_axis(reg):
    raw = i2c.readfrom_mem(GY50_ADDR, reg, 2)
    val = raw[0] | (raw[1] << 8)
    return val - 65536 if val > 32767 else val

def init_gy50():
    global gy50_ok, offset_x, offset_y, offset_z
    if GY50_ADDR not in i2c.scan():
        print("GY50: no detectado en bus I2C")
        return
    i2c.writeto_mem(GY50_ADDR, 0x20, b"\x0F")   # encender, 100Hz, todos ejes ON
    gy50_ok = True

    print("GY50: calibrando...")
    sx = sy = sz = 0
    for _ in range(80):
        sx += _read_axis(0x28)
        sy += _read_axis(0x2A)
        sz += _read_axis(0x2C)
        time.sleep_ms(2)
    offset_x = sx / 80
    offset_y = sy / 80
    offset_z = sz / 80
    print("GY50: listo")

def leer_gy50():
    global fx, fy, fz
    if not gy50_ok:
        return None

    rx = _read_axis(0x28) - offset_x
    ry = _read_axis(0x2A) - offset_y
    rz = _read_axis(0x2C) - offset_z

    fx = ALPHA * fx + (1 - ALPHA) * rx
    fy = ALPHA * fy + (1 - ALPHA) * ry
    fz = ALPHA * fz + (1 - ALPHA) * rz

    return {
        "gyro_x": round(fx * 0.00875, 4),
        "gyro_y": round(fy * 0.00875, 4),
        "gyro_z": round(fz * 0.00875, 4),
        "raw_x":  int(rx),
        "raw_y":  int(ry),
        "raw_z":  int(rz),
    }

# ==========================================
# SENSORES HC-SR04  (trigger compartido, 3 echos)
# TRIG=5  ECHO_CENTRO=18  ECHO_IZQ=19  ECHO_DER=23
# ==========================================

TRIG       = Pin(5,  Pin.OUT)
ECHO_CENTRO = Pin(18, Pin.IN)
ECHO_IZQ   = Pin(19, Pin.IN)
ECHO_DER   = Pin(23, Pin.IN)

TIMEOUT_US = 25000   # 25ms ≈ 4.25m máximo

def _medir_echo(echo_pin):
    """Dispara el trigger y mide el tiempo del echo en un pin dado."""
    try:
        TRIG.off()
        time.sleep_us(2)
        TRIG.on()
        time.sleep_us(10)
        TRIG.off()

        t0 = time.ticks_us()
        while echo_pin.value() == 0:
            if time.ticks_diff(time.ticks_us(), t0) > TIMEOUT_US:
                return None
        inicio = time.ticks_us()

        while echo_pin.value() == 1:
            if time.ticks_diff(time.ticks_us(), inicio) > TIMEOUT_US:
                return None
        fin = time.ticks_us()

        duracion  = time.ticks_diff(fin, inicio)
        distancia = (duracion * 0.0343) / 2
        if not (0 < distancia <= 400):
            return None
        return {"distancia_cm": round(distancia, 2), "tiempo_echo": duracion}
    except:
        return None

def leer_hcsr04():
    """Lee los 3 sensores HC-SR04 de forma secuencial (trigger compartido).
    Retorna None si todos fallan; de lo contrario retorna dict con los campos
    disponibles (None para los sensores que fallaron)."""
    centro = _medir_echo(ECHO_CENTRO)
    time.sleep_ms(20)   # pausa para que el sonido se disipe antes del siguiente disparo
    izq    = _medir_echo(ECHO_IZQ)
    time.sleep_ms(20)
    der    = _medir_echo(ECHO_DER)

    if centro is None and izq is None and der is None:
        return None

    return {
        "distancia_cm":     centro["distancia_cm"]  if centro else None,
        "tiempo_echo":      centro["tiempo_echo"]   if centro else None,
        "distancia_izq_cm": izq["distancia_cm"]     if izq    else None,
        "distancia_der_cm": der["distancia_cm"]     if der    else None,
    }

# ==========================================
# TRANSPORTE 1: WebSocket → servidor local
# Tiempo real, 200 ms por iteración.
# ==========================================

def enviar_ws(dht_data, gyro_data, ultra_data):
    global ws
    payload = ujson.dumps({
        "dispositivo_id": DISPOSITIVO_ID,
        "timestamp":      time.ticks_ms(),
        "dht22":  dht_data,
        "gy50":   gyro_data,
        "hcsr04": ultra_data,
    })

    if not ws.connected:
        ws.connect(WS_HOST, WS_PORT, WS_PATH)

    if ws.connected:
        if not ws.send(payload):
            # El send ya cerró el socket internamente; reintento la próxima iteración.
            pass

# ==========================================
# TRANSPORTE 2: REST Supabase (backup persistente)
# Se llama cada SUPABASE_INTERVAL iteraciones para no saturar RAM.
# Sube directamente a las tablas individuales.
# ==========================================

def _post_supabase(table, body):
    try:
        r = urequests.post(
            SUPABASE_BASE_URL + table,
            data=ujson.dumps(body),
            headers=SUPABASE_HEADERS,
        )
        r.close()
    except:
        pass

def enviar_supabase(dht_data, gyro_data, ultra_data):
    if dht_data:
        _post_supabase("dht22_data", {**dht_data, "dispositivo_id": DISPOSITIVO_ID})

    if gyro_data:
        _post_supabase("gy50_data", {**gyro_data, "dispositivo_id": DISPOSITIVO_ID})

    if ultra_data:
        _post_supabase("hcsr04_data", {**ultra_data, "dispositivo_id": DISPOSITIVO_ID})

# ==========================================
# BUCLE PRINCIPAL
# ==========================================

def main():
    conectar_wifi()
    init_gy50()

    supabase_counter = 0

    while True:
        asegurar_wifi()

        dht_data   = leer_dht22()
        gyro_data  = leer_gy50()
        ultra_data = leer_hcsr04()

        # ── Tiempo real: WebSocket al servidor local ──────────
        enviar_ws(dht_data, gyro_data, ultra_data)

        # ── Persistencia: Supabase REST cada ~5 s ────────────
        supabase_counter += 1
        if supabase_counter >= SUPABASE_INTERVAL:
            supabase_counter = 0
            enviar_supabase(dht_data, gyro_data, ultra_data)

        time.sleep_ms(200)

main()
