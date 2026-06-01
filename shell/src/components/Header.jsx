import { BRIAN, TOOLS } from '../config/tools'
import './Header.css'

function formatTime(date) {
  if (!date) return '—'
  return date.toLocaleTimeString()
}

function StatusDot({ status }) {
  const cls =
    status === 'up' ? 'dot dot-healthy' : status === 'pending' ? 'dot dot-degraded' : 'dot dot-error'
  return <span className={cls} aria-hidden />
}

function aggregateMcpStatus(health, mcpServers) {
  if (!mcpServers.length) {
    return health.brian?.status || 'pending'
  }
  const statuses = mcpServers.map((m) => health[m.id]?.status || 'pending')
  if (statuses.every((s) => s === 'up')) return 'up'
  if (statuses.some((s) => s === 'up')) return 'pending'
  if (statuses.every((s) => s === 'pending')) return 'pending'
  return 'down'
}

function latestMcpCheck(health, mcpServers) {
  const times = [
    health.brian?.checkedAt,
    ...mcpServers.map((m) => health[m.id]?.checkedAt),
  ].filter(Boolean)
  if (!times.length) return null
  return new Date(Math.max(...times.map((d) => d.getTime())))
}

export default function Header({
  health,
  mcpServers = [],
  polling,
  onRefresh,
  onSelectTool,
  isDay,
  onToggleTheme,
}) {
  const brianStatus = aggregateMcpStatus(health, mcpServers)
  const brianCheckedAt = latestMcpCheck(health, mcpServers)

  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="brand-mark" aria-hidden>
          <span className="brand-ixia">Ixia</span>
          <span className="brand-rest">L23</span>
        </span>
        <div className="brand-text">
          <h1 className="brand-title">Lab Manager</h1>
          <span className="brand-sub">Ixia L2–L3 unified shell</span>
        </div>
      </div>

      <div className="health-indicators">
        {TOOLS.map((tool) => {
          const h = health[tool.id] || { status: 'pending', checkedAt: null }
          return (
            <button
              key={tool.id}
              type="button"
              className="health-chip header-btn"
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.name} — last checked ${formatTime(h.checkedAt)}`}
            >
              <StatusDot status={h.status} />
              <span className="chip-name">{tool.shortName}</span>
              <span className="chip-time">{formatTime(h.checkedAt)}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="health-chip header-btn health-chip-brian"
          onClick={() => onSelectTool(BRIAN.id)}
          title={`${BRIAN.name} — MCP status — last checked ${formatTime(brianCheckedAt)}`}
        >
          <StatusDot status={brianStatus} />
          <span className="chip-name">{BRIAN.shortName}</span>
          <span className="chip-time">{formatTime(brianCheckedAt)}</span>
        </button>
      </div>

      <div className="header-actions">
        <button type="button" className="header-btn theme-toggle" onClick={onToggleTheme}>
          {isDay ? 'Dark' : 'Day'}
        </button>
        <button
          type="button"
          className="header-btn refresh-btn"
          onClick={onRefresh}
          disabled={polling}
        >
          {polling ? 'Refreshing…' : 'Refresh All'}
        </button>
      </div>
    </header>
  )
}
