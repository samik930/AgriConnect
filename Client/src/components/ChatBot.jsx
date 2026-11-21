import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatBot.css';

/**
 * Formats markdown-like text (bold, headers, bullets, links) into clean React elements
 */
const FormattedMessage = ({ text }) => {
  if (!text) return null;

  // Split lines
  const lines = text.split('\n');

  return (
    <div>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Header 3 or 4: ### or ####
        if (trimmed.startsWith('### ')) {
          return <h3 key={idx}>{trimmed.replace(/^###\s+/, '')}</h3>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={idx}>{trimmed.replace(/^##\s+/, '')}</h2>;
        }

        // Bullet point: * or -
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const bulletText = trimmed.replace(/^[\*\-]\s+/, '');
          return (
            <div key={idx} style={{ display: 'flex', gap: '6px', margin: '3px 0' }}>
              <span style={{ color: 'var(--color-primary)' }}>•</span>
              <span>{parseInline(bulletText)}</span>
            </div>
          );
        }

        // Numbered list: 1. or 2.
        if (/^\d+\.\s+/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+\.)\s+(.*)/);
          return (
            <div key={idx} style={{ display: 'flex', gap: '6px', margin: '3px 0' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{numMatch[1]}</span>
              <span>{parseInline(numMatch[2])}</span>
            </div>
          );
        }

        // Empty line
        if (!trimmed) {
          return <div key={idx} style={{ height: '6px' }} />;
        }

        // Regular paragraph with inline formatting
        return <p key={idx}>{parseInline(line)}</p>;
      })}
    </div>
  );
};

/**
 * Helper to parse inline markdown: bold **text** and links [text](url)
 */
function parseInline(str) {
  if (!str) return '';

  // Match links: [text](url)
  const parts = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    parts.push(
      <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer">
        {match[1]}
      </a>
    );
    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }

  // Now process **bold** inside string parts
  return parts.map((part, pIdx) => {
    if (typeof part !== 'string') return part;

    const subParts = part.split(/(\*\*[^*]+\*\*)/g);
    return subParts.map((sub, sIdx) => {
      if (sub.startsWith('**') && sub.endsWith('**')) {
        return <strong key={`${pIdx}-${sIdx}`}>{sub.slice(2, -2)}</strong>;
      }
      return sub;
    });
  });
}

