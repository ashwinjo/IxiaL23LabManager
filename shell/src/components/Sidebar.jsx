import { NAV_ITEMS, getToolById } from '../config/tools'
import './Sidebar.css'

export default function Sidebar({ activeId, onNavigate, onPopOut }) {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id
          const tool = item.type === 'tool' ? getToolById(item.id) : null
          return (
            <div key={item.id} className={`nav-row ${isActive ? 'active' : ''}`}>
              <button
                type="button"
                className="nav-link"
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
              </button>
              {tool && (
                <button
                  type="button"
                  className="pop-out-btn"
                  title={`Open ${tool.name} in new tab`}
                  onClick={() => onPopOut(tool)}
                  aria-label={`Pop out ${tool.shortName}`}
                >
                  ↗
                </button>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
