import { TOOLS } from '../config/tools'
import './Header.css'

function formatTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString()
}

function StatusDot({ status }) {
  const cls =
    status === 'up' ? 'dot green' : status === 'pending' ? 'dot yellow' : 'dot red'
  return <span className={cls} aria-hidden />
}

export default function Header({ health, polling, onRefresh, onSelectTool }) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <strong>IxiaL23LabManager</strong>
      </div>
      <div className="health-indicators">
        {TOOLS.map((tool) => {
          const h = health[tool.id] || { status: 'pending', checkedAt: null }
          return (
            <button
              key={tool.id}
              type="button"
              className="health-chip"
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.name} — last checked ${formatTime(h.checkedAt)}`}
            >
              <StatusDot status={h.status} />
              <span className="chip-name">{tool.shortName}</span>
              <span className="chip-time">{formatTime(h.checkedAt)}</span>
            </button>
          )
        })}
      </div>
      <button type="button" className="refresh-btn" onClick={onRefresh} disabled={polling}>
        {polling ? 'Refreshing…' : 'Refresh All'}
      </button>
    </header>
  )
}
