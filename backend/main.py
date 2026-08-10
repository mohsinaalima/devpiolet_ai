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
    
    # Run the graph
    final_response = "I'm sorry, I couldn't process that."
    last_agent = ""
    
    for output in graph.stream(initial_state, {"recursion_limit": 10}):
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