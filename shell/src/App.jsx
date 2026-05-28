import { useState } from 'react'
import { getToolById } from './config/tools'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import IframeView from './components/IframeView'
import ConfigView from './components/ConfigView'
import { useHealthPoller } from './hooks/useHealthPoller'

export default function App() {
  const [activeId, setActiveId] = useState('home')
  const { health, polling, refreshAll } = useHealthPoller()

  const activeTool = getToolById(activeId)
  const showConfig = activeId === 'home'

  const handlePopOut = (tool) => {
    window.open(tool.uiUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="app-layout">
      <Header
        health={health}
        polling={polling}
        onRefresh={refreshAll}
        onSelectTool={setActiveId}
      />
      <div className="app-body">
        <Sidebar activeId={activeId} onNavigate={setActiveId} onPopOut={handlePopOut} />
        <main className="main-content">
          {showConfig && <ConfigView />}
          {activeTool && (
            <IframeView url={activeTool.uiUrl} title={activeTool.name} />
          )}
        </main>
      </div>
    </div>
  )
}
