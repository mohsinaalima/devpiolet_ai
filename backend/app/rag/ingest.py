import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import PGVector

# Connection string to your local Docker PostgreSQL database
CONNECTION_STRING = "postgresql+psycopg2://devpilot:devpilot_password@127.0.0.1:5454/devpilot_db"
COLLECTION_NAME = "devpilot_documents"

def ingest_pdf(file_path: str):
    print(f"Loading {file_path}...")
    
    # 1. Load the PDF
    loader = PyPDFLoader(file_path)
    docs = loader.load()
    
    # 2. Chop the text into smaller, digestible chunks (1000 characters each)
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_documents(docs)
    print(f"Split into {len(chunks)} chunks.")
    
    # 3. Initialize the free, local embedding model
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    # 4. Save chunks and embeddings into PostgreSQL (pgvector)
    print("Saving to PostgreSQL database...")
    db = PGVector.from_documents(
        embedding=embeddings,
        documents=chunks,
        collection_name=COLLECTION_NAME,
        connection_string=CONNECTION_STRING,
    )
    print("Ingestion complete! 🚀")

if __name__ == "__main__":
    # We will test this shortly!
    pass