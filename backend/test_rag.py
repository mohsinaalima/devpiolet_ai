import os
from dotenv import load_dotenv
from app.rag.retriever import search_uploaded_documents

load_dotenv()

if __name__ == "__main__":
    # Query something specific to your CV
    query = "What skills and experience are mentioned in the resume?"
    print(f" Querying Vector Store for: '{query}'\n")
    
    results = search_uploaded_documents(query, k=2)
    print("RESULTS RETURNED FROM PGVECTOR:")
    print("=" * 40)
    print(results)
    print("=" * 40)