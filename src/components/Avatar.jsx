export default function Avatar({ url, nombre, size = 36, style: extraStyle = {} }) {
  const iniciales = nombre
    ? nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?'

  const base = {
    width: size, height: size, borderRadius: '50%',
    flexShrink: 0, objectFit: 'cover', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    ...extraStyle,
  }

  if (url) {
    return (
      <img
        src={url} alt={nombre || ''}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
        style={{ ...base, objectFit: 'cover' }}
      />
    )
  }

  return (
    <div style={{
      ...base,
      background: 'var(--accent-light)',
      color: 'var(--accent-text)',
      fontSize: Math.round(size * 0.36),
      fontWeight: 600,
      letterSpacing: '-0.5px',
      fontFamily: 'var(--font)',
    }}>
      {iniciales}
    </div>
  )
}
