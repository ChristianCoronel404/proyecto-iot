from machine import Pin, PWM, I2C
import time
import math
import dht
import network
import socket
import struct
import ubinascii
import os
import ujson

# ================================================================
#  CONFIGURACION DE RED Y SERVICIOS
# ================================================================
SSID     = "CHIMUELITO_5G"
PASSWORD = "RoSii5y49."

DISPOSITIVO_ID = 1

# Supabase REST API
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

# WebSocket al servidor Node.js (para dashboard en tiempo real)
# >>> CAMBIA ESTA IP a la IP LAN de tu PC que ejecuta npm run dev <<<
WS_HOST = "192.168.1.19"
WS_PORT = 4000
WS_PATH = "/ws"

# Intervalo de upload a Supabase (ms). Cada ciclo sube 1 tabla, rotando.
SUPABASE_INTERVAL_MS = 10000

# ================================================================
#  CONFIGURACION DE PINES
# ================================================================
IN1 = Pin(26, Pin.OUT)
IN2 = Pin(27, Pin.OUT)
IN3 = Pin(32, Pin.OUT)
IN4 = Pin(33, Pin.OUT)

ENA = PWM(Pin(14), freq=1000)
ENB = PWM(Pin(25), freq=1000)

SPEED      = 22000
TURN_SPEED = 45000  # Reducido un poco para que no gire tan violentamente y no patine

# Sensor I2C: GY-50 (L3G4200D)
i2c = I2C(0, scl=Pin(22), sda=Pin(21), freq=400000)

servo      = PWM(Pin(19), freq=50)
trig       = Pin(18, Pin.OUT)   # Sensor MOVIL: TRIG
echo       = Pin(23, Pin.IN)    # Sensor MOVIL: ECHO
trig_fixed = Pin(16, Pin.OUT)   # Sensor FIJO:  TRIG
echo_fixed = Pin(17, Pin.IN)    # Sensor FIJO:  ECHO
button     = Pin(4, Pin.IN, Pin.PULL_UP)
led        = Pin(2, Pin.OUT)

# DHT22 (Sensor de temperatura para batería)
dht_sensor = dht.DHT22(Pin(15))
last_dht_time = 0

robot_on    = False
last_button = 1

# ================================================================
#  WIFI
# ================================================================
wifi = network.WLAN(network.STA_IF)

def conectar_wifi():
    wifi.active(True)
    if not wifi.isconnected():
        wifi.connect(SSID, PASSWORD)
        print("[WIFI] Conectando a " + SSID + "...")
        timeout = 15
        while not wifi.isconnected() and timeout > 0:
            time.sleep(1)
            timeout -= 1
    if wifi.isconnected():
        print("[WIFI] OK:", wifi.ifconfig())
    else:
        print("[WIFI] Timeout, reintentando mas tarde")

def asegurar_wifi():
    if not wifi.isconnected():
        try:
            wifi.connect(SSID, PASSWORD)
            time.sleep(1)
        except:
            pass

# ================================================================
#  CLIENTE WEBSOCKET (RFC 6455)
# ================================================================
class WSClient:
    def __init__(self):
        self._sock = None

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
            buf = b""
            while b"\r\n\r\n" not in buf:
                chunk = s.recv(64)
                if not chunk:
                    break
                buf += chunk
            if b"101" not in buf:
                s.close()
                print("[WS] Handshake rechazado")
                return False
            s.settimeout(2)
            self._sock = s
            print("[WS] Conectado a ws://{}:{}{}".format(host, port, path))
            return True
        except Exception as e:
            print("[WS] Error:", e)
            return False

    def send(self, text):
        if not self._sock:
            return False
        try:
            data = text.encode() if isinstance(text, str) else text
            length = len(data)
            mask = os.urandom(4)
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
            print("[WS] Send error:", e)
            self._close()
            return False

    def _close(self):
        if self._sock:
            try:
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

ws = WSClient()

# ================================================================
#  SUPABASE REST UPLOAD
# ================================================================
def _post_supabase(table, body):
    try:
        import urequests
        r = urequests.post(
            SUPABASE_BASE_URL + table,
            data=ujson.dumps(body),
            headers=SUPABASE_HEADERS,
        )
        r.close()
    except Exception as e:
        print("[SUPA] Error " + table + ":", e)

