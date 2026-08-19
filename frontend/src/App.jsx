import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// Helper to generate unique session IDs
const generateId = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);

// ── DevPilot Color Palette ──────────────────────────────────────────
const THEME = {
  bg: "#141411",
  bgHeader: "#11110F",
  surface: "#191916",
  surfaceRaised: "#1D1D19",
  surfaceHover: "#23231F",
  border: "#2A2A24",
  borderStrong: "#3A3A32",
  ivory: "#F3F0E8",
  stoneSecondary: "#A8A49A",
  stoneMuted: "#716E66",
  copper: "#C47A52",
  copperBright: "#D98C61",
  copperMuted: "rgba(196, 122, 82, 0.12)",
  sage: "#879B7A",
};

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => {
  try {
    const savedSessions = JSON.parse(
      localStorage.getItem("devpilot_sessions") || "[]"
    );

    if (savedSessions.length === 0) return [];

    const activeId = savedSessions[0].id;

    return JSON.parse(
      localStorage.getItem(`devpilot_msgs_${activeId}`) || "[]"
    );
  } catch {
    return [];
  }
});
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  // 🆕 Chat History State
  const [sessions, setSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("devpilot_sessions") || "[]");
    } catch {
      return [];
    }
  });
  const [currentSessionId, setCurrentSessionId] = useState(generateId());

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  
  // 🆕 Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(
        `devpilot_msgs_${currentSessionId}`,
        JSON.stringify(messages),
      );
    }
    scrollToBottom();
  }, [messages, currentSessionId, isLoading]);

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    setPendingFile(null);
    setCurrentSessionId(generateId()); // Start fresh session
  };

  const handleSelectSession = (sessionId) => {
    if (sessionId === currentSessionId) return;
    setCurrentSessionId(sessionId);
    const savedMessages = JSON.parse(
      localStorage.getItem(`devpilot_msgs_${sessionId}`) || "[]",
    );
    setMessages(savedMessages);
    setInput("");
    setPendingFile(null);
  };

  const sendMessage = async (customPrompt) => {
    const textToSend = customPrompt || input;
    if ((!textToSend.trim() && !pendingFile) || isLoading) return;

    setIsLoading(true);
    const fileToUpload = pendingFile;
    setPendingFile(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

      if (fileToUpload) {
        const formData = new FormData();
        formData.append("file", fileToUpload);
        const uploadResponse = await fetch(`${API_URL}/api/upload`, {
          method: "POST",
          body: formData,
        });
        if (!uploadResponse.ok) throw new Error("Failed to ingest document.");
      }

      const finalContent =
        textToSend.trim() ||
        `Please analyze the uploaded document "${fileToUpload?.name}".`;

      // 🆕 Create/Update Session in sidebar if it's the first message
      if (messages.length === 0) {
        const newTitle =
          finalContent.length > 25
            ? finalContent.substring(0, 25) + "..."
            : finalContent;
        const newSession = {
          id: currentSessionId,
          title: newTitle,
          timestamp: Date.now(),
        };
        const updatedSessions = [newSession, ...sessions];
        setSessions(updatedSessions);
        localStorage.setItem(
          "devpilot_sessions",
          JSON.stringify(updatedSessions),
        );
      }

      const userMessage = {
        role: "user",
        content: finalContent,
        file: fileToUpload
          ? { name: fileToUpload.name, size: fileToUpload.size }
          : null,
      };

      setMessages((prev) => [...prev, userMessage]);
      if (!customPrompt) setInput("");

      // 🆕 Pass session_id to backend
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalContent,
          session_id: currentSessionId,
        }),
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
            "⚠️ **Processing Error**: Couldn't reach the chat backend server.",
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
      {/* 🆕 Updated Sidebar with props */}
      <Sidebar
        onNewChat={handleNewChat}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
      />

      <div className='flex-1 flex flex-col h-screen relative'>
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

        <div className='flex-1 overflow-y-auto px-4 py-6 md:px-12 md:py-8 space-y-6 scroll-smooth select-text'>
          {messages.length === 0 ? (
            <EmptyState onSelectPrompt={(prompt) => sendMessage(prompt)} />
          ) : (
            messages.map((msg, idx) => <MessageItem key={idx} message={msg} />)
          )}

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
                  PROCESSING
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

        <Composer
          input={input}
          setInput={setInput}
          sendMessage={() => sendMessage()}
          isLoading={isLoading}
          focused={focused}
          setFocused={setFocused}
          textareaRef={textareaRef}
          pendingFile={pendingFile}
          setPendingFile={setPendingFile}
        />
      </div>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────────────

