import { useState } from 'react'

/**
 * Shared bulk-upload UI (textarea + Upload / Load example / Clear + format legend).
 * Matches the paste-and-upload pattern used in Tool 1 and Tool 2 native config UIs.
 */
export default function BulkUploadPanel({
  title,
  description,
  exampleText,
  formatLegend,
  onUpload,
  busy,
}) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)

  const handleUpload = async () => {
    setResult(null)
    const res = await onUpload(text)
    setResult(res)
  }

  const handleLoadExample = () => {
    setText(exampleText)
    setResult(null)
  }

  const handleClear = () => {
    setText('')
    setResult(null)
  }

  return (
    <div className="bulk-upload-panel">
      <h2 className="bulk-upload-title">{title}</h2>
      {description && <p className="bulk-upload-desc">{description}</p>}

      <label className="bulk-upload-label">Configuration (CSV format)</label>
      <textarea
        className="bulk-upload-textarea"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setResult(null)
        }}
        spellCheck={false}
        rows={10}
      />

      <div className="bulk-upload-actions">
        <button type="button" className="primary" onClick={handleUpload} disabled={busy || !text.trim()}>
          Upload
        </button>
        <button type="button" onClick={handleLoadExample} disabled={busy}>
          Load example
        </button>
        <button type="button" className="text-btn" onClick={handleClear} disabled={busy}>
          Clear
        </button>
        <a className="template-link" href={formatLegend.templateHref} download>
          Download template
        </a>
      </div>

      {result && (
        <div className={`bulk-upload-result ${result.ok ? 'ok' : 'fail'}`} role="status">
          {result.ok ? '✓' : '✗'} {result.message}
          {result.details?.length > 0 && (
            <ul className="bulk-upload-errors">
              {result.details.map((d) => (
                <li key={`${d.line}-${d.message}`}>
                  Line {d.line}: {d.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bulk-format-ref">
        <div className="bulk-format-example">
          <pre>{formatLegend.example}</pre>
        </div>
        <div className="bulk-format-legend">
          {formatLegend.sections.map((section) => (
            <div key={section.title} className="bulk-format-section">
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.label}>
                    <span className={`dot dot-${item.kind || 'default'}`} />
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