# ================================================================
#  ESTADO DE MOTORES Y CACHE PARA TELEMETRIA
# ================================================================
motor_state = {
    "der_vel": 0, "der_dir": "stop",
    "izq_vel": 0, "izq_dir": "stop",
}

# Cache de ultimo dato DHT22 para Supabase
last_dht_data = None

# Contadores para Supabase upload rotativo
last_supabase_time = 0
supabase_table_idx = 0
SUPABASE_TABLES = [
    "dht22_data", "gy50_data",
    "hcsr04_fijo_data", "hcsr04_movil_data",
    "servo_data", "motor_der_data", "motor_izq_data",
]

# Cache de ultimo dato de cada sensor para Supabase
cache_gyro = None
cache_fijo = None
cache_movil = None
cache_servo = None

# Contadores para throttle de WebSocket (enviar cada ~200ms, no cada 80ms)
last_ws_time = 0
WS_INTERVAL_MS = 200

# ================================================================
#  GIROSCOPIO GY-50 (L3G4200D)
# ================================================================
L3G4200D_ADDR = 0x69
gyro_bias_z = 0.0
current_heading = 0.0
last_gyro_time = 0
GYRO_SCALE = 1  # Factor de correccion: Aumenta este numero si gira de menos, reducelo si gira de mas.

# Velocidades angulares para telemetria (dps)
gyro_x_dps = 0.0
gyro_y_dps = 0.0
gyro_z_dps = 0.0
gyro_raw_x = 0
gyro_raw_y = 0
gyro_raw_z = 0

def init_gyro():
    global L3G4200D_ADDR
    try:
        # Configurar CTRL_REG1: Activar sensor, X, Y, Z, 800Hz de lectura (0xCF) para no perder giros rapidos
        i2c.writeto_mem(L3G4200D_ADDR, 0x20, b'\xCF')
        # Configurar CTRL_REG4: 2000 dps de escala
        i2c.writeto_mem(L3G4200D_ADDR, 0x23, b'\x20')
        print("[GYRO] OK en 0x69")
    except OSError:
        try:
            L3G4200D_ADDR = 0x68
            i2c.writeto_mem(L3G4200D_ADDR, 0x20, b'\xCF')
            i2c.writeto_mem(L3G4200D_ADDR, 0x23, b'\x20')
            print("[GYRO] OK en 0x68")
        except OSError:
            print("[GYRO] ERROR: No detectado")

def calibrate_gyro(samples=100):
    global gyro_bias_z
    print("[GYRO] Calibrando... (NO MOVER)")
    total = 0
    for _ in range(samples):
        try:
            data = i2c.readfrom_mem(L3G4200D_ADDR, 0x2C | 0x80, 2)
            z_raw = data[0] | (data[1] << 8)
            if z_raw > 32767: z_raw -= 65536
            total += (z_raw * 0.070)
        except OSError:
            pass
        time.sleep_ms(10)
    gyro_bias_z = total / samples
    print("   Bias Z:", round(gyro_bias_z, 2))

def update_heading():
    global current_heading, last_gyro_time
    global gyro_x_dps, gyro_y_dps, gyro_z_dps, gyro_raw_x, gyro_raw_y, gyro_raw_z
    now = time.ticks_ms()
    if last_gyro_time == 0:
        last_gyro_time = now
        return
    dt = time.ticks_diff(now, last_gyro_time) / 1000.0
    last_gyro_time = now

    try:
        # Leer los 3 ejes (X, Y, Z) con auto-increment para telemetria
        data = i2c.readfrom_mem(L3G4200D_ADDR, 0x28 | 0x80, 6)
        x_raw = data[0] | (data[1] << 8)
        y_raw = data[2] | (data[3] << 8)
        z_raw = data[4] | (data[5] << 8)
        if x_raw > 32767: x_raw -= 65536
        if y_raw > 32767: y_raw -= 65536
        if z_raw > 32767: z_raw -= 65536

        # Guardar para telemetria
        gyro_raw_x = x_raw
        gyro_raw_y = y_raw
        gyro_raw_z = z_raw
        gyro_x_dps = round(x_raw * 0.070, 4)
        gyro_y_dps = round(y_raw * 0.070, 4)
        gyro_z_dps = round(z_raw * 0.070, 4)

        # Calculo de heading (solo eje Z, igual que antes)
        rate = ((z_raw * 0.070) - gyro_bias_z) * GYRO_SCALE
        # Ignorar ruido pequeño
        if abs(rate) > 1.5:
            current_heading += rate * dt
    except OSError:
        pass