function Sidebar({ onNewChat, sessions, currentSessionId, onSelectSession }) {
  return (
    <aside
      className='w-64 hidden md:flex flex-col p-5 select-none'
      style={{
        backgroundColor: THEME.surface,
        borderRight: `1px solid ${THEME.border}`,
      }}
    >
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

      <button
        onClick={onNewChat}
        className='w-full px-3.5 py-2.5 rounded-lg flex items-center justify-between text-sm font-medium transition-all group mb-4 hover:opacity-90'
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
      </button>

      {/* 🆕 Scrollable Chat History List */}
      <div className='flex-1 overflow-y-auto pr-2 space-y-1 mb-4 custom-scrollbar'>
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className='w-full text-left px-3 py-2 rounded-lg text-xs font-medium truncate transition-colors duration-200'
            style={{
              backgroundColor:
                currentSessionId === session.id
                  ? THEME.surfaceRaised
                  : "transparent",
              color:
                currentSessionId === session.id
                  ? THEME.ivory
                  : THEME.stoneSecondary,
              border: `1px solid ${currentSessionId === session.id ? THEME.borderStrong : "transparent"}`,
            }}
          >
            {session.title}
          </button>
        ))}
      </div>

      <div
        className='space-y-3 mb-8 pt-4 border-t'
        style={{ borderColor: THEME.border }}
      >
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

      <div
        className='mt-auto pt-4 border-t flex items-center justify-between text-xs'
        style={{ borderColor: THEME.border, color: THEME.stoneMuted }}
      >
        <div className='flex items-center gap-2'>
          <span
            className='inline-block w-2 h-2 rounded-full'
            style={{ backgroundColor: THEME.sage }}
          />
          <span>Backend Ready</span>
        </div>
        <span className='font-mono text-[10px]'>v1.1.0</span>
      </div>
    </aside>
  );
}

// ── Components below remain EXACTLY as they were in your code ──

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
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    return bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(bytes / 1024).toFixed(1)} KB`;
  };
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
        {!isUser && (
          <div
            className='text-[10px] mb-3 font-mono uppercase tracking-widest flex items-center gap-1.5'
            style={{ color: THEME.copper }}
          >
            <span style={{ color: THEME.sage }}>●</span>
            <span>Agent / {message.agent || "System"}</span>
          </div>
        )}
        {message.file && (
          <div
            className='mb-3.5 p-2.5 rounded-lg flex items-center gap-2.5 text-xs border'
            style={
              isUser
                ? {
                    backgroundColor: "rgba(0,0,0,0.15)",
                    borderColor: "rgba(0,0,0,0.2)",
                    color: "#14110C",
                  }
                : {
                    backgroundColor: THEME.bgHeader,
                    borderColor: THEME.border,
                    color: THEME.ivory,
                  }
            }
          >
            <span className='text-base'>📄</span>
            <div className='flex flex-col min-w-0'>
              <span className='font-semibold truncate'>
                {message.file.name}
              </span>
              {message.file.size && (
                <span
                  className='text-[10px]'
                  style={{
                    color: isUser ? "rgba(20,17,12,0.7)" : THEME.stoneMuted,
                  }}
                >
                  {formatFileSize(message.file.size)} • PDF Document
                </span>
              )}
            </div>
          </div>
        )}
        <div
          className={`prose prose-invert max-w-none text-sm leading-relaxed ${isUser ? "font-medium" : ""}`}
        >
          <ReactMarkdown
            components={{
              code({ inline, className, children, ...props }) {
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
  pendingFile,
  setPendingFile,
}) {
  const fileInputRef = useRef(null);
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      alert("Please select a valid PDF file.");
      return;
    }
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          className='rounded-2xl transition-all flex flex-col p-2'
          style={{
            backgroundColor: THEME.surface,
            border: `1px solid ${pendingFile ? THEME.copper : focused ? THEME.copper : THEME.border}`,
            boxShadow: focused ? `0 0 12px ${THEME.copperMuted}` : "none",
          }}
        >
          {pendingFile && (
            <div
              className='m-2 inline-flex items-center gap-3 p-3 rounded-xl max-w-sm relative border select-none'
              style={{
                backgroundColor: "#262622",
                borderColor: THEME.borderStrong,
              }}
            >
              <button
                onClick={() => setPendingFile(null)}
                className='absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stone-200 text-stone-900 flex items-center justify-center text-[10px] font-bold shadow hover:bg-white transition-colors'
                title='Remove attachment'
              >
                ✕
              </button>
              <div className='w-8 h-9 rounded-md bg-red-950/60 border border-red-700/50 flex flex-col items-center justify-center flex-shrink-0'>
                <span className='text-[9px] font-black text-red-500 uppercase tracking-tight leading-none'>
                  PDF
                </span>
              </div>
              <div className='flex flex-col min-w-0 pr-2'>
                <span className='text-xs font-semibold truncate text-stone-200'>
                  {pendingFile.name}
                </span>
                <span className='text-[10px] text-stone-400 font-medium'>
                  PDF
                </span>
              </div>
            </div>
          )}
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              pendingFile
                ? "Ask anything about this PDF..."
                : "Ask DevPilot, attach a PDF, or request code reviews..."
            }
            className='w-full px-3 py-2 bg-transparent outline-none resize-none text-sm placeholder-stone-600'
            style={{ color: THEME.ivory }}
          />
          <div className='flex items-center justify-between px-2 pt-1 pb-1'>
            <div className='flex items-center gap-2'>
              <input
                type='file'
                accept='.pdf'
                ref={fileInputRef}
                onChange={handleFileSelect}
                className='hidden'
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className='px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5 hover:opacity-80 disabled:opacity-50'
                style={{
                  color: THEME.stoneMuted,
                  backgroundColor: THEME.bgHeader,
                }}
              >
                <span className='text-[14px]'>📎</span>
                <span>Attach PDF</span>
              </button>
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && !pendingFile)}
              className='ml-auto px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
              style={{
                backgroundColor:
                  isLoading || (!input.trim() && !pendingFile)
                    ? THEME.surfaceRaised
                    : THEME.copper,
                color:
                  isLoading || (!input.trim() && !pendingFile)
                    ? THEME.stoneMuted
                    : "#14110C",
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
