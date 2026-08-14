import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// ── DevPilot Color Palette ──────────────────────────────────────────
const THEME = {
  bg: "#141411", // primary background
  bgHeader: "#11110F", // deepest surface
  surface: "#191916", // sidebar / composer
  surfaceRaised: "#1D1D19", // cards / AI bubbles
  surfaceHover: "#23231F",
  border: "#2A2A24", // subtle warm gray border
  borderStrong: "#3A3A32",
  ivory: "#F3F0E8", // primary text
  stoneSecondary: "#A8A49A", // secondary text
  stoneMuted: "#716E66", // muted text
  copper: "#C47A52", // main accent
  copperBright: "#D98C61", // hover accent
  copperMuted: "rgba(196, 122, 82, 0.12)",
  sage: "#879B7A", // operational status indicator
};

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
  };

  const sendMessage = async (customPrompt) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = { role: "user", content: textToSend };

    setMessages((prev) => [...prev, userMessage]);
    if (!customPrompt) setInput("");
    setIsLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: data.response || "No response received.",
          agent: data.agent_used || "Router",
        },
      ]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "⚠️ **Connection Error**: Couldn't reach the backend server. Please verify your API status.",
          agent: "System",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className='flex h-screen font-sans overflow-hidden antialiased select-none'
      style={{ backgroundColor: THEME.bg, color: THEME.ivory }}
    >
      {/* Sidebar */}
      <Sidebar onNewChat={handleNewChat} messageCount={messages.length} />

      {/* Main Chat Workspace */}
      <div className='flex-1 flex flex-col h-screen relative'>
        {/* Mobile Header */}
        <header
          className='p-4 flex items-center justify-between md:hidden z-10'
          style={{
            backgroundColor: THEME.bgHeader,
            borderBottom: `1px solid ${THEME.border}`,
          }}
        >
          <div className='flex items-center gap-2'>
            <span
              className='font-semibold tracking-tight text-base'
              style={{ color: THEME.ivory }}
            >
              DEV<span style={{ color: THEME.copper }}>PILOT</span>
            </span>
          </div>
          <button
            onClick={handleNewChat}
            className='text-xs px-2.5 py-1.5 rounded font-medium transition-colors'
            style={{
              backgroundColor: THEME.surfaceRaised,
              border: `1px solid ${THEME.border}`,
              color: THEME.ivory,
            }}
          >
            + New
          </button>
        </header>

        {/* Message Feed */}
        <div className='flex-1 overflow-y-auto px-4 py-6 md:px-12 md:py-8 space-y-6 scroll-smooth select-text'>
          {messages.length === 0 ? (
            <EmptyState onSelectPrompt={(prompt) => sendMessage(prompt)} />
          ) : (
            messages.map((msg, idx) => <MessageItem key={idx} message={msg} />)
          )}

          {/* Thinking Indicator */}
          {isLoading && (
            <div className='flex justify-start'>
              <div
                className='px-4 py-3 rounded-2xl flex items-center gap-2'
                style={{
                  backgroundColor: THEME.surfaceRaised,
                  border: `1px solid ${THEME.border}`,
                  borderBottomLeftRadius: 4,
                }}
              >
                <span
                  className='text-xs font-mono tracking-wider mr-2'
                  style={{ color: THEME.stoneMuted }}
                >
                  THINKING
                </span>
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className='w-1.5 h-1.5 rounded-full animate-bounce'
                    style={{
                      backgroundColor: THEME.copper,
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer / Input Area */}
        <Composer
          input={input}
          setInput={setInput}
          sendMessage={() => sendMessage()}
          isLoading={isLoading}
          focused={focused}
          setFocused={setFocused}
          textareaRef={textareaRef}
        />
      </div>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────

function Sidebar({ onNewChat, messageCount }) {
  return (
    <aside
      className='w-64 hidden md:flex flex-col p-5 select-none'
      style={{
        backgroundColor: THEME.surface,
        borderRight: `1px solid ${THEME.border}`,
      }}
    >
      {/* Brand Header */}
      <div className='mb-8'>
        <div
          className='text-[10px] tracking-[0.2em] font-mono uppercase mb-1.5'
          style={{ color: THEME.stoneMuted }}
        >
          Engineering Assistant
        </div>
        <h1
          className='text-xl font-bold tracking-tight'
          style={{ color: THEME.ivory }}
        >
          DEV<span style={{ color: THEME.copper }}>PILOT</span>
        </h1>
      </div>

      {/* New Conversation Button */}
      <button
        onClick={onNewChat}
        className='w-full px-3.5 py-2.5 rounded-lg flex items-center justify-between text-sm font-medium transition-all group mb-6 hover:opacity-90'
        style={{
          backgroundColor: THEME.surfaceRaised,
          border: `1px solid ${THEME.border}`,
          color: THEME.ivory,
        }}
      >
        <div className='flex items-center gap-2'>
          <span style={{ color: THEME.copper }}>+</span>
          <span>New session</span>
        </div>
        {messageCount > 0 && (
          <span
            className='text-[10px] px-1.5 py-0.5 rounded font-mono'
            style={{ backgroundColor: THEME.bg, color: THEME.stoneMuted }}
          >
            {messageCount}
          </span>
        )}
      </button>

      {/* Capabilities Overview */}
      <div className='space-y-3 mb-8'>
        <div
          className='text-[11px] font-mono uppercase tracking-wider'
          style={{ color: THEME.stoneMuted }}
        >
          Capabilities
        </div>
        <div
          className='space-y-2 text-xs'
          style={{ color: THEME.stoneSecondary }}
        >
          <div className='flex items-center gap-2.5'>
            <span style={{ color: THEME.copper }}>◆</span> Multi-Agent
            Orchestration
          </div>
          <div className='flex items-center gap-2.5'>
            <span style={{ color: THEME.copper }}>◆</span> Contextual RAG Search
          </div>
          <div className='flex items-center gap-2.5'>
            <span style={{ color: THEME.copper }}>◆</span> Code & Architecture
            Review
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div
        className='mt-auto pt-4 border-t border-[#22221D] flex items-center justify-between text-xs'
        style={{ color: THEME.stoneMuted }}
      >
        <div className='flex items-center gap-2'>
          <span
            className='inline-block w-2 h-2 rounded-full'
            style={{ backgroundColor: THEME.sage }}
          />
          <span>Backend Ready</span>
        </div>
        <span className='font-mono text-[10px]'>v1.0.0</span>
      </div>
    </aside>
  );
}

function EmptyState({ onSelectPrompt }) {
  const prompts = [
    {
      label: "Debug Code",
      text: "I have a bug in my async code. Can you help me trace it?",
    },
    {
      label: "Architecture",
      text: "Compare PostgreSQL vs MongoDB for high-throughput time-series data.",
    },
    {
      label: "Refactor",
      text: "How can I refactor this function to be more clean and performant?",
    },
  ];

  return (
    <div className='flex flex-col items-center justify-center min-h-[70vh] text-center max-w-xl mx-auto px-4'>
      <div
        className='w-12 h-12 rounded-xl mb-4 flex items-center justify-center font-bold text-lg'
        style={{
          backgroundColor: THEME.copperMuted,
          color: THEME.copper,
          border: `1px solid ${THEME.border}`,
        }}
      >
        DP
      </div>
      <h2
        className='text-3xl font-bold tracking-tight mb-2'
        style={{ color: THEME.ivory }}
      >
        DEV<span style={{ color: THEME.copper }}>PILOT</span>
      </h2>
      <p
        className='text-sm mb-8 leading-relaxed'
        style={{ color: THEME.stoneSecondary }}
      >
        High-precision engineering intelligence. Drop code, debug errors, or
        discuss system architecture without fluff.
      </p>

      {/* Quick Suggestions */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 w-full'>
        {prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelectPrompt(p.text)}
            className='p-3.5 rounded-xl text-left transition-all hover:-translate-y-0.5'
            style={{
              backgroundColor: THEME.surfaceRaised,
              border: `1px solid ${THEME.border}`,
            }}
          >
            <div
              className='text-xs font-semibold mb-1'
              style={{ color: THEME.copper }}
            >
              {p.label}
            </div>
            <div
              className='text-[11px] line-clamp-2 leading-snug'
              style={{ color: THEME.stoneMuted }}
            >
              {p.text}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageItem({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className='max-w-3xl w-full p-5 rounded-2xl shadow-sm transition-all'
        style={
          isUser
            ? {
                backgroundColor: THEME.copper,
                color: "#14110C",
                borderBottomRightRadius: 4,
              }
            : {
                backgroundColor: THEME.surfaceRaised,
                border: `1px solid ${THEME.border}`,
                color: THEME.ivory,
                borderBottomLeftRadius: 4,
              }
        }
      >
        {/* Agent Badge */}
        {!isUser && (
          <div
            className='text-[10px] mb-3 font-mono uppercase tracking-widest flex items-center gap-1.5'
            style={{ color: THEME.copper }}
          >
            <span style={{ color: THEME.sage }}>●</span>
            <span>Agent / {message.agent || "System"}</span>
          </div>
        )}

        {/* Content */}
        <div
          className={`prose prose-invert max-w-none text-sm leading-relaxed ${isUser ? "font-medium" : ""}`}
        >
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                return !inline && match ? (
                  <div
                    className='my-3 rounded-lg overflow-hidden border'
                    style={{ borderColor: THEME.border }}
                  >
                    <div
                      className='px-3 py-1 text-[10px] font-mono uppercase flex justify-between items-center'
                      style={{
                        backgroundColor: THEME.bgHeader,
                        color: THEME.stoneMuted,
                      }}
                    >
                      <span>{match[1]}</span>
                    </div>
                    <SyntaxHighlighter
                      {...props}
                      children={String(children).replace(/\n$/, "")}
                      style={atomDark}
                      language={match[1]}
                      PreTag='div'
                      customStyle={{
                        margin: 0,
                        padding: "1rem",
                        backgroundColor: THEME.bgHeader,
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>
                ) : (
                  <code
                    {...props}
                    className='px-1.5 py-0.5 rounded font-mono text-xs'
                    style={
                      isUser
                        ? {
                            backgroundColor: "rgba(0,0,0,0.15)",
                            color: "#14110C",
                          }
                        : {
                            backgroundColor: THEME.bgHeader,
                            color: THEME.copper,
                          }
                    }
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function Composer({
  input,
  setInput,
  sendMessage,
  isLoading,
  focused,
  setFocused,
  textareaRef,
}) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a valid PDF file.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        sendMessage(
          `I just uploaded a document named ${file.name}. Please confirm you can read it, and I will ask you questions about it.`,
        );
      } else {
        alert("Upload failed. Check backend logs.");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className='p-4 md:p-6'
      style={{
        backgroundColor: THEME.bg,
        borderTop: `1px solid ${THEME.border}`,
      }}
    >
      <div className='max-w-4xl mx-auto relative'>
        <div
          className='rounded-xl transition-all flex flex-col'
          style={{
            backgroundColor: THEME.surface,
            border: `1px solid ${focused ? THEME.copper : THEME.border}`,
            boxShadow: focused ? `0 0 12px ${THEME.copperMuted}` : "none",
          }}
        >
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder='Ask DevPilot, attach a PDF, or request code reviews...'
            className='w-full p-4 pr-24 bg-transparent outline-none resize-none text-sm placeholder-stone-600'
            style={{ color: THEME.ivory }}
          />

          <div className='flex items-center justify-between px-3 pb-3'>
            <div className='flex items-center gap-2'>
              <input
                type='file'
                accept='.pdf'
                ref={fileInputRef}
                onChange={handleFileUpload}
                className='hidden'
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isLoading}
                className='px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5'
                style={{
                  color: THEME.stoneMuted,
                  backgroundColor: THEME.bgHeader,
                }}
              >
                <span className='text-[14px]'>📎</span>
                {isUploading ? "Uploading..." : "Attach PDF"}
              </button>
            </div>

            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className='ml-auto px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
              style={{
                backgroundColor:
                  isLoading || !input.trim()
                    ? THEME.surfaceRaised
                    : THEME.copper,
                color:
                  isLoading || !input.trim() ? THEME.stoneMuted : "#14110C",
              }}
            >
              <span>SEND</span>
              <span>↗</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
