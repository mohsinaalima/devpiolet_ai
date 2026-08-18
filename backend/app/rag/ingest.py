import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import PGVector

# Load environment variables at module initialization
load_dotenv()

COLLECTION_NAME = "devpilot_pdf_knowledge"


def get_connection_string() -> str:
    """Fetch connection string dynamically at runtime."""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url
    
    # Fallback matching your running Docker container port (5454)
    return "postgresql+psycopg2://postgres:postgres@localhost:5454/devpilot_db"


def ingest_pdf(file_path: str) -> bool:
    """
    Load a PDF, split it into chunks, generate Gemini embeddings,
    and store the embeddings in PostgreSQL using PGVector.
    """
    print(f"\n--- Starting PDF Ingestion: {file_path} ---")

    try:
        connection_string = get_connection_string()
        print(f"Connecting to database using: {connection_string.split('@')[-1]}")

        # --------------------------------------------------
        # 1. Load PDF
        # --------------------------------------------------
        print("Step 1: Loading document...")
        loader = PyPDFLoader(file_path)
        documents = loader.load()

        print(f"-> Loaded {len(documents)} pages.")

        if not documents:
            raise ValueError("PDF contains no readable pages.")

        # --------------------------------------------------
        # 2. Split document
        # --------------------------------------------------
        print("Step 2: Splitting text into chunks...")
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", " ", ""],
        )

        chunks = text_splitter.split_documents(documents)
        print(f"-> Created {len(chunks)} text chunks.")

        if not chunks:
            raise ValueError("No text chunks were created from the PDF.")

        # --------------------------------------------------
        # 3. Gemini API Key & Embeddings Setup
        # --------------------------------------------------
        print("Step 3: Generating embeddings...")
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError("Missing GOOGLE_API_KEY or GEMINI_API_KEY in .env")

        # FIX: Strip 'models/' prefix so LangChain routes the API call correctly
        embeddings = GoogleGenerativeAIEmbeddings(
            model="text-embedding-004",
            google_api_key=api_key,
        )

        print("-> Gemini embedding model initialized.")

        # --------------------------------------------------
        # 4. Store in PostgreSQL / PGVector
        # --------------------------------------------------
        print("Step 4: Saving embeddings to PostgreSQL...")

        PGVector.from_documents(
            embedding=embeddings,
            documents=chunks,
            collection_name=COLLECTION_NAME,
            connection_string=connection_string,
        )

        print("--- PDF Ingestion Complete! ---")
        return True

    except Exception as e:
        print(f" Error during PDF ingestion: {str(e)}")
        return False