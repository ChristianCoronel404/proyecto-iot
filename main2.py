from machine import Pin, PWM, I2C
import time
import math
import dht

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
#  GIROSCOPIO GY-50 (L3G4200D)
# ================================================================
L3G4200D_ADDR = 0x69
gyro_bias_z = 0.0
current_heading = 0.0
last_gyro_time = 0
GYRO_SCALE = 1  # Factor de correccion: Aumenta este numero si gira de menos, reducelo si gira de mas.

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
    now = time.ticks_ms()
    if last_gyro_time == 0:
        last_gyro_time = now
        return
    dt = time.ticks_diff(now, last_gyro_time) / 1000.0
    last_gyro_time = now
    
    try:
        data = i2c.readfrom_mem(L3G4200D_ADDR, 0x2C | 0x80, 2)
        z_raw = data[0] | (data[1] << 8)
        if z_raw > 32767: z_raw -= 65536
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

def backward():
    ENA.duty_u16(SPEED); ENB.duty_u16(SPEED)
    IN1.value(1); IN2.value(0) # A Atras
    IN3.value(1); IN4.value(0) # B Atras

def spin_left():
    ENA.duty_u16(TURN_SPEED); ENB.duty_u16(TURN_SPEED)
    IN1.value(0); IN2.value(1) # A (Derecho) Adelante
    IN3.value(1); IN4.value(0) # B (Izquierdo) Atras

def spin_right():
    ENA.duty_u16(TURN_SPEED); ENB.duty_u16(TURN_SPEED)
    IN1.value(1); IN2.value(0) # A (Derecho) Atras
    IN3.value(0); IN4.value(1) # B (Izquierdo) Adelante

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
        
    print(f"   [GYRO] Girando {dir_str} {abs(target_angle_diff)}° (Desde {start_heading:.1f}° hacia {target:.1f}°)...")
    
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
    print(f"   [GYRO] Giro finalizado. Angulo actual: {current_heading:.1f}°")

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
#  LOOP PRINCIPAL
# ================================================================
servo_angle(90)  # Acomodar servo al frente antes de iniciar
time.sleep_ms(500)

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
        stop(); continue

    update_heading() # Mantener giroscopio actualizado en el bucle principal

    # --- DHT22 (Temperatura de Bateria cada 5s) ---
    now_ms = time.ticks_ms()
    if time.ticks_diff(now_ms, last_dht_time) > 5000:
        last_dht_time = now_ms
        try:
            dht_sensor.measure()
            temp = dht_sensor.temperature()
            hum = dht_sensor.humidity()
            print("[BATERIA] Temp: " + str(temp) + "°C | Hum: " + str(hum) + "%")
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