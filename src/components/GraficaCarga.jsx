import { useEffect, useRef, useState } from 'react'
import { Chart, BarController, LineController, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'

Chart.register(BarController, LineController, BarElement, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

const CZ1r = '#2d6a4f99', CZ3r = '#d6891099', CZ5r = '#c0392b99'
const CZ1o = '#2d6a4f22', CZ3o = '#d6891022', CZ5o = '#c0392b22'
const CKM  = '#3b82f6',   CKMo = '#94a3b8'

export default function GraficaCarga({ bloques, semanas, subbloques }) {
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  const [show, setShow] = useState({ intensReal: true, intensObj: true, kmReal: true, kmObj: true })
  const [agrup, setAgrup] = useState('semana')

  const allSems = Object.values(semanas).flat()
  const tieneDatos = allSems.some(s => s.zona1_2_real > 0 || s.zona3_4_real > 0 || s.zona5_real > 0 || s.km_real)

  function buildData() {
    if (agrup === 'semana') {
      const rows = []
      bloques.forEach(b => {
        const bSems = (semanas[b.id] || []).sort((a, z) => a.numero - z.numero)
        bSems.forEach(s => {
         const subsB = subbloques[b.id] || []
          const subDeSem = subsB.find(sb => s.numero >= sb.semana_inicio && s.numero <= sb.semana_fin)
          const totalObjMin = subDeSem ? (subDeSem.zona1_2 || 0) + (subDeSem.zona3_4 || 0) + (subDeSem.zona5 || 0) : 0
          const totalReal = (s.zona1_2_real || 0) + (s.zona3_4_real || 0) + (s.zona5_real || 0)
          const baseMin = totalReal || 200
          const oZ1v = subDeSem && totalObjMin > 0 ? Math.round((subDeSem.zona1_2 / totalObjMin) * baseMin) : 0
          const oZ3v = subDeSem && totalObjMin > 0 ? Math.round((subDeSem.zona3_4 / totalObjMin) * baseMin) : 0
          const oZ5v = subDeSem && totalObjMin > 0 ? Math.round((subDeSem.zona5 / totalObjMin) * baseMin) : 0
        const bIdx = bloques.findIndex(bb => bb.id === b.id)
          const subsB2 = subbloques[b.id] || []
          const subDeSem2 = subsB2.find(sb => s.numero >= sb.semana_inicio && s.numero <= sb.semana_fin)
          const sIdx2 = subsB2.findIndex(sb => sb.id === subDeSem2?.id)
          const subLabel = subDeSem2 ? ` ${bIdx+1}.${sIdx2+1}` : ''
          rows.push({
            label: `S${s.numero}${subLabel}`,
            rZ1: s.zona1_2_real || 0, rZ3: s.zona3_4_real || 0, rZ5: s.zona5_real || 0,
            oZ1: oZ1v, oZ3: oZ3v, oZ5: oZ5v,
            kmR: s.km_real || null, kmO: s.km_objetivo || null
          })
        })
      })
      return rows
    }
    if (agrup === 'subbloque') {
      const rows = []
      bloques.forEach((b, bIdx) => {
        const subsB = (subbloques[b.id] || []).sort((a, z) => a.semana_inicio - z.semana_inicio)
        const sems = semanas[b.id] || []
        subsB.forEach((sub, sIdx) => {
          const semsSub = sems.filter(s => s.numero >= sub.semana_inicio && s.numero <= sub.semana_fin)
          const totalObjMin = (sub.zona1_2 || 0) + (sub.zona3_4 || 0) + (sub.zona5 || 0)
          const totalReal = semsSub.reduce((a, s) => a + (s.zona1_2_real || 0) + (s.zona3_4_real || 0) + (s.zona5_real || 0), 0)
          const base = totalReal || 200
          rows.push({
            label: `${bIdx + 1}.${sIdx + 1} ${sub.nombre.slice(0, 8)}`,
            rZ1: semsSub.reduce((a, s) => a + (s.zona1_2_real || 0), 0),
            rZ3: semsSub.reduce((a, s) => a + (s.zona3_4_real || 0), 0),
            rZ5: semsSub.reduce((a, s) => a + (s.zona5_real || 0), 0),
            oZ1: totalObjMin > 0 ? Math.round((sub.zona1_2 / totalObjMin) * base) : 0,
            oZ3: totalObjMin > 0 ? Math.round((sub.zona3_4 / totalObjMin) * base) : 0,
            oZ5: totalObjMin > 0 ? Math.round((sub.zona5 / totalObjMin) * base) : 0,
            kmR: semsSub.some(s => s.km_real) ? semsSub.reduce((a, s) => a + (s.km_real || 0), 0) : null,
            kmO: semsSub.some(s => s.km_objetivo) ? semsSub.reduce((a, s) => a + (s.km_objetivo || 0), 0) : null,
          })
        })
      })
      return rows
    }
    return bloques.map(b => {
      const sems = semanas[b.id] || []
      return {
        label: b.nombre.slice(0, 12),
        rZ1: sems.reduce((a, x) => a + (x.zona1_2_real || 0), 0),
        rZ3: sems.reduce((a, x) => a + (x.zona3_4_real || 0), 0),
        rZ5: sems.reduce((a, x) => a + (x.zona5_real || 0), 0),
      oZ1: (() => {
          const subsB = subbloques[b.id] || []
          const sems = semanas[b.id] || []
          return sems.reduce((acc, s) => {
            const sub = subsB.find(sb => s.numero >= sb.semana_inicio && s.numero <= sb.semana_fin)
            if (!sub) return acc
            const tot = (sub.zona1_2||0)+(sub.zona3_4||0)+(sub.zona5||0)
            if (!tot) return acc
            const base = (s.zona1_2_real||0)+(s.zona3_4_real||0)+(s.zona5_real||0) || 200
            return acc + Math.round((sub.zona1_2/tot)*base)
          }, 0)
        })(),
        oZ3: (() => {
          const subsB = subbloques[b.id] || []
          const sems = semanas[b.id] || []
          return sems.reduce((acc, s) => {
            const sub = subsB.find(sb => s.numero >= sb.semana_inicio && s.numero <= sb.semana_fin)
            if (!sub) return acc
            const tot = (sub.zona1_2||0)+(sub.zona3_4||0)+(sub.zona5||0)
            if (!tot) return acc
            const base = (s.zona1_2_real||0)+(s.zona3_4_real||0)+(s.zona5_real||0) || 200
            return acc + Math.round((sub.zona3_4/tot)*base)
          }, 0)
        })(),
        oZ5: (() => {
          const subsB = subbloques[b.id] || []
          const sems = semanas[b.id] || []
          return sems.reduce((acc, s) => {
            const sub = subsB.find(sb => s.numero >= sb.semana_inicio && s.numero <= sb.semana_fin)
            if (!sub) return acc
            const tot = (sub.zona1_2||0)+(sub.zona3_4||0)+(sub.zona5||0)
            if (!tot) return acc
            const base = (s.zona1_2_real||0)+(s.zona3_4_real||0)+(s.zona5_real||0) || 200
            return acc + Math.round((sub.zona5/tot)*base)
          }, 0)
        })(),
        kmR: sems.some(s => s.km_real) ? sems.reduce((a, x) => a + (x.km_real || 0), 0) : null,
        kmO: sems.some(s => s.km_objetivo) ? sems.reduce((a, x) => a + (x.km_objetivo || 0), 0) : null,
      }
    })
  }

  useEffect(() => {
    if (!tieneDatos || !canvasRef.current) return
    const data = buildData()
    if (!data.length) return

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

   const pctPlugin = {
      id: 'pctLabels',
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx
        data.forEach((d, i) => {
          const tReal = d.rZ1 + d.rZ3 + d.rZ5
          const tObj  = d.oZ1 + d.oZ3 + d.oZ5

        const objColors = ['#1a5e38', '#8a5400', '#8b1a1a']
          ;[
            { metas: [0,1,2], vals: [d.rZ1, d.rZ3, d.rZ5], total: tReal, textColor: null },
            { metas: [3,4,5], vals: [d.oZ1, d.oZ3, d.oZ5], total: tObj,  textColor: 'byZone' },
          ].forEach(({ metas, vals, total, textColor }) => {
            if (!total) return
            metas.forEach((mi, vi) => {
              const meta = chart.getDatasetMeta(mi)
              if (meta.hidden) return
              const bar = meta.data[i]
              if (!bar) return
              const pct = Math.round((vals[vi] / total) * 100)
              if (pct < 8) return
              const barH = Math.abs(bar.base - bar.y)
              if (barH < 14) return
              ctx.save()
              ctx.fillStyle = textColor === 'byZone' ? objColors[vi] : '#fff'
              ctx.font = '500 9px sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(pct + '%', bar.x, bar.y + barH / 2)
              ctx.restore()
            })
          })
          ;[
            { dsIdx: 6, val: d.kmR, color: CKM },
            { dsIdx: 7, val: d.kmO, color: CKMo },
          ].forEach(({ dsIdx, val, color }) => {
            if (!val) return
            const meta = chart.getDatasetMeta(dsIdx)
            if (meta.hidden) return
            const pt = meta.data[i]
            if (!pt) return
            ctx.save()
            ctx.fillStyle = color
            ctx.font = '500 9px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.fillText(val + ' km', pt.x, pt.y - 5)
            ctx.restore()
          })
        })
      }
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      plugins: [pctPlugin],
      data: {
        labels: data.map(d => d.label),
        datasets: [
          { label: 'Z1-Z2 real', data: data.map(d => d.rZ1), backgroundColor: CZ1r, borderWidth: 0, stack: 'real', yAxisID: 'y', hidden: !show.intensReal },
          { label: 'Z3-Z4 real', data: data.map(d => d.rZ3), backgroundColor: CZ3r, borderWidth: 0, stack: 'real', yAxisID: 'y', hidden: !show.intensReal },
          { label: 'Z5+ real',   data: data.map(d => d.rZ5), backgroundColor: CZ5r, borderWidth: 0, borderRadius: 3, stack: 'real', yAxisID: 'y', hidden: !show.intensReal },
          { label: 'Z1-Z2 obj', data: data.map(d => d.oZ1), backgroundColor: CZ1o, borderColor: '#2d6a4f', borderWidth: 1.5, stack: 'obj', yAxisID: 'y', hidden: !show.intensObj },
          { label: 'Z3-Z4 obj', data: data.map(d => d.oZ3), backgroundColor: CZ3o, borderColor: '#d68910', borderWidth: 1.5, stack: 'obj', yAxisID: 'y', hidden: !show.intensObj },
          { label: 'Z5+ obj',   data: data.map(d => d.oZ5), backgroundColor: CZ5o, borderColor: '#c0392b', borderWidth: 1.5, borderRadius: 3, stack: 'obj', yAxisID: 'y', hidden: !show.intensObj },
          { label: 'km real', data: data.map(d => d.kmR), type: 'line', borderColor: CKM, borderWidth: 2, pointBackgroundColor: CKM, pointRadius: 4, fill: false, yAxisID: 'y2', tension: 0.3, spanGaps: true, hidden: !show.kmReal },
          { label: 'km objetivo', data: data.map(d => d.kmO), type: 'line', borderColor: CKMo, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 3, pointBackgroundColor: '#fff', pointBorderColor: CKMo, pointBorderWidth: 1.5, fill: false, yAxisID: 'y2', tension: 0.3, spanGaps: true, hidden: !show.kmObj },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: item => {
            if (item.dataset.yAxisID === 'y2') return `${item.dataset.label}: ${item.raw} km`
            const stackKey = item.dataset.stack
            const dsIdxStart = stackKey === 'real' ? 0 : 3
            const d = data[item.dataIndex]
            const vals = stackKey === 'real' ? [d.rZ1, d.rZ3, d.rZ5] : [d.oZ1, d.oZ3, d.oZ5]
            const total = vals.reduce((s, v) => s + v, 0)
            const pct = total ? Math.round((item.raw / total) * 100) : 0
            return `${item.dataset.label}: ${pct}%`
          }}}
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
          y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { font: { size: 10 } }, title: { display: true, text: 'min', font: { size: 10 }, color: '#888' }, position: 'left' },
          y2: { grid: { display: false }, ticks: { font: { size: 10 }, color: CKM }, title: { display: true, text: 'km', font: { size: 10 }, color: CKM }, position: 'right' }
        }
      }
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [show, agrup, bloques, semanas])

  if (!tieneDatos) return null

  const Toggle = ({ id, label, dotStyle }) => (
    <button onClick={() => setShow(s => ({ ...s, [id]: !s[id] }))}
      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '0.5px solid var(--border)', background: show[id] ? 'var(--bg2)' : 'var(--bg)', color: show[id] ? 'var(--text)' : 'var(--text3)', cursor: 'pointer' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, ...dotStyle }} />
      {label}
    </button>
  )

  return (
    <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)' }}>Gráfica evolución de carga</span>
        <div style={{ display: 'flex', gap: 4 }}>
         {['semana', 'subbloque', 'bloque'].map(a => (
            <button key={a} onClick={() => setAgrup(a)}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '0.5px solid var(--border)', background: agrup === a ? 'var(--bg2)' : 'var(--bg)', fontWeight: agrup === a ? 600 : 400, color: 'var(--text2)', cursor: 'pointer' }}>
              {a === 'semana' ? 'Semana' : a === 'subbloque' ? 'Sub bloque' : 'Bloque'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <Toggle id="intensReal" label="Intensidad real" dotStyle={{ background: '#d68910' }} />
        <Toggle id="intensObj"  label="Intensidad obj"  dotStyle={{ background: 'transparent', border: '1px dashed #d68910' }} />
        <Toggle id="kmReal"     label="Km real"         dotStyle={{ background: CKM }} />
        <Toggle id="kmObj"      label="Km objetivo"     dotStyle={{ background: 'transparent', border: `1px dashed ${CKMo}` }} />
      </div>

      <div style={{ position: 'relative', width: '100%', height: 260 }}>
        <canvas ref={canvasRef} role="img" aria-label="Gráfica de evolución de carga de entrenamiento">Datos de carga de entrenamiento.</canvas>
      </div>
    </div>
  )
}
