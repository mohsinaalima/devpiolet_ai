from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

# Import your working LangGraph setup
from app.agents.orchestrator import graph

app = FastAPI(title="DevPilot AI Backend")

# Allow the React frontend (usually running on localhost:5173 or 3000) to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the shape of the data coming from the frontend
class ChatRequest(BaseModel):
    message: str

# Helper function to clean up Google's raw output format
def extract_clean_text(content):
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        # Extract text if the LLM returns a list of dictionaries
        return "\n".join([item.get("text", "") for item in content if isinstance(item, dict) and "text" in item])
    return str(content)

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"\n--- Incoming request from frontend: '{request.message}' ---")
    
    initial_state = {"messages": [HumanMessage(content=request.message)]}
    
    try:
        final_response = "I'm sorry, I couldn't process that."
        last_agent = ""

        config = {
            "configurable": {"thread_id": "user_session_1"}, 
            "recursion_limit": 10
        }
        # Run the graph
        for output in graph.stream(initial_state, config):

            for node_name, state in output.items():
                last_agent = node_name
                if "messages" in state:
                    # Get the content of the very last message generated
                    raw_content = state["messages"][-1].content
                    final_response = extract_clean_text(raw_content)

        return {
            "agent_used": last_agent,
            "response": final_response
        }
        
    except Exception as e:
        error_message = str(e)
        print(f"\n❌ Backend Error: {error_message}")
        
        # Agar Google API limit hit hoti hai
        if "429" in error_message or "RESOURCE_EXHAUSTED" in error_message:
            return {
                "agent_used": "system_alert",
                "response": "⚠️ **API Limit Reached!** Google Gemini's free tier allows a limited number of requests per minute. Please wait about 60 seconds and try again."
            }
        
        # Kisi aur error ke liye
        return {
            "agent_used": "system_error",
            "response": f"⚠️ **Server Error:** Oops, something went wrong on the backend."
        }