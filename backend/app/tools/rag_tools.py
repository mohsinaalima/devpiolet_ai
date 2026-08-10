from langchain_core.tools import tool
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import PGVector

CONNECTION_STRING = "postgresql+psycopg2://devpilot:devpilot_password@127.0.0.1:5454/devpilot_db"
COLLECTION_NAME = "devpilot_documents"

@tool
def search_uploaded_documents(query: str) -> str:
    """
    Searches the user's uploaded PDFs and documents for answers.
    Use this tool whenever the user asks about their own documents, resumes, or specific uploaded files.
    """
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    # Connect to the existing pgvector database
    db = PGVector(
        collection_name=COLLECTION_NAME,
        connection_string=CONNECTION_STRING,
        embedding_function=embeddings,
    )
    
    # Perform a similarity search
    results = db.similarity_search(query, k=3)
    
    if not results:
        return "No relevant information found in the uploaded documents."
        
    # Combine the retrieved chunks into a single readable string
    formatted_results = "\n\n".join([doc.page_content for doc in results])
    return f"Found the following information in the documents:\n{formatted_results}"