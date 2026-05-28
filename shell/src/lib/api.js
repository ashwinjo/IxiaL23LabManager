import { TOOLS } from '../config/tools'

const T1 = TOOLS[0].backendUrl
const T2 = TOOLS[1].backendUrl

function isValidIpv4(ip) {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const n = Number(p)
    return Number.isInteger(n) && n >= 0 && n <= 255
  })
}

export function validateChassisForm({ chassisIp, username, password }) {
  const errors = []
  if (!chassisIp?.trim()) errors.push('Chassis IP is required')
  else if (!isValidIpv4(chassisIp)) errors.push('Invalid IPv4 address')
  if (!username?.trim()) errors.push('Username is required')
  if (!password) errors.push('Password is required')
  return errors
}

/** T1: upload validates format and persists (no separate probe API). */
export async function testT1Connection({ chassisIp, username, password }) {
  const text = `ADD,${chassisIp.trim()},${username.trim()},${password}`
  const res = await fetch(`${T1}/api/config/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, message: data.detail || res.statusText }
  }
  return { ok: true, message: data.message || 'Configuration accepted' }
}

export async function saveT1Chassis({ chassisIp, username, password }) {
  return testT1Connection({ chassisIp, username, password })
}

/** T2: probe does not persist. */
export async function testT2Connection({ chassisIp, username, password, restPort = 443 }) {
  const res = await fetch(`${T2}/servers/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: chassisIp.trim(),
      username: username.trim(),
      password,
      rest_port: Number(restPort) || 443,
    }),
  })
  const data = await res.json().catch(() => ({}))
  const ok = res.ok && data.status === 'ok'
  return { ok, message: data.message || (ok ? 'Connected' : 'Connection failed') }
}

export async function saveT2Server({ name, chassisIp, username, password, restPort = 443 }) {
  const res = await fetch(`${T2}/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      host: chassisIp.trim(),
      username: username.trim(),
      password,
      rest_port: Number(restPort) || 443,
      tags: [],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, message: data.detail || res.statusText }
  }
  return { ok: true, message: data.message || 'Server saved' }
}

export async function bulkUploadT1(csvText) {
  const res = await fetch(`${T1}/api/config/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: csvText }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, message: data.message || data.detail || res.statusText }
}

export async function bulkUploadT2(servers) {
  const res = await fetch(`${T2}/servers/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ servers }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, message: data.detail || res.statusText, results: [] }
  }
  const results = data.data?.results || []
  return { ok: true, message: 'Bulk upsert complete', results }
}

export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1).map((line, index) => {
    const values = line.split(',').map((v) => v.trim())
    const row = { _row: index + 2 }
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })
  return { headers, rows }
}

export function validateT1Row(row) {
  const errors = []
  const op = (row.operation || '').toUpperCase()
  if (!['ADD', 'DELETE', 'UPDATE'].includes(op)) errors.push('operation must be ADD, DELETE, or UPDATE')
  if (op === 'ADD' || op === 'UPDATE') {
    if (!row.ip) errors.push('ip required')
    else if (!isValidIpv4(row.ip)) errors.push('invalid ip')
    if (!row.username) errors.push('username required')
    if (!row.password) errors.push('password required')
  }
  return errors
}

export function validateT2Row(row) {
  const errors = []
  if (!row.name) errors.push('name required')
  if (!row.host) errors.push('host required')
  else if (!isValidIpv4(row.host)) errors.push('invalid host')
  if (!row.username) errors.push('username required')
  if (!row.password) errors.push('password required')
  return errors
}

export function rowsToT1Csv(rows) {
  return rows.map((r) => `${r.operation},${r.ip},${r.username},${r.password}`).join('\n')
}

export function rowsToT2Servers(rows) {
  return rows.map((r) => ({
    name: r.name,
    host: r.host,
    username: r.username,
    password: r.password,
    rest_port: r.rest_port ? Number(r.rest_port) : 443,
    tags: r.tags ? r.tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
  }))
}
