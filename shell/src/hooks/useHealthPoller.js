import { useCallback, useEffect, useRef, useState } from 'react'
import { TOOLS } from '../config/tools'

const POLL_INTERVAL_MS = 30_000
const FETCH_TIMEOUT_MS = 5_000

async function checkToolHealth(tool) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(tool.healthUrl, {
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

export function useHealthPoller() {
  const [health, setHealth] = useState(() =>
    Object.fromEntries(TOOLS.map((t) => [t.id, { status: 'pending', checkedAt: null }])),
  )
  const [polling, setPolling] = useState(false)
  const mounted = useRef(true)

  const pollAll = useCallback(async () => {
    setPolling(true)
    setHealth((prev) => {
      const next = { ...prev }
      TOOLS.forEach((t) => {
        next[t.id] = { ...next[t.id], status: 'pending' }
      })
      return next
    })

    const results = await Promise.all(
      TOOLS.map(async (tool) => {
        const result = await checkToolHealth(tool)
        return [tool.id, result]
      }),
    )

    if (!mounted.current) return
    setHealth((prev) => {
      const next = { ...prev }
      results.forEach(([id, result]) => {
        next[id] = result
      })
      return next
    })
    setPolling(false)
  }, [])

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
