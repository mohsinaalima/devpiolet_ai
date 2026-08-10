import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")

print("API key loaded:", bool(api_key))
print("API key length:", len(api_key) if api_key else 0)

from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash"
)

response = llm.invoke("Say hello in one sentence.")

print(response.content)