# ================================================================
#  UMBRALES (ajusta aqui si necesitas)
# ================================================================
DANGER_FIXED   = 65   # cm — sensor fijo: frenar antes (aumentado para reaccionar a tiempo)
DANGER_MOBILE  = 65   # cm — sensor movil (lateral aumentado para ver paredes diagonales antes)
TURN_CLEAR     = 65   # cm — frente debe ver mas de esto para terminar el giro
TURN_TIMEOUT   = 4000 # ms — maximo tiempo girando antes de rendirse
CAP            = 350.0 # cm — maximo creible (3000 = ruido, se limita)

# ================================================================
#  SERVO
# ================================================================
def servo_angle(a):
    duty = int(26 + (a / 180.0) * (128 - 26))
    servo.duty(duty)

def servo_move(a, wait_ms):
    servo_angle(a)
    time.sleep_ms(wait_ms)

# ================================================================
#  MOTORES
# ================================================================
def stop():
    IN1.value(0); IN2.value(0)
    IN3.value(0); IN4.value(0)
    ENA.duty_u16(0); ENB.duty_u16(0)
    motor_state["der_vel"] = 0; motor_state["der_dir"] = "stop"
    motor_state["izq_vel"] = 0; motor_state["izq_dir"] = "stop"

target_heading_drive = 0.0

def forward():
    global current_heading, target_heading_drive
    update_heading()
    error = target_heading_drive - current_heading

    Kp = 400 # Constante Proporcional
    correction = int(error * Kp)

    # Motor A (ENA) es el Derecho. Motor B (ENB) es el Izquierdo.
    # Si error > 0 (ej. heading=-10, estamos a la derecha), queremos ir a la izquierda.
    # Para ir a la izq, el derecho (A) acelera, el izquierdo (B) frena.
    right_speed = SPEED + correction
    left_speed  = SPEED - correction

    left_speed = max(0, min(65535, left_speed))
    right_speed = max(0, min(65535, right_speed))

    ENA.duty_u16(right_speed) # ENA es Motor Derecho
    ENB.duty_u16(left_speed)  # ENB es Motor Izquierdo

    IN1.value(0); IN2.value(1) # A Adelante
    IN3.value(0); IN4.value(1) # B Adelante

    motor_state["der_vel"] = right_speed; motor_state["der_dir"] = "adelante"
    motor_state["izq_vel"] = left_speed;  motor_state["izq_dir"] = "adelante"

def backward():
    ENA.duty_u16(SPEED); ENB.duty_u16(SPEED)
    IN1.value(1); IN2.value(0) # A Atras
    IN3.value(1); IN4.value(0) # B Atras
    motor_state["der_vel"] = SPEED; motor_state["der_dir"] = "atras"
    motor_state["izq_vel"] = SPEED; motor_state["izq_dir"] = "atras"

def spin_left():
    ENA.duty_u16(TURN_SPEED); ENB.duty_u16(TURN_SPEED)
    IN1.value(0); IN2.value(1) # A (Derecho) Adelante
    IN3.value(1); IN4.value(0) # B (Izquierdo) Atras
    motor_state["der_vel"] = TURN_SPEED; motor_state["der_dir"] = "adelante"
    motor_state["izq_vel"] = TURN_SPEED; motor_state["izq_dir"] = "atras"

def spin_right():
    ENA.duty_u16(TURN_SPEED); ENB.duty_u16(TURN_SPEED)
    IN1.value(1); IN2.value(0) # A (Derecho) Atras
    IN3.value(0); IN4.value(1) # B (Izquierdo) Adelante
    motor_state["der_vel"] = TURN_SPEED; motor_state["der_dir"] = "atras"
    motor_state["izq_vel"] = TURN_SPEED; motor_state["izq_dir"] = "adelante"

