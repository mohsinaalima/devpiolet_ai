from fastapi import File, UploadFile, HTTPException
import shutil
import os
from app.rag.ingest import ingest_pdf
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

# Import your working LangGraph setup
from app.agents.orchestrator import graph

app = FastAPI(title="DevPilot AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1️⃣ UPDATE: Add session_id to the request model
class ChatRequest(BaseModel):
    message: str
    session_id: str = "default_session"

def extract_clean_text(content):
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        return "\n".join([item.get("text", "") for item in content if isinstance(item, dict) and "text" in item])
    return str(content)

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    print(f"\n--- Incoming request from frontend: '{request.message}' for session '{request.session_id}' ---")
    
    initial_state = {"messages": [HumanMessage(content=request.message)]}
    
    try:
        final_response = "I'm sorry, I couldn't process that."
        last_agent = ""

        # 2️⃣ UPDATE: Use the dynamic session_id for LangGraph memory
        config = {
            "configurable": {"thread_id": request.session_id}, 
            "recursion_limit": 10
        }
        
        for output in graph.stream(initial_state, config):
            for node_name, state in output.items():
                last_agent = node_name
                if "messages" in state:
                    raw_content = state["messages"][-1].content
                    final_response = extract_clean_text(raw_content)

        return {
            "agent_used": last_agent,
            "response": final_response
        }
        
    except Exception as e:
        error_message = str(e)
        print(f"\n❌ Backend Error: {error_message}")
        
        if "429" in error_message or "RESOURCE_EXHAUSTED" in error_message:
            return {
                "agent_used": "system_alert",
                "response": "⚠️ **API Limit Reached!** Google Gemini's free tier allows a limited number of requests per minute. Please wait about 60 seconds and try again."
            }
        
        return {
            "agent_used": "system_error",
            "response": f"⚠️ **Server Error:** Oops, something went wrong on the backend."
        }
    
@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    upload_dir = "temp_uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        success = ingest_pdf(file_path)
        
        if success:
            return {"status": "success", "message": "Document processed", "filename": file.filename}
        else:
            raise HTTPException(status_code=500, detail="Failed to extract text from PDF.")
            
    except Exception as e:
        print(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail="Failed to process document.")