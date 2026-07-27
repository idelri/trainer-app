-- ============================================================
-- MIGRACIÓN: nivel_aproximacion + actualización objetivo
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ============================================================

-- 1. Añadir columna nivel_aproximacion (si no existe ya)
ALTER TABLE ejercicios_biblioteca
ADD COLUMN IF NOT EXISTS nivel_aproximacion text[];

-- 2. Reemplazar valores de objetivo obsoletos por los nuevos
--    "Fuerza base" → "Fuerza"  |  "Fuerza específica" → "Fuerza"
UPDATE ejercicios_biblioteca
SET objetivo = (
  SELECT array_agg(
    CASE v
      WHEN 'Fuerza base' THEN 'Fuerza'
      WHEN 'Fuerza específica' THEN 'Fuerza'
      ELSE v
    END
  )
  FROM unnest(objetivo) AS v
)
WHERE objetivo && ARRAY['Fuerza base', 'Fuerza específica'];

-- Eliminar duplicados que puedan haber quedado (si un ejercicio tenía Fuerza base + Fuerza específica)
UPDATE ejercicios_biblioteca
SET objetivo = ARRAY(SELECT DISTINCT unnest(objetivo) ORDER BY 1)
WHERE array_length(objetivo, 1) > 1;

-- 3. Correcciones individuales de objetivo
UPDATE ejercicios_biblioteca SET objetivo = ARRAY['Resistencia muscular']
WHERE nombre IN ('Cinta inclinada', 'Elíptica');

UPDATE ejercicios_biblioteca SET objetivo = ARRAY['Técnica / Control motor']
WHERE nombre = 'Halos con disco';

-- 4. Asignar nivel_aproximacion por defecto según categoría de objetivo
UPDATE ejercicios_biblioteca SET nivel_aproximacion = CASE
  WHEN 'Movilidad / Flexibilidad' = ANY(objetivo) THEN ARRAY['0− · Complementario']
  WHEN 'Potencia / Velocidad' = ANY(objetivo)     THEN ARRAY['II · Dirigido']
  ELSE ARRAY['I · Fundamental']
END;

-- 5. Overrides: ejercicios de Técnica/Control motor que son 0− (activación/control aislado)
UPDATE ejercicios_biblioteca
SET nivel_aproximacion = ARRAY['0− · Complementario']
WHERE nombre IN (
  'Bird dog',
  'Clam shell dinámico',
  'Clam shell isometrico',
  'Clam shell isométrico',
  'Coactivación abdomen consciente',
  'Dead bug apretando rodilla unilateral',
  'Dead bug apretando rodillas',
  'Dead bug isométrico 2 manos',
  'Dead bug isométrico sólo 1 pierna',
  'Dead bug isométrico unilateral',
  'Deadbug + antiextension con goma',
  'Deadbug + antiextensión',
  'Descenso y Retracción escapular Anillas',
  'Ejercicio de báscula pélvica tumbado en el suelo',
  'Estabilidad tobillo sobre bosu',
  'Isometrico gluteo medio fitball contra pared',
  'Isométrico de glúteo medio con apoyo en pared con fitball o balón',
  'Pasos laterales con miniband',
  'Plank bird dog',
  'Rotación ext hombro en 90º con goma',
  'Rotación externa cadera miniband',
  'Rotación externa de hombro',
  'Abduciones de cadera en cuadrupedia',
  'Activación isquios en curve',
  'Dorsiflexión de tobillo',
  'Halos con disco',
  'Deadbug isométrico + deadbug dinámico piernas + anti ext goma'
);

-- 6. Overrides: ejercicios de Fuerza que son 0+ (trabajo analítico/aislado)
UPDATE ejercicios_biblioteca
SET nivel_aproximacion = ARRAY['0+ · General orientado']
WHERE nombre IN (
  'ABD cadera en polea',
  'ADD cadera en polea',
  'Abducción Lateral de Cadera',
  'Abduciones de cadera con goma',
  'Abduciones de cadera con miniband',
  'Abdución de cadera con goma',
  'Abdución de cadera en polea',
  'Aperturas con goma',
  'Aperturas horizontales con botellas de agua',
  'Curl bíceps goma',
  'Curl de bíceps en polea baja',
  'Curl de isquiosurales unilateral en polea baja',
  'Curl isquio con goma',
  'Elevaciones de talón',
  'Elevaciones talón',
  'Elevación de talones',
  'Elevaciones hombro goma',
  'Extensiones de rodilla con goma',
  'Extensión de tríceps en polea',
  'Musculatura cadera en máquina de pie',
  'Patada atrás con goma',
  'Patada glúteo con goma',
  'Tríceps en polea',
  'Copenhague isométrico',
  'Excéntrico cuádriceps',
  'Elevaciones de talón excéntrico unilateral',
  'Elíptica'
);

-- 7. Overrides: ejercicios de Fuerza específica que son II (combinaciones complejas)
UPDATE ejercicios_biblioteca
SET nivel_aproximacion = ARRAY['II · Dirigido']
WHERE nombre IN (
  'Leñador con disco',
  'Lunge a step elevando talón',
  'Lunge iso + pallof dinámico',
  'Lunge iso + press pallof',
  'PUENTE DE GLÚTEO + PRESS PALLOF',
  'Pallof con rotación en polea',
  'Peso muerto con hexagonal asimétrico',
  'Plan frontal + flex cadera',
  'Plancha alta y escalador',
  'Plancha frontal + paso lateral',
  'Plancha frontal con pies elevados sin una mano',
  'Plancha frontal inclinada + remo',
  'Plancha frontal quitando apoyos',
  'Plancha frontal quitando una mano',
  'Plancha lateral + tracción/remo con goma',
  'Plancha lateral isométrica de codo con pies + ABD de hombro con goma',
  'Press a un brazo con landmine arrodillado',
  'Press pallof desde lunge',
  'Press pallof ext de cadera',
  'Press vertical + tracción horizontal',
  'Puente glúteo + press pectoral',
  'Puente isometrico cadena larga unilateral + extension controlada con disco',
  'Puente isométrico de isquio unilateral y extensión brazos disco',
  'Puente unilateral + abdución de cadera',
  'Puente unilateral + flexión de cadera',
  'Reverse lunge + pallof',
  'Subir escalones de 2 en 2',
  'Zancadas Caminando con Saco',
  'Hip thrust iso + press unilat',
  'Desplazamiento lateral con miniband + press vertical',
  'Cinta inclinada'
);

-- 8. Verificación rápida (ejecutar después para comprobar)
-- SELECT objetivo, nivel_aproximacion, nombre FROM ejercicios_biblioteca ORDER BY objetivo, nivel_aproximacion, nombre;
-- SELECT COUNT(*) FROM ejercicios_biblioteca WHERE nivel_aproximacion IS NULL;
-- SELECT COUNT(*) FROM ejercicios_biblioteca WHERE 'Fuerza base' = ANY(objetivo) OR 'Fuerza específica' = ANY(objetivo);