# ================================================================
#  SENSOR ULTRASONICO
# ================================================================
def dist(trig_pin, echo_pin):
    t = time.ticks_us()
    while echo_pin.value() == 1:
        if time.ticks_diff(time.ticks_us(), t) > 60000:
            break
    trig_pin.value(0); time.sleep_us(5)
    trig_pin.value(1); time.sleep_us(10)
    trig_pin.value(0)
    t = time.ticks_us()
    while echo_pin.value() == 0:
        if time.ticks_diff(time.ticks_us(), t) > 100000:
            return 3000.0
    start = time.ticks_us()
    while echo_pin.value() == 1:
        if time.ticks_diff(time.ticks_us(), start) > 100000:
            return 3000.0
    end = time.ticks_us()
    return min((time.ticks_diff(end, start) * 0.0343) / 2.0, 3000.0)

def dist_avg(trig_pin, echo_pin, n=3):
    readings = sorted([dist(trig_pin, echo_pin) for _ in range(n)])
    return sum(readings[1:-1]) / (n - 2) if n >= 3 else sum(readings) / n

# ================================================================
#  ESCANEO COMPLETO 180 GRADOS (0, 45, 90, 135, 180)
#  Tambien lee el sensor fijo en cada posicion para confirmar.
# ================================================================
SCAN_ANGLES = [0, 45, 90, 135, 180]

# Nombres para cada direccion (0=Der fisico, 180=Izq fisico)
DIR_NAMES = {0: 'DER-90', 45: 'DIAG-DER', 90: 'FRENTE', 135: 'DIAG-IZQ', 180: 'IZQ-90'}
DIR_TURN  = {0: -90, 45: -45, 90: 0, 135: 45, 180: 90}  # grados a girar

def full_scan():
    """
    Barre los 5 angulos con el sensor movil (0 -> 45 -> 90 -> 135 -> 180).
    Primero va al extremo izquierdo (0) y barre hasta el derecho (180).
    Sin limite de tiempo — espera lo que sea necesario para que el servo llegue.
    Retorna dict {angulo: distancia} y la lectura fija frontal.
    """
    readings = {}
    # Ir al extremo izquierdo — esperar 1 segundo completo para que llegue
    servo_move(0, 1000)

    for angle in [0, 45, 90, 135, 180]:
        if angle > 0:
            servo_move(angle, 500)  # Medio segundo entre cada paso de 45 grados
        d = dist_avg(trig, echo, n=3)
        readings[angle] = min(d, CAP)

    # Leer sensor fijo para confirmar frontal
    front_fixed = dist_avg(trig_fixed, echo_fixed, n=3)
    # Volver al centro
    servo_move(90, 600)
    return readings, front_fixed

# ================================================================
#  GIRO CON GIROSCOPIO (Preciso)
# ================================================================
def gyro_turn(target_angle_diff):
    """
    Gira exactamente 'target_angle_diff' grados.
    Positivo = Izquierda, Negativo = Derecha.
    """
    global current_heading
    update_heading()
    start_heading = current_heading
    target = start_heading + target_angle_diff

    if target_angle_diff > 0:
        spin_left()
        dir_str = "Izquierda"
    else:
        spin_right()
        dir_str = "Derecha"

    print(f"   [GYRO] Girando {dir_str} {abs(target_angle_diff)}\u00b0 (Desde {start_heading:.1f}\u00b0 hacia {target:.1f}\u00b0)...")

    t_start = time.ticks_ms()
    while True:
        update_heading()
        now = time.ticks_ms()

        # Comprobar si alcanzamos el angulo
        if target_angle_diff > 0: # Girando a la izquierda
            if current_heading >= target:
                break
        else: # Girando a la derecha
            if current_heading <= target:
                break

        # Timeout por si las ruedas patinan infinitamente
        if time.ticks_diff(now, t_start) > 4000:
            print("   [TIMEOUT] Giro de giroscopio interrumpido.")
            break

        time.sleep_ms(5)

    stop()
    time.sleep_ms(100)
    print(f"   [GYRO] Giro finalizado. Angulo actual: {current_heading:.1f}\u00b0")

