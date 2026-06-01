import { useState } from 'react'
import { getToolById, isBrian } from './config/tools'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import IframeView from './components/IframeView'
import ConfigView from './components/ConfigView'
import LabAssistantView from './components/LabAssistantView'
import { useHealthPoller } from './hooks/useHealthPoller'
import { useMcpServers } from './hooks/useMcpServers'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const [activeId, setActiveId] = useState('home')
  const { servers: mcpServers, reload: reloadMcpServers } = useMcpServers()
  const { health, polling, refreshAll } = useHealthPoller(mcpServers)
  const { isDay, toggleTheme } = useTheme()

  const activeTool = getToolById(activeId)
  const showConfig = activeId === 'home'
  const showBrian = isBrian(activeId)

  const handlePopOut = (tool) => {
    window.open(tool.uiUrl, '_blank', 'noopener,noreferrer')
  }

  const handleRefreshAll = async () => {
    await reloadMcpServers()
    await refreshAll()
  }

  return (
    <div className="app-layout">
      <Header
        health={health}
        mcpServers={mcpServers}
        polling={polling}
        onRefresh={handleRefreshAll}
        onSelectTool={setActiveId}
        isDay={isDay}
        onToggleTheme={toggleTheme}
      />
      <div className="app-body">
        <Sidebar activeId={activeId} onNavigate={setActiveId} onPopOut={handlePopOut} />
        <main className="main-content">
          {showConfig && <ConfigView onMcpChange={reloadMcpServers} />}
          {activeTool && (
            <IframeView url={activeTool.uiUrl} title={activeTool.name} />
          )}
          {showBrian && (
            <LabAssistantView mcpHealth={health} mcpServers={mcpServers} brianHealth={health.brian} />
          )}
        </main>
      </div>
    </div>
  )
}
