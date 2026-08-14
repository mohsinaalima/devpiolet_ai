import os
from langchain_community.vectorstores import PGVector
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# Database connection on port 5435
CONNECTION_STRING = os.getenv(
    "DATABASE_URL", 
    "postgresql+psycopg2://postgres:postgres@localhost:5435/devpilot"
)
COLLECTION_NAME = "devpilot_pdf_knowledge"

def get_vectorstore():
    api_key = os.getenv("GOOGLE_API_KEY")
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key
    )
    return PGVector(
        connection_string=CONNECTION_STRING,
        embedding_function=embeddings,
        collection_name=COLLECTION_NAME,
    )

def search_uploaded_documents(query: str, k: int = 3) -> str:
    """
    Searches the vector database for relevant document chunks matching the user's query.
    Returns a combined string of top matches.
    """
    try:
        vectorstore = get_vectorstore()
        docs = vectorstore.similarity_search(query, k=k)
        
        if not docs:
            return "No relevant context found in uploaded documents."
        
        context_blocks = []
        for i, doc in enumerate(docs, 1):
            source = doc.metadata.get("source", "Unknown Document")
            context_blocks.append(f"[Result {i} | Source: {source}]\n{doc.page_content}")
            
        return "\n\n---\n\n".join(context_blocks)
        
    except Exception as e:
        print(f"Error retrieving documents: {e}")
        return f"Error retrieving document context: {str(e)}"