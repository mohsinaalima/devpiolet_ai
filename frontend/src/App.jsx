import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scroll ke liye ref
  const messagesEndRef = useRef(null);

  // Jab bhi messages update honge, yeh automatically neeche scroll kar dega
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      setMessages([
        ...newMessages,
        {
          role: "ai",
          content: data.response,
          agent: data.agent_used,
        },
      ]);
    } catch (error) {
      console.error("Error:", error);
      setMessages([
        ...newMessages,
        {
          role: "ai",
          content:
            "⚠️ Error connecting to server. Is your Python backend running?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden'>
      {/* Sidebar (Optional - For future File Uploads or History) */}
      <div className='w-64 bg-gray-950 border-r border-gray-800 hidden md:flex flex-col p-4'>
        <h2 className='text-xl font-bold text-blue-500 mb-6 flex items-center gap-2'>
          🚀 DevPilot AI
        </h2>
        <div className='text-sm text-gray-400'>
          <p className='mb-2'>✓ Multi-Agent System</p>
          <p className='mb-2'>✓ RAG Document Search</p>
          <p className='mb-2'>✓ Smart Routing</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className='flex-1 flex flex-col h-screen'>
        {/* Header */}
        <header className='bg-gray-800 p-4 shadow-md text-center border-b border-gray-700 md:hidden'>
          <h1 className='text-xl font-bold text-blue-400'>DevPilot AI</h1>
        </header>

        {/* Chat History */}
        <div className='flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth'>
          {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center h-full text-gray-500'>
              <span className='text-4xl mb-4'>👋</span>
              <p className='text-lg'>How can I help you code today?</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-4xl p-5 rounded-2xl shadow-md ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-none"}`}
              >
                {msg.agent && (
                  <div className='text-xs text-green-400 mb-3 font-mono uppercase tracking-widest flex items-center gap-1'>
                    <span>⚡ Agent: {msg.agent}</span>
                  </div>
                )}

                {/* Advanced Markdown Rendering with Code Highlighting */}
                <div className='prose prose-invert max-w-none prose-pre:bg-transparent prose-pre:p-0'>
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <SyntaxHighlighter
                            {...props}
                            children={String(children).replace(/\n$/, "")}
                            style={atomDark}
                            language={match[1]}
                            PreTag='div'
                            className='rounded-md mt-2 mb-2 text-sm'
                          />
                        ) : (
                          <code
                            {...props}
                            className='bg-gray-700 text-blue-300 px-1 py-0.5 rounded text-sm'
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className='flex justify-start'>
              <div className='bg-gray-800 border border-gray-700 text-gray-400 p-4 rounded-2xl rounded-bl-none flex items-center gap-2'>
                <div
                  className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
            </div>
          )}
          {/* This empty div acts as the anchor for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className='p-4 bg-gray-900 border-t border-gray-800'>
          <div className='max-w-4xl mx-auto flex gap-2 relative'>
            <input
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder='Ask anything or request a code review...'
              className='flex-1 bg-gray-800 text-white p-4 pr-32 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700'
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className='absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
