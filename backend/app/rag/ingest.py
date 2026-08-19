import os

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import PGVector


# ============================================================
# Environment
# ============================================================

load_dotenv()

COLLECTION_NAME = "devpilot_pdf_knowledge"


# ============================================================
# Database Connection
# ============================================================

def get_connection_string() -> str:
    """
    Get PostgreSQL connection string from environment variables.
    """

    db_url = os.getenv("DATABASE_URL")

    if not db_url:
        raise ValueError("DATABASE_URL is not configured")

    return db_url


# ============================================================
# Gemini Embeddings
# ============================================================

def get_embeddings():
    """
    Create and return the Gemini embedding model.
    """

    api_key = (
        os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
    )

    if not api_key:
        raise ValueError(
            "Missing GOOGLE_API_KEY or GEMINI_API_KEY in .env"
        )

    return GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=api_key,
    )


# ============================================================
# PDF Ingestion
# ============================================================

def ingest_pdf(file_path: str) -> bool:
    """
    Load a PDF, split it into chunks, generate Gemini embeddings,
    and store the vectors in PostgreSQL using PGVector.
    """

    print(f"\n--- Starting PDF Ingestion: {file_path} ---")

    try:

        # ----------------------------------------------------
        # 1. Database connection
        # ----------------------------------------------------

        connection_string = get_connection_string()

        print(
            "Connecting to database using: "
            f"{connection_string.split('@')[-1]}"
        )

        # ----------------------------------------------------
        # 2. Load PDF
        # ----------------------------------------------------

        print("Step 1: Loading document...")

        loader = PyPDFLoader(file_path)
        documents = loader.load()

        print(f"-> Loaded {len(documents)} pages.")

        if not documents:
            raise ValueError(
                "PDF contains no readable pages."
            )

        # ----------------------------------------------------
        # 3. Split document into chunks
        # ----------------------------------------------------

        print("Step 2: Splitting text into chunks...")

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=[
                "\n\n",
                "\n",
                ".",
                " ",
                "",
            ],
        )

        chunks = text_splitter.split_documents(
            documents
        )

        print(
            f"-> Created {len(chunks)} text chunks."
        )

        if not chunks:
            raise ValueError(
                "No text chunks were created from the PDF."
            )

        # ----------------------------------------------------
        # 4. Gemini Embeddings
        # ----------------------------------------------------

        print("Step 3: Initializing Gemini embeddings...")

        embeddings = get_embeddings()

        print(
            "-> Gemini embedding model initialized."
        )

        # ----------------------------------------------------
        # 5. Test actual PDF chunks
        # ----------------------------------------------------

        print(
            "Step 4: Testing PDF chunk embeddings..."
        )

        for index, chunk in enumerate(chunks):

            text = chunk.page_content.strip()

            if not text:
                print(
                    f"-> Chunk {index + 1} is empty. Skipping."
                )
                continue

            print(
                f"Embedding chunk "
                f"{index + 1}/{len(chunks)}..."
            )

            vector = embeddings.embed_query(text)

            print(
                f"-> Chunk {index + 1} embedding size: "
                f"{len(vector)}"
            )

        print(
            "-> All PDF chunks embedded successfully."
        )

        # ----------------------------------------------------
        # 6. Store embeddings in PostgreSQL / PGVector
        # ----------------------------------------------------

        print(
            "Step 5: Saving embeddings to PostgreSQL..."
        )

        PGVector.from_documents(
            embedding=embeddings,
            documents=chunks,
            collection_name=COLLECTION_NAME,
            connection_string=connection_string,
        )

        # ----------------------------------------------------
        # Success
        # ----------------------------------------------------

        print(
            "--- PDF Ingestion Complete! ---"
        )

        return True

    except Exception as e:

        print(
            f"\n❌ Error during PDF ingestion: {e}"
        )

        return False