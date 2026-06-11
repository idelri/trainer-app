import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)
@media print {
  .sidebar { display: none !important; }
  .page-header .btn { display: none !important; }
  .app-layout { display: block !important; }
  .main { padding: 0 !important; }
  .btn { display: none !important; }
  .modal-backdrop { display: none !important; }
  select, .form-select { display: none !important; }
  .flex.gap-3.items-center { display: none !important; }
  body { background: white !important; }
  .card { box-shadow: none !important; border: 1px solid #ddd !important; }
}
