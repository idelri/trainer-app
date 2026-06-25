import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

function Indicador({ titulo, valor, subtitulo, color, enDesarrollo }) {
  return (
    <div className="card" style={{ padding: '16px', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titulo}</span>
        {enDesarrollo && (
          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', background: 'var(--bg2)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>en desarrollo</span>
        )}
      </div>
      {valor !== null ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text)', fontFamily: 'var(--mono)' }}>{valor}</div>
          {subtitulo && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{subtitulo}</div>}
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Sin datos suficientes</div>
      )}
    </div>
  )
}

export default function PanelFuerzaSalud({ clienteId, planificacion }) {
  const [semanas, setSemanas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clienteId && planificacion) cargarDatos()
  }, [clienteId, planificacion])

  async function cargarDatos() {
    setLoading(true)
    const inicio = parseISO(planificacion.fecha_inicio)
    const fin = parseISO(planificacion.fecha_fin)

    const { data: sesiones } = await supabase
      .from('sesiones')
      .select('*, sesion_feedback(*)')
      .eq('cliente_id', clienteId)
      .not('fecha', 'is', null)
      .gte('fecha', planificacion.fecha_inicio)
      .lte('fecha', planificacion.fecha_fin)
      .order('fecha')

    const semanasMap = {}
    ;(sesiones || []).forEach(s => {
      const fechaSes = parseISO(s.fecha)
      const lunes = startOfWeek(fechaSes, { weekStartsOn: 1 })
      const key = format(lunes, 'yyyy-MM-dd')
      if (!semanasMap[key]) semanasMap[key] = { lunes, sesiones: [] }
      semanasMap[key].sesiones.push(s)
    })

    const semanasCalc = Object.values(semanasMap).map(({ lunes, sesiones }) => {
      const planificadas = sesiones.length
      let realizadas = 0
      let cargaTotal = 0
      let conDolor = 0
      let conFeedback = 0

      sesiones.forEach(s => {
        const fb = s.sesion_feedback?.[0]?.data
        if (fb) {
          conFeedback++
          const status = fb.completion?.status
          if (status === 'completed') realizadas += 1
          else if (status === 'partial') realizadas += 0.5
          const duracion = fb.duration?.minutes
          const rpe = fb.rpe?.value
          if (duracion && rpe != null) cargaTotal += duracion * rpe
          if (fb.pain?.hasPain) conDolor++
        }
      })

      const adherencia = conFeedback > 0 ? Math.round((realizadas / planificadas) * 100) : null
      const carga = cargaTotal > 0 ? Math.round(cargaTotal) : null
      const tolerancia = conFeedback > 0 ? Math.round(((conFeedback - conDolor) / conFeedback) * 100) : null

      return {
        key: format(lunes, 'dd MMM', { locale: es }),
        planificadas,
        realizadas,
        adherencia,
        carga,
        tolerancia,
        conFeedback,
      }
    })

    setSemanas(semanasCalc)
    setLoading(false)
  }

  if (loading) return <div className="empty"><p>Cargando datos de seguimiento...</p></div>
  if (!semanas.length) return null

  const ultimaSemana = semanas[semanas.length - 1]
  const adherenciaColor = ultimaSemana.adherencia >= 80 ? '#2d8a5f' : ultimaSemana.adherencia >= 50 ? '#d68910' : '#c0392b'

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)', marginBottom: 12 }}>
        Seguimiento — Fuerza y salud
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Indicador
          titulo="Adherencia semana actual"
          valor={ultimaSemana.adherencia !== null ? `${ultimaSemana.adherencia}%` : null}
          subtitulo={ultimaSemana.conFeedback > 0 ? `${ultimaSemana.realizadas} de ${ultimaSemana.planificadas} sesiones completadas` : 'Sin feedback registrado'}
          color={adherenciaColor}
        />
        <Indicador
          titulo="Carga semana actual"
          valor={ultimaSemana.carga !== null ? `${ultimaSemana.carga} UA` : null}
          subtitulo="Duración × RPE (unidades arbitrarias)"
          color="#3b82f6"
        />
        <Indicador
          titulo="Tolerancia al ejercicio"
          valor={ultimaSemana.tolerancia !== null ? `${ultimaSemana.tolerancia}%` : null}
          subtitulo="Sesiones sin molestias reportadas"
          color="#8b5cf6"
          enDesarrollo
        />
      </div>

      {semanas.length > 1 && (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Evolución semanal</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Semana</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Sesiones</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Adherencia</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Carga (UA)</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Tolerancia</th>
                </tr>
              </thead>
              <tbody>
                {semanas.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)', fontSize: 11 }}>{s.key}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11 }}>{s.realizadas}/{s.planificadas}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: s.adherencia >= 80 ? '#2d8a5f' : s.adherencia >= 50 ? '#d68910' : s.adherencia !== null ? '#c0392b' : 'var(--text3)' }}>
                      {s.adherencia !== null ? `${s.adherencia}%` : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11 }}>
                      {s.carga !== null ? s.carga : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                      {s.tolerancia !== null ? `${s.tolerancia}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
