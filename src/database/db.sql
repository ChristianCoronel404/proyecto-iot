-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.gy50_data (
  id bigint NOT NULL DEFAULT nextval('gy50_data_id_seq'::regclass),
  gyro_x numeric NOT NULL,
  gyro_y numeric NOT NULL,
  gyro_z numeric NOT NULL,
  raw_x integer,
  raw_y integer,
  raw_z integer,
  dispositivo_id bigint,
  fecha date DEFAULT CURRENT_DATE,
  hora time without time zone DEFAULT CURRENT_TIME,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT gy50_data_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dht22_data (
  id bigint NOT NULL DEFAULT nextval('dht22_data_id_seq'::regclass),
  temperatura numeric NOT NULL,
  humedad numeric NOT NULL,
  dispositivo_id bigint,
  fecha date DEFAULT CURRENT_DATE,
  hora time without time zone DEFAULT CURRENT_TIME,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dht22_data_pkey PRIMARY KEY (id)
);
CREATE TABLE public.hcsr04_data (
  id bigint NOT NULL DEFAULT nextval('hcsr04_data_id_seq'::regclass),
  tiempo_echo integer NOT NULL,
  distancia_cm numeric,
  dispositivo_id bigint,
  fecha date DEFAULT CURRENT_DATE,
  hora time without time zone DEFAULT CURRENT_TIME,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  distancia_izq_cm numeric,
  distancia_der_cm numeric,
  distancia_movil_cm numeric,
  angulo_servo smallint CHECK (angulo_servo >= 0 AND angulo_servo <= 180),
  CONSTRAINT hcsr04_data_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuarios (
  id bigint NOT NULL DEFAULT nextval('usuarios_id_seq'::regclass),
  username character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  rol character varying DEFAULT 'user'::character varying,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.auditoria (
  id bigint NOT NULL DEFAULT nextval('auditoria_id_seq'::regclass),
  usuario_id bigint,
  accion character varying NOT NULL,
  tabla_afectada character varying,
  registro_id bigint,
  descripcion text,
  fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT auditoria_pkey PRIMARY KEY (id),
  CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.dispositivos (
  id integer NOT NULL DEFAULT nextval('dispositivos_id_seq'::regclass),
  nombre character varying NOT NULL,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dispositivos_pkey PRIMARY KEY (id)
);