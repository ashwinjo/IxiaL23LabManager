import { useRef, useState } from 'react'
import { BRIAN } from '../config/tools'
import { sendBrianMessage } from '../lib/api'
import './LabAssistantView.css'

const WELCOME = {
  role: 'assistant',
  content:
    "Hi — I'm Brian, your lab assistant. I can query inventory and IxNetwork sessions across your lab using the MCP tools you've configured. Ask me anything about your chassis and sessions.",
}

const SUGGESTIONS = [
  'Which chassis are in my inventory?',
  'List all configured chassis',
  'Are any IxNetwork sessions running?',
]

function McpStatus({ health, servers }) {
  if (!servers.length) {
    return (
      <p className="brian-mcp-empty">
        No MCP servers configured — add them under Home / Config → MCP Servers.
      </p>
    )
  }

  return (
    <div className="brian-mcp-strip">
      {servers.map((mcp) => {
        const h = health[mcp.id] || { status: 'pending' }
        const dotClass =
          h.status === 'up' ? 'dot dot-healthy' : h.status === 'pending' ? 'dot dot-degraded' : 'dot dot-error'
        const label = mcp.enabled === false ? `${mcp.name} (disabled)` : mcp.name
        return (
          <span key={mcp.id} className="brian-mcp-chip" title={`${mcp.name} — ${h.status}`}>
            <span className={dotClass} aria-hidden />
            {label}
          </span>
        )
      })}
    </div>
  )
}

export default function LabAssistantView({ mcpHealth, mcpServers = [], brianHealth }) {
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  const sendMessage = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setInput('')
    setSending(true)
    scrollToBottom()

    if (brianHealth?.status !== 'up') {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Brian backend is not reachable. Start it with lab-assistant/start.sh (port 9010) and set OPENAI_API_KEY in lab-assistant/.env.',
        },
      ])
      setSending(false)
      scrollToBottom()
      return
    }

    const res = await sendBrianMessage(trimmed)
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: res.ok ? res.reply : res.message || 'Something went wrong.',
      },
    ])
    setSending(false)
    scrollToBottom()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="brian-view">
      <header className="brian-header">
        <div>
          <p className="brian-eyebrow">Lab Assistant</p>
          <h2 className="brian-title">{BRIAN.name}</h2>
          <p className="brian-sub">
            Natural-language access to inventory and sessions via MCP. Powered by mcp-use.
          </p>
        </div>
        <McpStatus health={mcpHealth} servers={mcpServers} />
      </header>

      <div className="brian-chat" ref={listRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`brian-msg brian-msg-${msg.role}`}>
            <span className="brian-msg-label">{msg.role === 'user' ? 'You' : 'Brian'}</span>
            <p>{msg.content}</p>
          </div>
        ))}
        {sending && (
          <div className="brian-msg brian-msg-assistant">
            <span className="brian-msg-label">Brian</span>
            <p className="brian-typing">Thinking…</p>
          </div>
        )}
      </div>

      {messages.length === 1 && (
        <div className="brian-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="brian-suggestion" onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="brian-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          className="brian-input"
          placeholder="Ask Brian about your lab…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          aria-label="Message to Brian"
        />
        <button type="submit" className="btn btn-primary brian-send" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
