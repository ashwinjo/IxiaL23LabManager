import { useState } from 'react'
import './IframeView.css'

export default function IframeView({ url, title }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  return (
    <div className="iframe-container">
      {loading && <div className="iframe-overlay">Loading {title}…</div>}
      {error && (
        <div className="iframe-error">
          <p>Could not load <strong>{title}</strong>.</p>
          <p>
            Ensure the tool is running and allows iframe embedding.{' '}
            <a href={url} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          </p>
        </div>
      )}
      <iframe
        key={url}
        src={url}
        title={title}
        className="tool-iframe"
        onLoad={() => {
          setLoading(false)
          setError(false)
        }}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
      />
    </div>
  )
}
