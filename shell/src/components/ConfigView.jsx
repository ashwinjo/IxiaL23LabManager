import { useState } from 'react'
import {
  bulkUploadT1,
  bulkUploadT2,
  parseCsv,
  rowsToT1Csv,
  rowsToT2Servers,
  saveT1Chassis,
  saveT2Server,
  testT1Connection,
  testT2Connection,
  validateChassisForm,
  validateT1Row,
  validateT2Row,
} from '../lib/api'
import './ConfigView.css'

const TEMPLATE_PATHS = {
  t1: '/templates/tool1-chassis.csv',
  t2: '/templates/tool2-servers.csv',
}

export default function ConfigView() {
  const [tab, setTab] = useState('manual')
  const [form, setForm] = useState({
    chassisIp: '',
    username: '',
    password: '',
    label: '',
    restPort: '443',
  })
  const [t1Result, setT1Result] = useState(null)
  const [t2Result, setT2Result] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formErrors, setFormErrors] = useState([])

  const [bulkTool, setBulkTool] = useState('t1')
  const [csvText, setCsvText] = useState('')
  const [parsed, setParsed] = useState({ headers: [], rows: [] })
  const [applyResults, setApplyResults] = useState([])

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleTest = async () => {
    const errors = validateChassisForm(form)
    setFormErrors(errors)
    if (errors.length) return
    setBusy(true)
    setT1Result(null)
    setT2Result(null)
    try {
      const [t1, t2] = await Promise.all([
        testT1Connection(form),
        testT2Connection(form),
      ])
      setT1Result(t1)
      setT2Result(t2)
    } catch (e) {
      setT1Result({ ok: false, message: e.message })
      setT2Result({ ok: false, message: e.message })
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    const errors = validateChassisForm(form)
    setFormErrors(errors)
    if (errors.length) return
    setBusy(true)
    const name = form.label.trim() || form.chassisIp.trim()
    try {
      const [t1, t2] = await Promise.all([
        saveT1Chassis(form),
        saveT2Server({ ...form, name, chassisIp: form.chassisIp }),
      ])
      setT1Result(t1)
      setT2Result(t2)
    } catch (e) {
      setT1Result({ ok: false, message: e.message })
      setT2Result({ ok: false, message: e.message })
    } finally {
      setBusy(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result
      setCsvText(text)
      setParsed(parseCsv(text))
      setApplyResults([])
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleApplyAll = async () => {
    const { rows } = parsed
    if (!rows.length) return
    setBusy(true)
    setApplyResults(rows.map((r) => ({ row: r._row, status: 'pending', message: '' })))

    if (bulkTool === 't1') {
      const validRows = []
      const results = rows.map((row) => {
        const errs = validateT1Row(row)
        if (errs.length) return { row: row._row, status: 'error', message: errs.join('; ') }
        validRows.push(row)
        return { row: row._row, status: 'pending', message: '' }
      })
      if (validRows.length) {
        const csvBody = rowsToT1Csv(validRows)
        const res = await bulkUploadT1(csvBody)
        validRows.forEach((row) => {
          const idx = results.findIndex((r) => r.row === row._row)
          if (idx >= 0) {
            results[idx] = {
              row: row._row,
              status: res.ok ? 'success' : 'error',
              message: res.message,
            }
          }
        })
      }
      setApplyResults(results)
    } else {
      const servers = []
      const results = []
      for (const row of rows) {
        const errs = validateT2Row(row)
        if (errs.length) {
          results.push({ row: row._row, status: 'error', message: errs.join('; ') })
        } else {
          servers.push(rowsToT2Servers([row])[0])
          results.push({ row: row._row, status: 'pending', message: '' })
        }
      }
      if (servers.length) {
        const res = await bulkUploadT2(servers)
        if (res.results?.length) {
          res.results.forEach((r, i) => {
            const pending = results.filter((x) => x.status === 'pending')
            if (pending[i]) {
              pending[i].status = r.action === 'error' ? 'error' : 'success'
              pending[i].message = r.message || r.action
            }
          })
        } else if (!res.ok) {
          results.forEach((r) => {
            if (r.status === 'pending') {
              r.status = 'error'
              r.message = res.message
            }
          })
        } else {
          results.forEach((r) => {
            if (r.status === 'pending') {
              r.status = 'success'
              r.message = 'OK'
            }
          })
        }
      }
      setApplyResults(results)
    }
    setBusy(false)
  }

  const rowValidation = (row) =>
    bulkTool === 't1' ? validateT1Row(row) : validateT2Row(row)

  return (
    <div className="config-view">
      <h1>Chassis configuration</h1>
      <p className="config-sub">
        Configure Tool 1 (Inventory) and Tool 2 (Sessions) from one place. Credentials are sent
        directly to each tool — not stored in this shell.
      </p>

      <div className="tabs">
        <button type="button" className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
          Manual entry
        </button>
        <button type="button" className={tab === 'bulk' ? 'active' : ''} onClick={() => setTab('bulk')}>
          Bulk CSV
        </button>
      </div>

      {tab === 'manual' && (
        <div className="config-panel">
          {formErrors.length > 0 && (
            <ul className="form-errors">
              {formErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="form-grid">
            <label>
              Chassis IP
              <input value={form.chassisIp} onChange={update('chassisIp')} placeholder="10.0.0.1" />
            </label>
            <label>
              Username
              <input value={form.username} onChange={update('username')} autoComplete="off" />
            </label>
            <label>
              Password
              <input type="password" value={form.password} onChange={update('password')} autoComplete="new-password" />
            </label>
            <label>
              Label (optional, used as T2 server name)
              <input value={form.label} onChange={update('label')} />
            </label>
            <label>
              T2 REST port
              <input value={form.restPort} onChange={update('restPort')} />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleTest} disabled={busy}>
              Test connection
            </button>
            <button type="button" className="primary" onClick={handleSave} disabled={busy}>
              Save to both tools
            </button>
          </div>
          <div className="tool-results">
            <ResultLine tool="T1 Inventory" result={t1Result} />
            <ResultLine tool="T2 Sessions" result={t2Result} />
          </div>
          <p className="hint">
            T1 uses upload API (validates and saves). T2 probe tests without saving; Save posts to both tools.
          </p>
        </div>
      )}

      {tab === 'bulk' && (
        <div className="config-panel">
          <div className="bulk-controls">
            <label>
              Target tool
              <select value={bulkTool} onChange={(e) => setBulkTool(e.target.value)}>
                <option value="t1">Tool 1 — Inventory</option>
                <option value="t2">Tool 2 — Sessions</option>
              </select>
            </label>
            <a className="template-link" href={TEMPLATE_PATHS[bulkTool]} download>
              Download template
            </a>
            <label className="file-label">
              Upload CSV
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
            </label>
          </div>

          {parsed.rows.length > 0 && (
            <>
              <div className="preview-wrap">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {parsed.headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                      <th>Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((row) => {
                      const errs = rowValidation(row)
                      return (
                        <tr key={row._row} className={errs.length ? 'row-error' : ''}>
                          <td>{row._row}</td>
                          {parsed.headers.map((h) => (
                            <td key={h}>{row[h]}</td>
                          ))}
                          <td>{errs.length ? errs.join(', ') : 'OK'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className="primary" onClick={handleApplyAll} disabled={busy}>
                Apply all valid rows
              </button>
            </>
          )}

          {applyResults.length > 0 && (
            <table className="results-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {applyResults.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td className={`status-${r.status}`}>{statusIcon(r.status)} {r.status}</td>
                    <td>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function ResultLine({ tool, result }) {
  if (!result) return null
  return (
    <div className={`result-line ${result.ok ? 'ok' : 'fail'}`}>
      <strong>{tool}:</strong> {result.ok ? '✓' : '✗'} {result.message}
    </div>
  )
}

function statusIcon(status) {
  if (status === 'success') return '✓'
  if (status === 'error') return '✗'
  return '…'
}
