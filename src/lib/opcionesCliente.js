// Opciones compartidas entre CuestionarioInicial y PerfilEditor
// NO modificar sin asegurarse de que CuestionarioInicial sigue funcionando igual

export const OTRO = 'Otro (especificar)'

export const OBJETIVOS = [
  'Mejorar mi salud y condición física general',
  'Ganar fuerza',
  'Ganar masa muscular',
  'Perder grasa',
  'Mejorar mi resistencia',
  'Preparar una competición o reto deportivo',
  'Mejorar el rendimiento en mi deporte',
  'Reducir molestias o prevenir lesiones',
  'Recuperar la confianza después de una lesión',
  'Crear una rutina de entrenamiento',
]

export const DEPORTES = [
  'Running / atletismo','Ciclismo','Natación','Triatlón','Fútbol','Fútbol sala',
  'Baloncesto','Tenis','Pádel','Balonmano','Voleibol','Rugby',
  'Artes marciales / boxeo','Crossfit','Gimnasia / acrobacia','Escalada',
  'Esquí / snowboard','Golf','Yoga','Pilates','Baile / danza','Senderismo',
  'Entrenamiento en sala (gym)','Ninguno actualmente',
]
export const DEPORTES_SIN_FREQ = ['Ninguno actualmente']
export const FREC_ACT_OPTS = ['1 día/sem','2 días/sem','3 días/sem','4 días/sem','5+ días/sem']
export const EXP = [
  'Sin experiencia',
  'Principiante (menos de 1 año)',
  'Intermedio (1–3 años)',
  'Avanzado (más de 3 años)',
]
export const FRECUENCIA = [
  'No entreno actualmente','1–2 días/semana','3–4 días/semana',
  '5–6 días/semana','Todos los días','Irregular, sin rutina fija',
]
export const DURACION = [
  'Menos de 30 min','30–45 min','45–60 min','60–90 min','Más de 90 min','Variable',
]
export const PREFERENCIA_ENTRENO = [
  'Solo/a','Acompañado/a','En grupo','En interior','Al aire libre','Sin preferencia',
]
export const TIPOS_ENTRENO = [
  'Entrenamiento de fuerza','Cardio / resistencia','HIIT / circuitos',
  'Movilidad / flexibilidad','Actividades deportivas','Competición','Ninguno en particular',
]
export const DIAS_ABR  = ['L','M','X','J','V','S','D']
export const DIAS_FULL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
export const DIAS_OPTS = [
  '1 día','2 días','3 días','4 días','5 días','6 días','7 días','Variable según la semana',
]
export const TIEMPO = [
  'Menos de 30 min','30–45 min','45–60 min','60–90 min','Más de 90 min','Variable',
]
export const HORARIOS = [
  'Primera hora de la mañana (antes de 8h)','Mañana (8h–12h)',
  'Mediodía (12h–15h)','Tarde (15h–19h)','Noche (19h–22h)','Sin preferencia',
]
export const LUGARES = [
  'En casa','Gimnasio','Aire libre (parque, calle, monte...)','Piscina',
  'Pista deportiva / campo','Trabajo / empresa','Varios lugares',
]
export const MAT_CASA = [
  'Sin material','Esterilla','Mancuernas','Kettlebells','Barra y discos',
  'Bandas elásticas','TRX / entrenamiento en suspensión','Barra de dominadas (puerta)',
  'Banco','Cajón / step','Foam roller','Bicicleta estática','Cinta de correr',
  'Remoergómetro','Balón medicinal',
]
export const WEARABLE_MARCAS = ['Garmin','Apple Watch','Polar','COROS','Suunto','Huawei','Whoop']
export const SUENO = ['Menos de 5 h','5–6 h','6–7 h','7–8 h','Más de 8 h']
export const TRABAJO = [
  'Principalmente sedentario (oficina, ordenador)',
  'Mixto (alterno estar de pie y sentado)',
  'Activo (de pie o caminando la mayor parte)',
  'Físicamente exigente (trabajo manual, cargas...)',
]
export const PASOS = [
  'Menos de 3.000 pasos','3.000–6.000 pasos','6.000–10.000 pasos',
  'Más de 10.000 pasos','No lo controlo',
]
export const TABACO = ['No fumo','Exfumador/a','Fumador/a ocasional','Fumador/a habitual']
export const BARRERAS_OPTS = [
  'Falta de tiempo','Horarios cambiantes','Trabajo','Responsabilidades familiares',
  'Cansancio','Molestias o dolor','Viajes','Motivación / constancia',
  'No creo que tenga grandes dificultades',
]
export const ANTECEDENTES_OPTS = [
  'Lesiones anteriores relevantes',
  'Operaciones o intervenciones previas',
  'Enfermedad o diagnóstico médico relevante',
  'Medicación que pueda afectar al entrenamiento',
  'Restricciones o indicaciones médicas',
  'Ninguno',
]
export const ESTADO_COMP_LABEL = {
  pendiente: 'Próxima / Pendiente',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}
