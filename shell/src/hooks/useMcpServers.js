import { useCallback, useEffect, useRef, useState } from 'react'
import { listMcpServers } from '../lib/api'

export function useMcpServers() {
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mounted = useRef(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await listMcpServers()
    if (!mounted.current) return res
    if (res.ok) {
      setServers(res.servers)
    } else {
      setServers([])
      setError(res.message || 'Brian backend unavailable')
    }
    setLoading(false)
    return res
  }, [])

  useEffect(() => {
    mounted.current = true
    reload()
    return () => {
      mounted.current = false
    }
  }, [reload])

  return { servers, loading, error, reload }
}