# ================================================================
#  DECISION PRINCIPAL — Elige entre 5 direcciones
# ================================================================
def decide_and_escape():
    global target_heading_drive
    stop()
    print("[SCAN 180]")

    rdg, front_fixed = full_scan()

    # Imprimir panorama completo ordenado de Izquierda a Derecha
    print("  180(IZQ):" + str(round(rdg[180])) +
          "  135(DI):" + str(round(rdg[135])) +
          "  90(FR):" + str(round(rdg[90])) +
          "  45(DD):" + str(round(rdg[45])) +
          "  0(DER):" + str(round(rdg[0])) +
          "  Fijo:" + str(round(front_fixed)))

    # Usar el MINIMO entre sensor movil a 90 y sensor fijo como distancia frontal real
    rdg[90] = min(rdg[90], front_fixed)

    STUCK = 25

    # Detectar callejon sin salida (todo bloqueado)
    all_blocked = all(rdg[a] < STUCK for a in SCAN_ANGLES)
    if all_blocked:
        print("  CALLEJON — retrocedo y giro 180")
        backward()
        time.sleep_ms(600)
        stop(); time.sleep_ms(80)
        # Girar 180 hacia el lado con mas espacio
        right_side = max(rdg[0], rdg[45])
        left_side = max(rdg[135], rdg[180])
        gyro_turn(-180 if right_side >= left_side else 180)
        update_heading()
        target_heading_drive = current_heading
        return

    # Elegir la MEJOR de las 5 direcciones
    best_angle = max(SCAN_ANGLES, key=lambda a: rdg[a])
    best_dist  = rdg[best_angle]
    turn_deg   = DIR_TURN[best_angle]
    dir_name   = DIR_NAMES[best_angle]

    print("  -> Mejor: " + dir_name + " (" + str(round(best_dist)) + "cm, giro " + str(turn_deg) + "deg)")

    # Si el frente es la mejor opcion y esta libre, no girar
    if best_angle == 90 and best_dist > DANGER_FIXED:
        print("  Frente libre, sigo recto")
        update_heading()
        target_heading_drive = current_heading
        forward()
        time.sleep_ms(300)
        return

    # Girar el angulo correspondiente
    if turn_deg != 0:
        gyro_turn(turn_deg)

    # Actualizar rumbo objetivo despues de girar
    update_heading()
    target_heading_drive = current_heading

    # Avanzar un poco tras el giro para alejarse del obstaculo
    forward()
    time.sleep_ms(400)
    stop()

# ================================================================
#  RADAR CONTINUO MIENTRAS AVANZA
#  Salta entre los 5 angulos (0, 45, 90, 135, 180)
# ================================================================
sweep_angle = 90
sweep_dir   = 45   # grados por paso (5 posiciones)

# ================================================================
#  ENVIO DE DATOS POR WEBSOCKET Y SUPABASE
# ================================================================

def enviar_ws_datos(dht_d, f_fixed_val, f_mobile_val):
    """Envia datos de todos los sensores al servidor via WebSocket."""
    global ws, last_ws_time
    now_ms = time.ticks_ms()
    if time.ticks_diff(now_ms, last_ws_time) < WS_INTERVAL_MS:
        return
    last_ws_time = now_ms

    if not wifi.isconnected():
        return

    payload = {
        "dispositivo_id": DISPOSITIVO_ID,
        "gy50": {
            "gyro_x": gyro_x_dps,
            "gyro_y": gyro_y_dps,
            "gyro_z": gyro_z_dps,
            "raw_x": gyro_raw_x,
            "raw_y": gyro_raw_y,
            "raw_z": gyro_raw_z,
        },
        "hcsr04": {
            "distancia_cm": round(f_fixed_val, 2) if f_fixed_val < CAP else None,
            "distancia_movil_cm": round(f_mobile_val, 2) if f_mobile_val < CAP else None,
            "angulo_servo": sweep_angle,
        },
        "motores": {
            "motor_der": {"velocidad": motor_state["der_vel"], "direccion": motor_state["der_dir"]},
            "motor_izq": {"velocidad": motor_state["izq_vel"], "direccion": motor_state["izq_dir"]},
        },
    }

    # Incluir DHT22 solo si hay datos recientes
    if dht_d is not None:
        payload["dht22"] = dht_d

    msg = ujson.dumps(payload)

    if not ws.connected:
        ws.connect(WS_HOST, WS_PORT, WS_PATH)

    if ws.connected:
        ws.send(msg)


