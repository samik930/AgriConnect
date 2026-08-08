import { useState, useRef, useEffect } from "react";
import axios from "axios";

const MODES = {
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

const AIAssistant = () => {
  const [mode, setMode] = useState(MODES.CHAT);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello farmer 👨‍🌾! I'm your AI farming assistant powered by Gemini.\n\nChoose a mode:\n• **Ask AI** — Ask anything about crops, diseases, fertilizers, or farming practices.\n• **Crop Suggestion** — Get personalized crop recommendations based on your location, season, soil & water.",
    },
  ]);

  // Chat mode state
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
    if (newMode === MODES.CROP) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "🌾 Crop Suggestion Mode activated!\n\nFill in the form below with your farm details and I'll recommend the best crops for you.",
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "💬 General Chat Mode activated!\n\nAsk me anything about farming — diseases, fertilizers, irrigation, market tips, and more.",
        },
      ]);
    }
  };

  /* ── General chat send ── */
  const sendQuestion = async () => {
    if (!question.trim() || loading) return;

    const userMsg = { role: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await axios.post(
        "/api/ai/assistant",
        { question: userMsg.text },
        { withCredentials: true }
      );
      setMessages((prev) => [...prev, { role: "ai", text: res.data.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, I'm unable to respond right now. Please try again." },
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

    // Show user's form details as a chat message
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

  const chatSuggestions = [
    "Best fertilizer for wheat?",
    "How to treat tomato blight?",
    "When to sow paddy?",
    "Tips for drip irrigation?",
  ];

  return (
    <div className="ai-assistant-wrapper">
      {/* ── Header ── */}
      <div className="ai-assistant-header">
        <div className="ai-header-icon">🤖</div>
        <div>
          <h2 className="db-section-title" style={{ margin: 0, fontSize: "1.4rem" }}>
            🌱 AI Farming Assistant
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
            Powered by Gemini AI · Two modes: chat &amp; crop suggestion
          </p>
        </div>
        <div className="ai-status-dot">
          <span className="ai-status-indicator"></span>
          Online
        </div>
      </div>

      {/* ── Mode Toggle ── */}
      <div className="ai-mode-toggle">
        <button
          className={`ai-mode-btn ${mode === MODES.CHAT ? "active" : ""}`}
          onClick={() => handleModeSwitch(MODES.CHAT)}
        >
          💬 Ask AI
        </button>
        <button
          className={`ai-mode-btn ${mode === MODES.CROP ? "active" : ""}`}
          onClick={() => handleModeSwitch(MODES.CROP)}
        >
          🌾 Crop Suggestion
        </button>
      </div>

      {/* ── Chat suggestions (chat mode, initial state) ── */}
      {mode === MODES.CHAT && messages.length <= 2 && (
        <div className="ai-suggestions">
          <p className="ai-suggestions-label">Try asking:</p>
          <div className="ai-suggestions-grid">
            {chatSuggestions.map((q, i) => (
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
            {msg.role === "ai" && <div className="ai-avatar">🤖</div>}
            <div className={`ai-bubble ${msg.role === "user" ? "ai-bubble-user" : "ai-bubble-ai"}`}>
              {msg.text}
            </div>
            {msg.role === "user" && <div className="ai-avatar ai-avatar-user">👨‍🌾</div>}
          </div>
        ))}

        {loading && (
          <div className="ai-message-row ai-message-ai">
            <div className="ai-avatar">🤖</div>
            <div className="ai-bubble ai-bubble-ai ai-thinking">
              <span className="ai-dot"></span>
              <span className="ai-dot"></span>
              <span className="ai-dot"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area: chat mode ── */}
      {mode === MODES.CHAT && (
        <div className="ai-input-area">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about crops, diseases, fertilizers..."
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