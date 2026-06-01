import { BRIAN, TOOLS } from '../config/tools'

const T1 = TOOLS[0].backendUrl
const T2 = TOOLS[1].backendUrl
const BRIAN_API = BRIAN.backendUrl

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

/** T1 native format: operation,ip,username,password per line (optional header row). */
export function parseT1BulkText(text) {
  let lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  if (lines[0].toLowerCase().startsWith('operation,')) lines = lines.slice(1)
  return lines.map((line, index) => {
    const [operation, ip, username, password] = line.split(',').map((v) => v.trim())
    return { _row: index + 1, operation, ip, username, password }
  })
}

export function validateT1BulkText(text) {
  const rows = parseT1BulkText(text)
  if (!rows.length) return [{ line: 0, message: 'Enter at least one line' }]
  return rows.flatMap((row) => {
    const errs = validateT1Row(row)
    return errs.length ? [{ line: row._row, message: errs.join('; ') }] : []
  })
}

/** T2 bulk: header row or fixed name,host,username,password,rest_port,tags columns. */
export function parseT2BulkText(text) {
  const trimmed = text.trim()
  if (!trimmed) return { headers: [], rows: [] }
  const first = trimmed.split(/\r?\n/)[0].toLowerCase()
  if (first.startsWith('name,') || first.includes('host')) {
    return parseCsv(trimmed)
  }
  const headers = ['name', 'host', 'username', 'password', 'rest_port', 'tags']
  const lines = trimmed.split(/\r?\n/).filter(Boolean)
  const rows = lines.map((line, index) => {
    const values = line.split(',').map((v) => v.trim())
    const row = { _row: index + 1 }
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })
  return { headers, rows }
}

export function t1RowsToUploadText(rows) {
  return rows.map((r) => `${r.operation},${r.ip},${r.username},${r.password}`).join('\n')
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
  return t1RowsToUploadText(rows)
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

/** Brian / MCP registry */
export async function fetchBrianHealth() {
  const res = await fetch(`${BRIAN_API}/health`, { method: 'GET', mode: 'cors' })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

export async function listMcpServers() {
  const res = await fetch(`${BRIAN_API}/api/mcp/servers`, { method: 'GET', mode: 'cors' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, servers: [], message: data.detail || res.statusText }
  }
  return { ok: true, servers: data.servers || [] }
}

export async function createMcpServer(server) {
  const res = await fetch(`${BRIAN_API}/api/mcp/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(server),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data, message: data.detail || res.statusText }
}

export async function updateMcpServer(id, patch) {
  const res = await fetch(`${BRIAN_API}/api/mcp/servers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data, message: data.detail || res.statusText }
}

export async function deleteMcpServer(id) {
  const res = await fetch(`${BRIAN_API}/api/mcp/servers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    mode: 'cors',
  })
  if (res.ok) return { ok: true }
  const data = await res.json().catch(() => ({}))
  return { ok: false, message: data.detail || res.statusText }
}

export async function sendBrianMessage(message) {
  const res = await fetch(`${BRIAN_API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, message: data.detail || res.statusText }
  }
  return { ok: true, reply: data.reply }
}

export function validateMcpServerForm({ id, name, url, healthUrl }) {
  const errors = []
  if (!id?.trim()) errors.push('ID is required')
  else if (!/^[a-z][a-z0-9-]{1,48}$/.test(id.trim())) {
    errors.push('ID: lowercase letters, digits, dashes (2–49 chars)')
  }
  if (!name?.trim()) errors.push('Name is required')
  if (!url?.trim()) errors.push('MCP URL is required')
  else if (!/^https?:\/\/.+/i.test(url.trim())) errors.push('MCP URL must start with http:// or https://')
  if (healthUrl?.trim() && !/^https?:\/\/.+/i.test(healthUrl.trim())) {
    errors.push('Health URL must start with http:// or https://')
  }
  return errors
}
