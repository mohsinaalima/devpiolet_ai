import uuid
from langchain_core.messages import HumanMessage
from app.agents.orchestrator import graph

def run_test():
    print("🚀 Starting DevPilot AI Team Test...\n")
    
    # Memory ke liye ek unique Thread ID banana zaroori hai
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    # Yeh woh question hai jo hum AI ko de rahe hain
    user_query = "What is the difference between Docker and Virtual Machines? Keep it very short."
    print(f"👤 User Question: {user_query}\n")
    print("-" * 50)
    
    # Graph/Agents ko start karna
    input_state = {"messages": [HumanMessage(content=user_query)]}
    
    # Graph ko run karna
    for event in graph.stream(input_state, config, stream_mode="values"):
        # Graph ke andar jo print() statements hain, woh yahan terminal mein output dikhayenge
        pass
        
    print("-" * 50)
    
    # Final answer nikalna
    final_state = graph.get_state(config)
    final_message = final_state.values["messages"][-1]
    
    print("\n✅ Final AI Response for User:")
    print(final_message.content)

if __name__ == "__main__":
    run_test()