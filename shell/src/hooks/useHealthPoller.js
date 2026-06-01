import { useCallback, useEffect, useRef, useState } from 'react'
import { BRIAN, TOOLS } from '../config/tools'

const POLL_INTERVAL_MS = 30_000
const FETCH_TIMEOUT_MS = 5_000

async function checkHealth(target) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(target.healthUrl, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    })
    clearTimeout(timer)
    return {
      status: res.ok ? 'up' : 'down',
      httpStatus: res.status,
      checkedAt: new Date(),
    }
  } catch {
    clearTimeout(timer)
    return { status: 'down', httpStatus: 0, checkedAt: new Date() }
  }
}

export function useHealthPoller(mcpServers = []) {
  const [health, setHealth] = useState(() => ({
    ...Object.fromEntries(TOOLS.map((t) => [t.id, { status: 'pending', checkedAt: null }])),
    brian: { status: 'pending', checkedAt: null },
  }))
  const [polling, setPolling] = useState(false)
  const mounted = useRef(true)

  const pollAll = useCallback(async () => {
    setPolling(true)
    const mcpIds = mcpServers.map((m) => m.id)
    setHealth((prev) => {
      const next = { ...prev }
      TOOLS.forEach((t) => {
        next[t.id] = { ...next[t.id], status: 'pending' }
      })
      next.brian = { ...(next.brian || {}), status: 'pending' }
      mcpIds.forEach((id) => {
        next[id] = { ...(next[id] || {}), status: 'pending' }
      })
      return next
    })

    const toolResults = await Promise.all(
      TOOLS.map(async (tool) => [tool.id, await checkHealth(tool)]),
    )
    const brianResult = await checkHealth(BRIAN)
    const mcpResults = await Promise.all(
      mcpServers.map(async (mcp) => [mcp.id, await checkHealth(mcp)]),
    )

    if (!mounted.current) return
    setHealth((prev) => {
      const next = { ...prev }
      toolResults.forEach(([id, result]) => {
        next[id] = result
      })
      next.brian = brianResult
      mcpResults.forEach(([id, result]) => {
        next[id] = result
      })
      return next
    })
    setPolling(false)
  }, [mcpServers])

  useEffect(() => {
    mounted.current = true
    pollAll()
    const id = setInterval(pollAll, POLL_INTERVAL_MS)
    return () => {
      mounted.current = false
      clearInterval(id)
    }
  }, [pollAll])

  return { health, polling, refreshAll: pollAll }
}
