import { useState, useRef, useEffect } from "react";
import axios from "axios";

const MODES = {
  AGENT: "agent",
  CHAT: "chat",
  CROP: "crop",
};

const EMPTY_CROP_FORM = {
  location: "",
  season: "",
  soil_type: "",
  availability: "",
  question: "",
};

const AgentStepsDropdown = ({ steps }) => {
  const [open, setOpen] = useState(false);
  if (!steps || steps.length === 0) return null;

  return (
    <div style={{ marginTop: "6px" }}>
      <button
        type="button"
        className="ai-agent-details-toggle"
        onClick={() => setOpen(!open)}
      >
        {open ? "▼ Hide agent steps" : `▶ View agent execution (${steps.length} steps)`}
      </button>
      {open && (
        <div className="ai-agent-steps-box">
          {steps.map((st, i) => (
            <div key={i} style={{ marginBottom: i < steps.length - 1 ? "8px" : "0" }}>
              <div style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                Step {i + 1}: {st.agent}
              </div>
              <div style={{ fontSize: "0.74rem", opacity: 0.9 }}>
                <strong>Task:</strong> {st.task}
              </div>
              {st.error && (
                <div style={{ color: "#ef4444", fontSize: "0.72rem" }}>
                  Error: {st.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AIAssistant = () => {
  const [mode, setMode] = useState(MODES.AGENT);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello 👨‍🌾! I'm your AgriConnect Intelligent Multi-Agent Assistant.\n\nI coordinate **4 specialized MCP agents**:\n🌾 **Farming Agent** — 7-Day Weather Forecasts, Govt Schemes, Technologies, APMC Mandi Rates & Crop Advisories\n🛒 **Marketplace Agent** — Browse live listings, check stock & reviews\n📍 **Logistics Agent** — 50 km local farmer discovery & PostGIS delivery checks\n📦 **Order & Support Agent** — Cart & order tracking\n\nHow can our agent network help you today?",
    },
  ]);

  // Chat/agent mode input
  const [question, setQuestion] = useState("");

  // Crop suggestion mode state
  const [cropForm, setCropForm] = useState(EMPTY_CROP_FORM);

  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ── Handle mode switch ── */
  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === MODES.AGENT) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "🧠 **Multi-Agent Orchestrator** active!\n\nI can coordinate Farming, Marketplace, Logistics, and Order Support MCP agents to query real-time database tools and solve multi-step requests.",
        },
      ]);
    } else if (newMode === MODES.CROP) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "🌾 **Crop Suggestion Mode** activated!\n\nFill in the form below with your farm details and I'll recommend the best crops for you.",
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "💬 **Quick Chat Mode** activated!\n\nAsk me anything about farming — diseases, fertilizers, irrigation, and general advice.",
        },
      ]);
    }
  };

  /* ── Send question (supports both quick chat and orchestrator) ── */
  const sendQuestion = async () => {
    if (!question.trim() || loading) return;

    const userMsg = { role: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      if (mode === MODES.AGENT) {
        // Query the Multi-Agent Orchestrator endpoint with user location context
        const storedUser = JSON.parse(localStorage.getItem('agriconnect_user') || '{}');
        const res = await axios.post(
          "/api/ai/orchestrator",
          {
            query: userMsg.text,
            context: {
              location: storedUser.district || storedUser.state || undefined,
              coordinates: storedUser.location?.coordinates || undefined,
              role: storedUser.role || undefined,
            },
          },
          { withCredentials: true }
        );

        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: res.data.synthesizedResponse || res.data.answer || "Query processed successfully.",
            plan: res.data.plan,
            executionSteps: res.data.executionSteps,
          },
        ]);
      } else {
        // Quick Gemini chat endpoint
        const res = await axios.post(
          "/api/ai/assistant",
          { question: userMsg.text },
          { withCredentials: true }
        );
        setMessages((prev) => [...prev, { role: "ai", text: res.data.answer }]);
      }
    } catch (err) {
      console.error("AI Assistant query failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Sorry, I'm unable to complete that request right now. Please try again or rephrase your query.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* ── Crop suggestion send ── */
  const sendCropSuggestion = async (e) => {
    e.preventDefault();
    if (loading) return;

    const { location, season, soil_type, availability, question: q } = cropForm;

    const summaryText =
      `📍 Location: ${location}\n` +
      `🌤 Season: ${season}\n` +
      `🪨 Soil Type: ${soil_type}\n` +
      `💧 Water Availability: ${availability}` +
      (q.trim() ? `\n❓ ${q}` : "");

    setMessages((prev) => [...prev, { role: "user", text: summaryText }]);
    setCropForm(EMPTY_CROP_FORM);
    setLoading(true);

    try {
      const res = await axios.post(
        "/api/ai/crop_suggestion",
        { question: q || "Suggest the best crops", location, season, soil_type, availability },
        { withCredentials: true }
      );
      setMessages((prev) => [...prev, { role: "ai", text: res.data.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, couldn't fetch crop suggestions right now. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  const agentSuggestions = [
    "Give me the 7-day weather forecast and spraying advice",
    "Find fresh wheat or rice products within 50km",
    "Active government schemes for drip irrigation",
    "What are today's mandi market prices for tomato in Maharashtra?",
  ];

  const quickChatSuggestions = [
    "What is the weather report for the next 7 days?",
    "Best fertilizer for wheat?",
    "How to treat tomato blight?",
    "Tips for drip irrigation?",
  ];

  const currentSuggestions = mode === MODES.AGENT ? agentSuggestions : quickChatSuggestions;

  return (
    <div className="ai-assistant-wrapper">
      {/* ── Header ── */}
      <div className="ai-assistant-header">
        <div className="ai-header-icon">
          {mode === MODES.AGENT ? "🧠" : mode === MODES.CROP ? "🌾" : "🤖"}
        </div>
        <div>
          <h2 className="db-section-title" style={{ margin: 0, fontSize: "1.4rem" }}>
            {mode === MODES.AGENT ? "🧠 Multi-Agent AgriAssistant" : "🌱 AI Farming Assistant"}
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
            {mode === MODES.AGENT
              ? "4 MCP Agents: Farming, Marketplace, PostGIS Logistics & Orders"
              : "Powered by Gemini AI · Fast responses & crop suggestions"}
          </p>
        </div>
        <div className="ai-status-dot">
          <span className="ai-status-indicator"></span>
          MCP Connected
        </div>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="ai-mode-toggle">
        <button
          className={`ai-mode-btn ${mode === MODES.AGENT ? "active" : ""}`}
          onClick={() => handleModeSwitch(MODES.AGENT)}
        >
          🧠 Multi-Agent (MCP)
        </button>
        <button
          className={`ai-mode-btn ${mode === MODES.CHAT ? "active" : ""}`}
          onClick={() => handleModeSwitch(MODES.CHAT)}
        >
          💬 Quick Ask AI
        </button>
        <button
          className={`ai-mode-btn ${mode === MODES.CROP ? "active" : ""}`}
          onClick={() => handleModeSwitch(MODES.CROP)}
        >
          🌾 Crop Suggestion
        </button>
      </div>

      {/* ── Suggestions ── */}
      {mode !== MODES.CROP && messages.length <= 2 && (
        <div className="ai-suggestions">
          <p className="ai-suggestions-label">Try asking:</p>
          <div className="ai-suggestions-grid">
            {currentSuggestions.map((q, i) => (
              <button
                key={i}
                className="ai-suggestion-chip"
                onClick={() => setQuestion(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages thread ── */}
      <div className="ai-messages-container">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`ai-message-row ${msg.role === "user" ? "ai-message-user" : "ai-message-ai"}`}
          >
            {msg.role === "ai" && (
              <div className="ai-avatar">
                {msg.executionSteps && msg.executionSteps.length > 0 ? "🧠" : "🤖"}
              </div>
            )}
            <div className={`ai-bubble ${msg.role === "user" ? "ai-bubble-user" : "ai-bubble-ai"}`}>
              {msg.text}

              {/* Badges for agents consulted */}
              {msg.executionSteps && msg.executionSteps.length > 0 && (
                <>
                  <div className="ai-agent-badges">
                    {Array.from(new Set(msg.executionSteps.map((s) => s.agent))).map((agentName, idx) => (
                      <span key={idx} className="ai-agent-pill">
                        ⚡ {agentName}
                      </span>
                    ))}
                  </div>
                  <AgentStepsDropdown steps={msg.executionSteps} />
                </>
              )}
            </div>
            {msg.role === "user" && <div className="ai-avatar ai-avatar-user">👨‍🌾</div>}
          </div>
        ))}

        {loading && (
          <div className="ai-message-row ai-message-ai">
            <div className="ai-avatar">{mode === MODES.AGENT ? "🧠" : "🤖"}</div>
            <div className="ai-bubble ai-bubble-ai ai-thinking">
              <span className="ai-dot"></span>
              <span className="ai-dot"></span>
              <span className="ai-dot"></span>
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginLeft: "8px" }}>
                {mode === MODES.AGENT ? "Agents coordinating tools..." : "Thinking..."}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area: agent / chat mode ── */}
      {mode !== MODES.CROP && (
        <div className="ai-input-area">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === MODES.AGENT
                ? "Ask about 7-day weather, farming, marketplace, 50km logistics, or orders..."
                : "Ask about 7-day weather, crops, diseases, fertilizers..."
            }
            className="ai-input"
            disabled={loading}
          />
          <button
            onClick={sendQuestion}
            className="ai-send-btn"
            disabled={loading || !question.trim()}
            title="Send (Enter)"
          >
            {loading ? (
              <span className="geo-spinner" style={{ width: 18, height: 18 }} />
            ) : (
              "➤"
            )}
          </button>
        </div>
      )}

      {/* ── Input area: crop suggestion mode ── */}
      {mode === MODES.CROP && (
        <form className="ai-crop-form" onSubmit={sendCropSuggestion}>
          <div className="ai-crop-form-grid">
            <div className="ai-crop-field">
              <label>📍 Location / Region</label>
              <input
                type="text"
                placeholder="e.g. Punjab, Maharashtra"
                value={cropForm.location}
                onChange={(e) => setCropForm((p) => ({ ...p, location: e.target.value }))}
                required
                disabled={loading}
              />
            </div>
            <div className="ai-crop-field">
              <label>🌤 Season</label>
              <select
                value={cropForm.season}
                onChange={(e) => setCropForm((p) => ({ ...p, season: e.target.value }))}
                required
                disabled={loading}
              >
                <option value="">Select season...</option>
                <option value="Kharif (June–October)">Kharif (June–October)</option>
                <option value="Rabi (November–April)">Rabi (November–April)</option>
                <option value="Zaid (March–June)">Zaid (March–June)</option>
                <option value="Year-round">Year-round</option>
              </select>
            </div>
            <div className="ai-crop-field">
              <label>🪨 Soil Type</label>
              <select
                value={cropForm.soil_type}
                onChange={(e) => setCropForm((p) => ({ ...p, soil_type: e.target.value }))}
                required
                disabled={loading}
              >
                <option value="">Select soil type...</option>
                <option value="Alluvial">Alluvial</option>
                <option value="Black (Regur)">Black (Regur)</option>
                <option value="Red and Yellow">Red and Yellow</option>
                <option value="Laterite">Laterite</option>
                <option value="Arid (Desert)">Arid (Desert)</option>
                <option value="Saline/Alkaline">Saline/Alkaline</option>
                <option value="Loamy">Loamy</option>
                <option value="Sandy">Sandy</option>
                <option value="Clay">Clay</option>
              </select>
            </div>
            <div className="ai-crop-field">
              <label>💧 Water Availability</label>
              <select
                value={cropForm.availability}
                onChange={(e) => setCropForm((p) => ({ ...p, availability: e.target.value }))}
                required
                disabled={loading}
              >
                <option value="">Select availability...</option>
                <option value="High (canal/river irrigated)">High (canal/river irrigated)</option>
                <option value="Medium (bore-well/tube-well)">Medium (bore-well/tube-well)</option>
                <option value="Low (rain-fed only)">Low (rain-fed only)</option>
                <option value="Very Low (drought-prone)">Very Low (drought-prone)</option>
              </select>
            </div>
          </div>
          <div className="ai-crop-question">
            <input
              type="text"
              placeholder="Any specific question? (optional) e.g. I prefer cash crops"
              value={cropForm.question}
              onChange={(e) => setCropForm((p) => ({ ...p, question: e.target.value }))}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="ai-crop-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="geo-spinner" style={{ width: 16, height: 16 }} />
                Getting suggestions...
              </>
            ) : (
              "🌾 Get Crop Suggestions"
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default AIAssistant;
