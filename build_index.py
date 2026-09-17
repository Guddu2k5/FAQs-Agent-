import json
import chromadb
from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Persistent ChromaDB storage — creates a local folder to store vectors
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="college_faqs")

# Load sample knowledge base
with open("knowledge_base/real_faqs.json", "r", encoding="utf-8") as f:
    faqs = json.load(f)

def get_embedding(text):
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text
    )
    return result.embeddings[0].values

print(f"Indexing {len(faqs)} FAQ entries...")

for faq in faqs:
    # We embed the question (what a student would actually type)
    embedding = get_embedding(faq["question"])
    collection.upsert(
        ids=[faq["id"]],
        embeddings=[embedding],
        documents=[faq["answer"]],
        metadatas=[{"question": faq["question"]}]
    )
    print(f"  Indexed: {faq['question']}")

print("Done! Vector database saved to ./chroma_db")