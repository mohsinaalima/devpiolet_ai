import os
from typing import Annotated, Sequence, TypedDict, Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

# Your custom tools
from app.tools.rag_tools import search_uploaded_documents
from app.tools.github import get_github_file_contents

load_dotenv()

# ---------------------------------------------------------
# State & Routing Definitions
# ---------------------------------------------------------

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    next_agent: str

class Route(BaseModel):
    next_agent: Literal[
        "coding_agent",
        "research_agent",
        "rag_agent",
    ] = Field(description="The next agent to route the user's request to.")

class ReviewDecision(BaseModel):
    action: Literal["approve", "needs_revisions"] = Field(
        description="Whether the response is ready for the user, or needs more work."
    )
    target_agent: Literal["coding_agent", "research_agent", "rag_agent", "none"] = Field(
        description="Which agent should fix the issue if revisions are needed. If approved, select 'none'."
    )
    feedback: str = Field(
        description="Detailed feedback on what needs to be fixed. Leave empty if approved."
    )

# ---------------------------------------------------------
# Helper: Centralized LLM (Fixes all model name issues!)
# ---------------------------------------------------------

def get_llm():
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Gemini API key not found in .env file.")
    return ChatGoogleGenerativeAI(
        model="gemini-3.5-flash-lite", 
        api_key=api_key,
    )

# ---------------------------------------------------------
# Agent Nodes
# ---------------------------------------------------------

def supervisor_node(state: AgentState) -> dict:
    print("\n[Supervisor] Routing request...")
    llm = get_llm()
    router = llm.with_structured_output(Route)

    system_prompt = """
You are the DevPilot AI Orchestrator.
Route the user's request to the most appropriate specialized agent.

1. coding_agent (GitHub analysis, Debugging, Code reviews)
2. rag_agent (Questions about uploaded documents, PDFs)
3. research_agent (General tech research, architecture decisions)

Return exactly one valid agent name.
"""
    messages = [SystemMessage(content=system_prompt)] + list(state["messages"])
    decision = router.invoke(messages)
    
    print(f"[Supervisor] Selected: {decision.next_agent}")
    return {"next_agent": decision.next_agent}

def coding_agent(state: AgentState) -> dict:
    print("\n[Coding Agent] Analyzing code...")
    llm = get_llm()
    tools = [get_github_file_contents]
    agent = create_react_agent(llm, tools)

    system_prompt = SystemMessage(
        content=(
            "You are an elite AI Software Engineer. "
            "Analyze code, find bugs, and suggest fixes. "
            "If the Reviewer gives you feedback, follow their instructions strictly to revise your work."
        )
    )

    input_messages = [system_prompt] + list(state["messages"])
    result = agent.invoke({"messages": input_messages})
    
    return {"messages": result["messages"][len(input_messages):]}

def research_agent(state: AgentState) -> dict:
    print("\n[Research Agent] Gathering information...")
    llm = get_llm()

    system_prompt = SystemMessage(
        content=(
            "You are the DevPilot AI Research Agent. "
            "Provide accurate, clear technical explanations and comparisons. "
            "If the Reviewer gives you feedback, update your research accordingly."
        )
    )

    messages = [system_prompt] + list(state["messages"])
    response = llm.invoke(messages)
    return {"messages": [response]}

def rag_agent(state: AgentState) -> dict:
    print("\n[RAG Agent] Searching documents...")
    llm = get_llm()
    tools = [search_uploaded_documents]
    agent = create_react_agent(llm, tools)
    
    system_prompt = SystemMessage(
        content=(
            "You are a helpful AI Document Assistant. "
            "Base your answers strictly on the context retrieved from the tool."
        )
    )
    
    input_messages = [system_prompt] + list(state["messages"])
    result = agent.invoke({"messages": input_messages})
    
    return {"messages": result["messages"][len(input_messages):]}

def reviewer_agent(state: AgentState) -> dict:
    print("\n[Reviewer Agent] Evaluating team's work...")
    llm = get_llm()
    reviewer_llm = llm.with_structured_output(ReviewDecision)

    conversation = "\n\n".join(
        f"{msg.__class__.__name__}: {msg.content}"
        for msg in state["messages"][-4:] 
    )

    review_prompt = f"""
    You are the Lead Technical Reviewer. 
    Review the specialist agent's work below.
    
    If the answer fully and accurately solves the user's request, select 'approve'.
    If there are bugs, missing details, or poor explanations, select 'needs_revisions' 
    and provide strict 'feedback' on what the agent must fix.
    
    Conversation to review:
    {conversation}
    """

    decision = reviewer_llm.invoke([HumanMessage(content=review_prompt)])

    if decision.action == "approve":
        print("[Reviewer Agent] ✅ Work approved! Synthesizing final response.")
        final_prompt = "Based on the conversation, provide the final, polished answer to the user. Do not mention internal reviews."
        final_response = llm.invoke(list(state["messages"]) + [HumanMessage(content=final_prompt)])
        
        return {
            "messages": [final_response],
            "next_agent": "END"
        }
    else:
        print(f"[Reviewer Agent] ❌ Revisions needed. Sending back to {decision.target_agent}...")
        print(f"Feedback: {decision.feedback}")
        
        feedback_message = HumanMessage(
            content=f"Lead Reviewer Feedback: {decision.feedback}\n\nPlease revise your previous response."
        )
        return {
            "messages": [feedback_message],
            "next_agent": decision.target_agent
        }

# ---------------------------------------------------------
# Graph Construction & Wiring
# ---------------------------------------------------------

builder = StateGraph(AgentState)

builder.add_node("supervisor", supervisor_node)
builder.add_node("coding_agent", coding_agent)
builder.add_node("research_agent", research_agent)
builder.add_node("rag_agent", rag_agent)
builder.add_node("reviewer_agent", reviewer_agent)

builder.add_edge(START, "supervisor")

builder.add_conditional_edges(
    "supervisor",
    lambda state: state["next_agent"],
    {
        "coding_agent": "coding_agent",
        "research_agent": "research_agent",
        "rag_agent": "rag_agent",
    },
)

builder.add_edge("coding_agent", "reviewer_agent")
builder.add_edge("research_agent", "reviewer_agent")
builder.add_edge("rag_agent", "reviewer_agent")

builder.add_conditional_edges(
    "reviewer_agent",
    lambda state: state["next_agent"],
    {
        "coding_agent": "coding_agent",
        "research_agent": "research_agent",
        "rag_agent": "rag_agent",
        "END": END
    },
)

memory = MemorySaver()
graph = builder.compile(checkpointer=memory)

if __name__ == "__main__":
    print("DevPilot AI Agent Graph compiled successfully with Collaboration Loop.")