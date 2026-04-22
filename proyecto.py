import network
import urequests
import time
import ujson
from machine import Pin, I2C
import dht

# ==============================
# CONFIG
# ==============================

SSID = "POCO F8 Pro"
PASSWORD = "del1al8xd"

DISPOSITIVO_ID = 1

LOCAL_HOST = "10.33.140.72"
LOCAL_PORT = 4000
LOCAL_BASE_URL = "http://{}:{}/api/iot/".format(LOCAL_HOST, LOCAL_PORT)

SUPABASE_BASE_URL = "https://xouaqsjvpoolhszemuav.supabase.co/rest/v1/"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvdWFxc2p2cG9vbGhzemVtdWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjY3ODQsImV4cCI6MjA4ODc0Mjc4NH0.u8dSR6TEz-4a8X_pUcRW2FGZtAt4OGnRiJ74KNZrwXA"

LOCAL_HEADERS = {"Content-Type": "application/json"}

SUPABASE_HEADERS = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_API_KEY,
    "Authorization": "Bearer " + SUPABASE_API_KEY,
    "Prefer": "return=minimal"
}

# ==============================
# WIFI
# ==============================

wifi = network.WLAN(network.STA_IF)

def conectar_wifi():
    wifi.active(True)

    if not wifi.isconnected():
        wifi.connect(SSID, PASSWORD)
        print("Conectando WiFi...")

        t = 15
        while not wifi.isconnected() and t > 0:
            time.sleep(1)
            t -= 1

    print("WiFi OK:", wifi.ifconfig())

def asegurar_wifi():
    if not wifi.isconnected():
        conectar_wifi()

# ==============================
# DHT22
# ==============================

dht_sensor = dht.DHT22(Pin(4))

def leer_dht22():
    try:
        dht_sensor.measure()
        return {
            "temperatura": dht_sensor.temperature(),
            "humedad": dht_sensor.humidity()
        }
    except:
        return None

# ==============================
# GY-50
# ==============================

i2c = I2C(0, scl=Pin(22), sda=Pin(21), freq=400000)
GY50_ADDR = 0x69

gy50_ok = False
offset_x = offset_y = offset_z = 0
fx = fy = fz = 0
alpha = 0.6

def read_axis(reg):
    data = i2c.readfrom_mem(GY50_ADDR, reg, 2)
    val = data[0] | (data[1] << 8)
    if val > 32767:
        val -= 65536
    return val

def init_gy50():
    global gy50_ok, offset_x, offset_y, offset_z

    if GY50_ADDR in i2c.scan():
        i2c.writeto_mem(GY50_ADDR, 0x20, b'\x0F')
        gy50_ok = True

        print("Calibrando GY50...")
        sx = sy = sz = 0

        for _ in range(80):
            sx += read_axis(0x28)
            sy += read_axis(0x2A)
            sz += read_axis(0x2C)
            time.sleep_ms(2)

        offset_x = sx / 80
        offset_y = sy / 80
        offset_z = sz / 80

        print("GY50 listo")

def leer_gy50():
    global fx, fy, fz

    if not gy50_ok:
        return None

    raw_x = read_axis(0x28) - offset_x
    raw_y = read_axis(0x2A) - offset_y
    raw_z = read_axis(0x2C) - offset_z

    fx = alpha * fx + (1 - alpha) * raw_x
    fy = alpha * fy + (1 - alpha) * raw_y
    fz = alpha * fz + (1 - alpha) * raw_z

    # conversión a grados/s
    gyro_x = fx * 0.00875
    gyro_y = fy * 0.00875
    gyro_z = fz * 0.00875

    return {
        "gyro_x": gyro_x,
        "gyro_y": gyro_y,
        "gyro_z": gyro_z,

        "raw_x": int(raw_x),
        "raw_y": int(raw_y),
        "raw_z": int(raw_z)
    }
# ==============================
# HC-SR04
# ==============================

TRIG = Pin(5, Pin.OUT)
ECHO = Pin(18, Pin.IN)

def leer_hcsr04():
    try:
        TRIG.off()
        time.sleep_us(2)

        TRIG.on()
        time.sleep_us(10)
        TRIG.off()

        timeout = 25000

        start = time.ticks_us()
        while ECHO.value() == 0:
            if time.ticks_diff(time.ticks_us(), start) > timeout:
                return None

        inicio = time.ticks_us()

        while ECHO.value() == 1:
            if time.ticks_diff(time.ticks_us(), inicio) > timeout:
                return None

        fin = time.ticks_us()

        duracion = time.ticks_diff(fin, inicio)

        distancia = (duracion * 0.0343) / 2

        if distancia <= 0 or distancia > 400:
            return None

        return {
            "distancia_cm": round(distancia, 2),
            "tiempo_echo": duracion
        }

    except:
        return None

# ==============================
# ENVÍO ULTRA RÁPIDO (1 SOLO POST)
# ==============================

def enviar_datos(dht_data, gyro_data, ultra_data):

    payload = {
        "dispositivo_id": DISPOSITIVO_ID,
        "timestamp": time.ticks_ms(),
        "dht22": dht_data,
        "gy50": gyro_data,
        "hcsr04": ultra_data
    }

    data = ujson.dumps(payload)

    # LOCAL
    try:
        r = urequests.post(
            LOCAL_BASE_URL + "stream",
            data=data,
            headers=LOCAL_HEADERS
        )
        r.close()
    except:
        pass

    # SUPABASE
    try:
        r = urequests.post(
            SUPABASE_BASE_URL + "iot_stream",
            data=data,
            headers=SUPABASE_HEADERS
        )
        r.close()
    except:
        pass

# ==============================
# MAIN LOOP (TIEMPO REAL)
# ==============================

def main():
    conectar_wifi()
    init_gy50()

    while True:
        asegurar_wifi()

        dht_data = leer_dht22()
        gyro_data = leer_gy50()
        ultra_data = leer_hcsr04()

        enviar_datos(dht_data, gyro_data, ultra_data)

        # 🔥 tiempo real optimizado
        time.sleep_ms(200)

main()