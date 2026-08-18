import os
import shutil
from typing import Optional

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

# LangGraph agent
from app.agents.orchestrator import graph

# RAG PDF ingestion
from app.rag.ingest import ingest_pdf


# ============================================================
# FastAPI App
# ============================================================

app = FastAPI(
    title="DevPilot AI Backend API",
    version="1.0.0",
    description="Multi-agent developer assistant powered by LangGraph, Gemini and RAG",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production mein exact frontend URL use karna
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Request / Response Models
# ============================================================

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default_session"


class ChatResponse(BaseModel):
    agent_used: str
    response: str
    session_id: str


# ============================================================
# Helper: Extract clean text from Gemini/LangChain content
# ============================================================

def extract_clean_text(content) -> str:
    """
    Converts different LangChain/Gemini response formats
    into a clean string.
    """

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []

        for item in content:
            if isinstance(item, dict) and "text" in item:
                text_parts.append(str(item["text"]))

            elif isinstance(item, str):
                text_parts.append(item)

        return "\n".join(text_parts).strip()

    return str(content)


# ============================================================
# Health Check
# ============================================================

@app.get("/")
async def health_check():
    return {
        "status": "online",
        "system": "DevPilot AI",
        "version": "1.0.0",
    }


# ============================================================
# Chat Endpoint
# ============================================================

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):

    print(
        f"\n--- Incoming request ---"
        f"\nMessage: {request.message}"
        f"\nSession: {request.session_id}"
    )

    try:

        # --------------------------------------------------------
        # Initial LangGraph state
        # --------------------------------------------------------

        initial_state = {
            "messages": [
                HumanMessage(content=request.message)
            ]
        }

        # --------------------------------------------------------
        # LangGraph configuration
        # thread_id is used for conversation memory
        # --------------------------------------------------------

        config = {
            "configurable": {
                "thread_id": request.session_id
            },
            "recursion_limit": 10,
        }

        final_response = ""
        last_agent = "unknown"

        # --------------------------------------------------------
        # Run LangGraph
        # stream_mode="values" gives the complete state
        # after each graph step
        # --------------------------------------------------------

        for state in graph.stream(
            initial_state,
            config,
            stream_mode="values"
        ):

            if not state:
                continue

            messages = state.get("messages", [])

            if not messages:
                continue

            last_message = messages[-1]

            # Extract response text
            content = getattr(last_message, "content", "")

            cleaned_content = extract_clean_text(content)

            if cleaned_content:
                final_response = cleaned_content

            # Try to identify the agent/node
            message_name = getattr(last_message, "name", None)

            if message_name:
                last_agent = message_name

        # --------------------------------------------------------
        # Validate response
        # --------------------------------------------------------

        if not final_response:

            raise HTTPException(
                status_code=500,
                detail="Failed to generate agent response."
            )

        print(
            f"--- Response generated ---"
            f"\nAgent: {last_agent}"
            f"\nResponse: {final_response[:200]}..."
        )

        return ChatResponse(
            agent_used=last_agent,
            response=final_response,
            session_id=request.session_id,
        )

    except HTTPException:
        raise

    except Exception as e:

        error_message = str(e)

        print(
            f"\n❌ Backend Error:"
            f"\n{error_message}"
        )

        # --------------------------------------------------------
        # Gemini API rate limit
        # --------------------------------------------------------

        if (
            "429" in error_message
            or "RESOURCE_EXHAUSTED" in error_message
            or "quota" in error_message.lower()
        ):

            return ChatResponse(
                agent_used="system_alert",
                response=(
                    "⚠️ **API Limit Reached!** "
                    "Google Gemini's free tier has a request limit. "
                    "Please wait a little while and try again."
                ),
                session_id=request.session_id,
            )

        # --------------------------------------------------------
        # Generic backend error
        # --------------------------------------------------------

        return ChatResponse(
            agent_used="system_error",
            response=(
                "⚠️ **Server Error:** "
                "Something went wrong while processing your request."
            ),
            session_id=request.session_id,
        )


# ============================================================
# PDF Upload / RAG Endpoint
# ============================================================

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):

    # --------------------------------------------------------
    # Validate file
    # --------------------------------------------------------

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided."
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported."
        )

    # --------------------------------------------------------
    # Create upload directory
    # --------------------------------------------------------

    upload_dir = "temp_uploads"
    os.makedirs(upload_dir, exist_ok=True)

    # Prevent unsafe path traversal
    safe_filename = os.path.basename(file.filename)

    file_path = os.path.join(
        upload_dir,
        safe_filename
    )

    try:

      

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer
            )

        print(
            f"\n📄 Processing PDF: {safe_filename}"
        )

      

        success = ingest_pdf(file_path)

        if not success:

            raise HTTPException(
                status_code=500,
                detail="Failed to extract text from PDF."
            )

        print(
            f"✅ PDF processed successfully: {safe_filename}"
        )

        return {
            "status": "success",
            "message": "Document processed successfully.",
            "filename": safe_filename,
        }

    except HTTPException:
        raise

    except Exception as e:

        print(
            f"\n❌ PDF Processing Error: {str(e)}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to process document."
        )

    finally:

        

        if os.path.exists(file_path):

            try:
                os.remove(file_path)

            except Exception as cleanup_error:
                print(
                    f"⚠️ Could not delete temporary file: "
                    f"{cleanup_error}"
                )


