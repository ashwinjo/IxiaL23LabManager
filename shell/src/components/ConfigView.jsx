import { useEffect, useState } from 'react'
import {
  bulkUploadT1,
  bulkUploadT2,
  listMcpServers,
  parseT2BulkText,
  rowsToT2Servers,
  validateT1BulkText,
  validateT2Row,
} from '../lib/api'
import { getToolById } from '../config/tools'
import BulkUploadPanel from './BulkUploadPanel'
import McpConfigPanel from './McpConfigPanel'
import './ConfigView.css'

const t1 = getToolById('t1')
const t2 = getToolById('t2')

const T1_EXAMPLE = `ADD,192.168.1.100,admin,password
ADD,192.168.1.101,admin,password
DELETE,192.168.1.100,admin,password`

const T2_EXAMPLE = `name,host,username,password,rest_port,tags
lab-ixn-1,10.36.65.163,admin,changeme,443,
lab-ixn-2,10.36.65.164,admin,changeme,443,demo`

const T1_FORMAT = {
  templateHref: '/templates/tool1-chassis.csv',
  example: `ADD,192.168.1.100,admin,password
ADD,192.168.1.101,admin,password
DELETE,192.168.1.100,admin,password`,
  sections: [
    {
      title: 'Operations',
      items: [
        { label: 'ADD', detail: 'New chassis', kind: 'add' },
        { label: 'DELETE', detail: 'Remove chassis', kind: 'delete' },
        { label: 'UPDATE', detail: 'Update credentials', kind: 'update' },
      ],
    },
    {
      title: 'Fields',
      items: [
        { label: 'operation', detail: 'Action (ADD, DELETE, UPDATE)' },
        { label: 'ip', detail: 'Chassis IP address' },
        { label: 'username', detail: 'Auth user' },
        { label: 'password', detail: 'Auth password' },
      ],
    },
  ],
}

const T2_FORMAT = {
  templateHref: '/templates/tool2-servers.csv',
  example: `name,host,username,password,rest_port,tags
lab-ixn-1,10.36.65.163,admin,changeme,443,`,
  sections: [
    {
      title: 'Fields',
      items: [
        { label: 'name', detail: 'Server display name' },
        { label: 'host', detail: 'IxNetwork host IP' },
        { label: 'username', detail: 'Auth user' },
        { label: 'password', detail: 'Auth password' },
        { label: 'rest_port', detail: 'REST port (default 443)' },
        { label: 'tags', detail: 'Optional; semicolon-separated' },
      ],
    },
  ],
}

export default function ConfigView({ onMcpChange }) {
  const [tab, setTab] = useState('t1')
  const [busy, setBusy] = useState(false)
  const [mcpServers, setMcpServers] = useState([])

  const reloadMcp = async () => {
    const res = await listMcpServers()
    setMcpServers(res.servers || [])
    await onMcpChange?.()
  }

  useEffect(() => {
    reloadMcp()
  }, [])

  const handleT1Upload = async (text) => {
    const details = validateT1BulkText(text)
    if (details.length) {
      return { ok: false, message: 'Fix validation errors before uploading', details }
    }
    setBusy(true)
    try {
      const trimmed = text.trim()
      const lines = trimmed.split(/\r?\n/).filter(Boolean)
      const body =
        lines[0]?.toLowerCase().startsWith('operation,')
          ? lines.slice(1).join('\n')
          : trimmed
      const res = await bulkUploadT1(body)
      return { ok: res.ok, message: res.message }
    } finally {
      setBusy(false)
    }
  }

  const handleT2Upload = async (text) => {
    const { rows } = parseT2BulkText(text)
    if (!rows.length) {
      return { ok: false, message: 'Enter at least one server row' }
    }
    const details = []
    const servers = []
    for (const row of rows) {
      const errs = validateT2Row(row)
      if (errs.length) {
        details.push({ line: row._row, message: errs.join('; ') })
      } else {
        servers.push(rowsToT2Servers([row])[0])
      }
    }
    if (details.length) {
      return { ok: false, message: 'Fix validation errors before uploading', details }
    }
    setBusy(true)
    try {
      const res = await bulkUploadT2(servers)
      if (!res.ok) return { ok: false, message: res.message }
      const failed = (res.results || []).filter((r) => r.action === 'error')
      if (failed.length) {
        return {
          ok: false,
          message: `${failed.length} of ${servers.length} servers failed`,
          details: failed.map((r, i) => ({
            line: i + 1,
            message: r.message || 'Upload failed',
          })),
        }
      }
      return { ok: true, message: res.message || `Uploaded ${servers.length} server(s)` }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="config-view">
      <header className="home-brand">
        <p className="home-brand-eyebrow">Keysight · Ixia L2–L3 Lab Operations</p>
        <h1 className="home-brand-title">
          <span className="home-brand-ixia">Ixia</span>
          <span className="home-brand-name">L23LabManager</span>
        </h1>
        <p className="home-brand-tagline">
          Unified inventory, sessions, and utilization — one portal for your entire lab.
        </p>
      </header>

      <section className="home-hero" aria-label="Lab management overview">
        <img src="/homepage.png" alt="Ixia L2–L3 lab management dashboard overview" />
      </section>

      <h2 className="config-section-title">Chassis configuration</h2>
      <p className="config-sub">
        Configure {t1.name} and {t2.name} from one place. Credentials are sent directly to each
        tool — not stored in this shell.
      </p>

      <div className="tabs">
        <button type="button" className={tab === 't1' ? 'active' : ''} onClick={() => setTab('t1')}>
          {t1.name}
        </button>
        <button type="button" className={tab === 't2' ? 'active' : ''} onClick={() => setTab('t2')}>
          {t2.name}
        </button>
        <button type="button" className={tab === 'mcp' ? 'active' : ''} onClick={() => setTab('mcp')}>
          MCP Servers
        </button>
      </div>

      {tab === 't1' && (
        <div className="config-panel">
          <BulkUploadPanel
            title="Chassis configuration"
            description={`Add, delete, or update chassis in inventory — same CSV format as ${t1.name}.`}
            exampleText={T1_EXAMPLE}
            formatLegend={T1_FORMAT}
            onUpload={handleT1Upload}
            busy={busy}
          />
        </div>
      )}

      {tab === 't2' && (
        <div className="config-panel">
          <BulkUploadPanel
            title="IxNetwork servers"
            description={`Bulk import servers — same CSV format as ${t2.name} Manage Servers → Bulk Import.`}
            exampleText={T2_EXAMPLE}
            formatLegend={T2_FORMAT}
            onUpload={handleT2Upload}
            busy={busy}
          />
        </div>
      )}

      {tab === 'mcp' && (
        <div className="config-panel">
          <McpConfigPanel
            servers={mcpServers}
            onChange={reloadMcp}
            busy={busy}
            setBusy={setBusy}
          />
        </div>
      )}
    </div>
  )
}