const ChatBot = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [openStepIdx, setOpenStepIdx] = useState(null);

  // Active agents involved in latest interaction
  const [activeAgents, setActiveAgents] = useState([]);

  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: `Hello ${user?.name ? user.name : 'there'}! 🌾\n\nI'm **AgriBot**, your Multi-Agent AI coordinator. I work directly with 4 specialized agents:\n\n* **Farming Agent** — 7-Day weather forecasts, schemes, technologies & mandi prices\n* **Marketplace Agent** — Fresh produce search & stock checks\n* **Logistics Agent** — 50 km local farmer discovery\n* **Order Support** — Cart management & live order tracking\n\nHow can I help you today?`,
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages, loading]);

  const quickPrompts = [
    '🌦️ 7-day weather forecast for farming',
    '🌾 Drip irrigation subsidies in Maharashtra',
    '🛒 Find fresh wheat or vegetables within 50km',
    '📊 Mandi market prices for tomato and onion',
    '📦 Track my latest order status',
  ];

  const handleSend = async (textToSend) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    const userMessage = { role: 'user', text: queryText };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setShowTeaser(false);

    try {
      const res = await axios.post(
        '/api/ai/orchestrator',
        {
          query: queryText,
          context: {
            userLocation: user?.district ? { state: user?.state, district: user?.district } : undefined,
            location: user?.district || user?.state || undefined,
            coordinates: user?.location?.coordinates || undefined,
            userRole: user?.role,
          },
        },
        { withCredentials: true }
      );

      const data = res.data;
      const engagedAgents = data.agentResponses?.map((ar) => ar.agent) || [];
      setActiveAgents(engagedAgents);

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: data.synthesizedResponse || data.finalAnswer || data.answer || 'Query processed.',
          plan: data.plan,
          executionSteps: data.executionSteps || data.agentResponses,
        },
      ]);
    } catch (err) {
      console.error('Chatbot orchestrator error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: 'I encountered an issue connecting with the agent network. Please try asking again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'ai',
        text: 'Chat history cleared. What else can the AgriConnect multi-agent team look up for you?',
      },
    ]);
    setActiveAgents([]);
  };

  return (
    <>
      {/* ── Floating Launcher ── */}
      <div className="agribot-launcher">
        {!isOpen && showTeaser && (
          <div className="agribot-teaser" onClick={() => setIsOpen(true)}>
            <span>🤖 Need help with crops, products, or orders?</span>
            <button
              className="agribot-teaser-close"
              onClick={(e) => {
                e.stopPropagation();
                setShowTeaser(false);
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <button
          className="agribot-toggle-btn"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setShowTeaser(false);
          }}
          title={isOpen ? 'Close Chatbot' : 'Open AgriBot Multi-Agent AI'}
          aria-label="Toggle AgriBot Chat"
        >
          {isOpen ? '✕' : '🤖'}
          {!isOpen && <span className="agribot-pulse-ring" />}
        </button>
      </div>

      {/* ── Chat Window ── */}
      {isOpen && (
        <div className="agribot-window">
          {/* Header */}
          <div className="agribot-header">
            <div className="agribot-header-info">
              <div className="agribot-avatar">🌱</div>
              <div>
                <div className="agribot-title">AgriBot Assistant</div>
                <div className="agribot-subtitle">
                  <span className="agribot-status-dot" />
                  Multi-Agent Network Online
                </div>
              </div>
            </div>
            <div className="agribot-actions">
              <button
                className="agribot-icon-btn"
                onClick={clearChat}
                title="Clear Conversation"
              >
                🗑️
              </button>
              <button
                className="agribot-icon-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize Chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Capabilities bar */}
          <div className="agribot-agent-bar">
            <span className={`agribot-agent-tag ${activeAgents.some((a) => a.includes('Farming')) ? 'active' : ''}`}>
              🌾 Farming
            </span>
            <span className={`agribot-agent-tag ${activeAgents.some((a) => a.includes('Marketplace')) ? 'active' : ''}`}>
              🛒 Marketplace
            </span>
            <span className={`agribot-agent-tag ${activeAgents.some((a) => a.includes('Logistics')) ? 'active' : ''}`}>
              📍 50km Logistics
            </span>
            <span className={`agribot-agent-tag ${activeAgents.some((a) => a.includes('Order')) ? 'active' : ''}`}>
              📦 Orders
            </span>
          </div>

          {/* Messages */}
          <div className="agribot-messages">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`agribot-msg-row ${msg.role === 'user' ? 'agribot-msg-user' : 'agribot-msg-ai'}`}
              >
                <div
                  className={`agribot-msg-avatar ${msg.role === 'user' ? 'agribot-msg-avatar-user' : ''}`}
                >
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>

                <div
                  className={`agribot-bubble ${msg.role === 'user' ? 'agribot-bubble-user' : 'agribot-bubble-ai'}`}
                >
                  <FormattedMessage text={msg.text} />

                  {/* Human-in-the-Loop Confirmation Action Gate */}
                  {msg.text?.includes('Confirmation Required') && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => handleSend('Confirm and proceed with this action')}
                        style={{
                          background: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          padding: '7px 16px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        ✅ Confirm & Proceed
                      </button>
                    </div>
                  )}

                  {/* Multi-Agent Consultation Badges */}
                  {msg.executionSteps && msg.executionSteps.length > 0 && (
                    <div className="agribot-agent-badges">
                      {Array.from(new Set(msg.executionSteps.map((s) => s.agent || s.role))).map((agName, i) => (
                        <span key={i} className="agribot-agent-pill">
                          ⚡ {agName}
                        </span>
                      ))}

                      <button
                        className="agribot-steps-toggle"
                        onClick={() => setOpenStepIdx(openStepIdx === idx ? null : idx)}
                      >
                        {openStepIdx === idx ? '▲ Hide steps' : `▼ View ${msg.executionSteps.length} agent steps`}
                      </button>

                      {openStepIdx === idx && (
                        <div className="agribot-steps-box">
                          {msg.executionSteps.map((step, sIdx) => (
                            <div key={sIdx} style={{ marginBottom: '4px' }}>
                              <strong style={{ color: 'var(--color-primary)' }}>
                                {step.agent || step.role}:
                              </strong>{' '}
                              <span>{step.task || (step.toolCalls ? `Tools: ${step.toolCalls.map((t) => t.tool).join(', ')}` : 'Analyzed request')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="agribot-msg-row agribot-msg-ai">
                <div className="agribot-msg-avatar">🤖</div>
                <div className="agribot-bubble agribot-bubble-ai agribot-thinking">
                  <span className="agribot-dot" />
                  <span className="agribot-dot" />
                  <span className="agribot-dot" />
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginLeft: '6px' }}>
                    Coordinating MCP agents...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt chips (show when 1 or 2 messages) */}
          {messages.length <= 2 && (
            <div className="agribot-suggestions">
              <div className="agribot-suggestions-label">Try asking:</div>
              <div className="agribot-suggestions-scroll">
                {quickPrompts.map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    className="agribot-suggestion-chip"
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="agribot-input-area">
            <input
              ref={inputRef}
              type="text"
              className="agribot-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about crops, products, 50km radius, or orders..."
              disabled={loading}
            />
            <button
              className="agribot-send-btn"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              title="Send"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;