def enviar_supabase_rotativo(f_fixed_val, f_mobile_val):
    """Sube datos a Supabase, 1 tabla por ciclo de 10 segundos, rotando."""
    global last_supabase_time, supabase_table_idx, last_dht_data
    global cache_gyro, cache_fijo, cache_movil, cache_servo

    now_ms = time.ticks_ms()
    if time.ticks_diff(now_ms, last_supabase_time) < SUPABASE_INTERVAL_MS:
        return
    last_supabase_time = now_ms

    if not wifi.isconnected():
        return

    table = SUPABASE_TABLES[supabase_table_idx]
    supabase_table_idx = (supabase_table_idx + 1) % len(SUPABASE_TABLES)

    try:
        if table == "dht22_data" and last_dht_data:
            _post_supabase(table, {
                "temperatura": last_dht_data["temperatura"],
                "humedad": last_dht_data["humedad"],
                "dispositivo_id": DISPOSITIVO_ID,
            })

        elif table == "gy50_data":
            _post_supabase(table, {
                "gyro_x": gyro_x_dps,
                "gyro_y": gyro_y_dps,
                "gyro_z": gyro_z_dps,
                "raw_x": gyro_raw_x,
                "raw_y": gyro_raw_y,
                "raw_z": gyro_raw_z,
                "dispositivo_id": DISPOSITIVO_ID,
            })

        elif table == "hcsr04_fijo_data":
            if f_fixed_val < CAP:
                _post_supabase(table, {
                    "distancia_cm": round(f_fixed_val, 2),
                    "dispositivo_id": DISPOSITIVO_ID,
                })

        elif table == "hcsr04_movil_data":
            if f_mobile_val < CAP:
                _post_supabase(table, {
                    "distancia_cm": round(f_mobile_val, 2),
                    "angulo_servo": sweep_angle,
                    "dispositivo_id": DISPOSITIVO_ID,
                })

        elif table == "servo_data":
            duty = int(26 + (sweep_angle / 180.0) * (128 - 26))
            _post_supabase(table, {
                "angulo_grados": sweep_angle,
                "duty_ciclo": duty,
                "dispositivo_id": DISPOSITIVO_ID,
            })

        elif table == "motor_der_data":
            _post_supabase(table, {
                "velocidad_pwm": motor_state["der_vel"],
                "direccion": motor_state["der_dir"],
                "dispositivo_id": DISPOSITIVO_ID,
            })

        elif table == "motor_izq_data":
            _post_supabase(table, {
                "velocidad_pwm": motor_state["izq_vel"],
                "direccion": motor_state["izq_dir"],
                "dispositivo_id": DISPOSITIVO_ID,
            })

    except Exception as e:
        print("[SUPA] Rotativo error:", e)

# ================================================================
#  LOOP PRINCIPAL
# ================================================================
servo_angle(90)  # Acomodar servo al frente antes de iniciar
time.sleep_ms(500)

# Conectar WiFi al inicio
conectar_wifi()

