import os

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import PGVector

load_dotenv()

# PostgreSQL connection
CONNECTION_STRING = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5435/devpilot"
)

COLLECTION_NAME = "devpilot_pdf_knowledge"


def ingest_pdf(file_path: str):
    """
    Load a PDF, split it into chunks, generate Gemini embeddings,
    and store the embeddings in PostgreSQL using PGVector.
    """

    print(f"\n --- Starting PDF Ingestion: {file_path} ---")

    try:
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
        # 3. Gemini API key
        # --------------------------------------------------
        print("Step 3: Generating embeddings...")

        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError(
                "Missing GOOGLE_API_KEY or GEMINI_API_KEY in .env"
            )

        # --------------------------------------------------
        # 4. Gemini Embeddings
        # --------------------------------------------------
        embeddings = GoogleGenerativeAIEmbeddings(
            model="gemini-embedding-2",
            google_api_key=api_key,
            output_dimensionality=768,
        )

        print("-> Gemini embedding model initialized.")

        # --------------------------------------------------
        # 5. Store in PostgreSQL / PGVector
        # --------------------------------------------------
        print("Step 4: Saving embeddings to PostgreSQL...")

        PGVector.from_documents(
            embedding=embeddings,
            documents=chunks,
            collection_name=COLLECTION_NAME,
            connection_string=CONNECTION_STRING,
        )

        print(" --- PDF Ingestion Complete! ---")

        return True

    except Exception as e:
        print(f"Error during PDF ingestion: {str(e)}")
        return False