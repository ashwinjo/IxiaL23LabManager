import { useState } from 'react'
import {
  createMcpServer,
  deleteMcpServer,
  updateMcpServer,
  validateMcpServerForm,
} from '../lib/api'
import './McpConfigPanel.css'

const EMPTY_FORM = {
  id: '',
  name: '',
  url: '',
  healthUrl: '',
  toolId: '',
  enabled: true,
}

export default function McpConfigPanel({ servers, onChange, busy, setBusy }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [message, setMessage] = useState(null)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const handleEdit = (server) => {
    setEditingId(server.id)
    setForm({
      id: server.id,
      name: server.name,
      url: server.url,
      healthUrl: server.healthUrl || '',
      toolId: server.toolId || '',
      enabled: server.enabled !== false,
    })
    setMessage(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validateMcpServerForm(form)
    if (errors.length) {
      setMessage({ ok: false, text: errors.join('; ') })
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const payload = {
        id: form.id.trim(),
        name: form.name.trim(),
        url: form.url.trim(),
        healthUrl: form.healthUrl.trim(),
        toolId: form.toolId.trim(),
        enabled: form.enabled,
      }

      const res = editingId
        ? await updateMcpServer(editingId, {
            name: payload.name,
            url: payload.url,
            healthUrl: payload.healthUrl,
            toolId: payload.toolId,
            enabled: payload.enabled,
          })
        : await createMcpServer(payload)

      if (!res.ok) {
        setMessage({ ok: false, text: res.message || 'Save failed' })
        return
      }

      setMessage({ ok: true, text: editingId ? 'MCP server updated' : 'MCP server added' })
      resetForm()
      await onChange?.()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete MCP server "${id}"?`)) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await deleteMcpServer(id)
      if (!res.ok) {
        setMessage({ ok: false, text: res.message || 'Delete failed' })
        return
      }
      if (editingId === id) resetForm()
      setMessage({ ok: true, text: 'MCP server deleted' })
      await onChange?.()
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (server) => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await updateMcpServer(server.id, { enabled: !server.enabled })
      if (!res.ok) {
        setMessage({ ok: false, text: res.message || 'Update failed' })
        return
      }
      await onChange?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mcp-config">
      <p className="config-sub">
        Brian connects to these MCP servers via{' '}
        <a href="https://github.com/mcp-use/mcp-use" target="_blank" rel="noreferrer">
          mcp-use
        </a>
        . Default entries target T1 inventory (:8888/mcp) and T2 sessions (:8889/mcp).
      </p>

      {message && (
        <p className={`mcp-flash ${message.ok ? 'mcp-flash-ok' : 'mcp-flash-err'}`}>{message.text}</p>
      )}

      <div className="mcp-table-wrap">
        <table className="mcp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>MCP URL</th>
              <th>Health</th>
              <th>Tool</th>
              <th>On</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {servers.length === 0 && (
              <tr>
                <td colSpan={7} className="mcp-empty-row">
                  No MCP servers — Brian backend may be offline, or add one below.
                </td>
              </tr>
            )}
            {servers.map((s) => (
              <tr key={s.id} className={s.enabled === false ? 'mcp-row-disabled' : ''}>
                <td>{s.name}</td>
                <td>
                  <code>{s.id}</code>
                </td>
                <td className="mcp-url-cell">{s.url}</td>
                <td className="mcp-url-cell">{s.healthUrl}</td>
                <td>{s.toolId || '—'}</td>
                <td>
                  <button
                    type="button"
                    className="mcp-toggle"
                    onClick={() => handleToggle(s)}
                    disabled={busy}
                    title={s.enabled === false ? 'Enable' : 'Disable'}
                  >
                    {s.enabled === false ? 'Off' : 'On'}
                  </button>
                </td>
                <td className="mcp-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => handleEdit(s)} disabled={busy}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-ghost mcp-delete" onClick={() => handleDelete(s.id)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="mcp-form" onSubmit={handleSubmit}>
        <h3 className="mcp-form-title">{editingId ? `Edit ${editingId}` : 'Add MCP server'}</h3>
        <div className="mcp-form-grid">
          <label>
            ID
            <input
              type="text"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              placeholder="t1-mcp"
              disabled={busy || Boolean(editingId)}
              required
            />
          </label>
          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Inventory MCP"
              disabled={busy}
              required
            />
          </label>
          <label className="mcp-span-2">
            MCP URL
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="http://127.0.0.1:8888/mcp"
              disabled={busy}
              required
            />
          </label>
          <label className="mcp-span-2">
            Health URL
            <input
              type="url"
              value={form.healthUrl}
              onChange={(e) => setForm({ ...form, healthUrl: e.target.value })}
              placeholder="http://127.0.0.1:8888/docs"
              disabled={busy}
            />
          </label>
          <label>
            Tool link (optional)
            <input
              type="text"
              value={form.toolId}
              onChange={(e) => setForm({ ...form, toolId: e.target.value })}
              placeholder="t1"
              disabled={busy}
            />
          </label>
          <label className="mcp-checkbox">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              disabled={busy}
            />
            Enabled
          </label>
        </div>
        <div className="mcp-form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {editingId ? 'Save changes' : 'Add server'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={resetForm} disabled={busy}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
