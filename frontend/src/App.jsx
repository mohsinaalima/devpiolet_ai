import ReactMarkdown from "react-markdown";
import { useState } from "react";

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // User ka message UI mein add karein
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

    try {
      // Python FastAPI backend se connect karein
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      // AI ka response UI mein add karein
      setMessages([
        ...newMessages,
        {
          role: "ai",
          content: data.response,
          agent: data.agent_used,
        },
      ]);
    } catch (error) {
      console.error("Error communicating with DevPilot:", error);
      setMessages([
        ...newMessages,
        {
          role: "ai",
          content:
            "Error connecting to server. Is your Python backend running?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex flex-col h-screen bg-gray-900 text-gray-100 font-sans'>
      {/* Header */}
      <header className='bg-gray-800 p-4 shadow-md text-center border-b border-gray-700'>
        <h1 className='text-2xl font-bold text-blue-400'>DevPilot AI</h1>
        <p className='text-xs text-gray-400'>Your Agentic Coding Assistant</p>
      </header>

      {/* Chat History */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {messages.length === 0 && (
          <div className='text-center text-gray-500 mt-20'>
            Ask me to review a GitHub repo or search your documents!
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-3xl p-4 rounded-lg shadow-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-800 border border-gray-700 text-gray-200"}`}
            >
              {/* Show which agent handled the request */}
              {msg.agent && (
                <div className='text-xs text-green-400 mb-2 font-mono uppercase tracking-wider'>
                  ⚡ Agent: {msg.agent}
                </div>
              )}

              {/* Naya Code */}
              <div className='prose prose-invert max-w-none text-white'>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className='text-gray-400 animate-pulse pl-2'>
            DevPilot is thinking...
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className='p-4 bg-gray-800 border-t border-gray-700 flex gap-2'>
        <input
          type='text'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder='Type your message here...'
          className='flex-1 bg-gray-700 text-white p-3 rounded-md outline-none focus:ring-2 focus:ring-blue-500'
        />
        <button
          onClick={sendMessage}
          disabled={isLoading}
          className='bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-md font-semibold transition-colors disabled:opacity-50'
        >
          Send
        </button>
      </div>
    </div>
  );
}