while True:

    # --- BOTON ---
    cur_btn = button.value()
    if last_button == 1 and cur_btn == 0:
        robot_on = not robot_on
        time.sleep_ms(200)
        if robot_on:
            # Calibrar y resetear al encender
            sweep_angle = 90
            servo_angle(90)
            init_gyro()
            calibrate_gyro(50) # 50 samples = 0.5s
            update_heading()
            target_heading_drive = current_heading
        else:
            stop(); led.value(0)
    last_button = cur_btn
    led.value(1 if robot_on else 0)

    if not robot_on:
        stop()
        # Mantener WiFi viva aunque el robot este apagado
        asegurar_wifi()
        continue

    update_heading() # Mantener giroscopio actualizado en el bucle principal

    # --- DHT22 (Temperatura de Bateria cada 5s) ---
    now_ms = time.ticks_ms()
    dht_lectura = None
    if time.ticks_diff(now_ms, last_dht_time) > 5000:
        last_dht_time = now_ms
        try:
            dht_sensor.measure()
            temp = dht_sensor.temperature()
            hum = dht_sensor.humidity()
            print("[BATERIA] Temp: " + str(temp) + "\u00b0C | Hum: " + str(hum) + "%")
            dht_lectura = {"temperatura": round(temp, 2), "humedad": round(hum, 2)}
            last_dht_data = dht_lectura
        except OSError:
            pass # Ignorar fallos de lectura para no trabar el robot

    # --- BARRIDO CONTINUO (0, 45, 90, 135, 180) ---
    sweep_angle += sweep_dir
    if sweep_angle >= 180:
        sweep_angle = 180; sweep_dir = -45
    elif sweep_angle <= 0:
        sweep_angle = 0;  sweep_dir = 45

    servo_angle(sweep_angle)
    time.sleep_ms(80)  # Aumentado a 120ms para asegurar que el servo alcance la posicion fisica

    # --- SENSADO CON AMBOS ULTRASONICOS ---
    f_fixed  = dist(trig_fixed, echo_fixed)
    f_mobile = dist(trig, echo)

    # Para los extremos laterales (0 y 180) no usar proyeccion frontal
    if sweep_angle == 0 or sweep_angle == 180:
        proj = f_mobile
        cur_danger_mobile = 25  # Solo frenar si pared lateral < 25cm
    else:
        angle_rad  = abs(sweep_angle - 90) * math.pi / 180.0
        proj       = f_mobile * math.cos(angle_rad)
        cur_danger_mobile = DANGER_MOBILE

    # --- FILTRO ANTI-RUIDO: confirmar con 3 lecturas antes de frenar ---
    if f_fixed < DANGER_FIXED:
        f_fixed = dist_avg(trig_fixed, echo_fixed, n=3)

    if proj < cur_danger_mobile:
        f_mobile = dist_avg(trig, echo, n=3)
        if sweep_angle == 0 or sweep_angle == 180:
            proj = f_mobile
        else:
            proj = f_mobile * math.cos(angle_rad)

    # Imprimir solo cuando hay algo interesante
    if f_fixed < 200 or f_mobile < 200:
        print("F:" + str(round(f_fixed)) + " M" + str(sweep_angle) + ":" + str(round(f_mobile)) + " P:" + str(round(proj)))

    # --- ENVIAR DATOS POR WEBSOCKET (tiempo real para dashboard) ---
    enviar_ws_datos(dht_lectura, f_fixed, f_mobile)

    # --- SUBIR A SUPABASE (persistencia, 1 tabla cada 10s rotando) ---
    enviar_supabase_rotativo(f_fixed, f_mobile)

    # --- DECISION: Peligro si AMBOS sensores confirman o el fijo esta muy cerca ---
    # El fijo es el guardian principal (siempre mira al frente)
    # El movil ayuda a confirmar y detectar laterales
    peligro_fijo  = f_fixed < DANGER_FIXED
    peligro_movil = proj < cur_danger_mobile

    # Frenar si: el fijo detecta pared cercana O el movil detecta lateral muy cerca
    # Pero para el fijo, si solo el fijo dice peligro, confirmar con el movil a 90
    if peligro_fijo and sweep_angle == 90:
        # Ambos sensores miran al frente — peligro confirmado
        peligro = True
    elif peligro_fijo and f_fixed < 40:
        # Fijo muy cerca (< 40cm) — peligro urgente sin esperar confirmacion
        peligro = True
    elif peligro_fijo:
        # Fijo dice peligro pero movil no mira al frente — hacer check rapido
        servo_move(90, 100)
        check_mobile = dist_avg(trig, echo, n=3)
        peligro = (check_mobile < DANGER_FIXED) or (f_fixed < 50)
        # Restaurar posicion del servo
        servo_angle(sweep_angle)
    elif peligro_movil:
        peligro = True
    else:
        peligro = False

    if peligro:
        decide_and_escape()
    else:
        forward()
