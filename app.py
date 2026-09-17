from flask import Flask, render_template, request, jsonify, session
from google import genai
from google.genai import types
import chromadb
import os
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

load_dotenv()

GALLERY_IMAGES = [
    {"file": "fest1.jpg", "caption": ""},
    {"file": "fest2.jpg", "caption": ""},
    {"file": "fest3.jpg", "caption": ""},
    {"file": "fest4.jpg", "caption": ""},
    {"file": "campus1.jpg", "caption": ""},
    {"file": "campus2.jpg", "caption": ""},
    {"file": "campus3.jpg", "caption": ""},
    {"file": "campus4.jpg", "caption": ""},
    {"file": "campus5.jpg", "caption": ""},
    {"file": "campus6.jpg", "caption": ""},
    {"file": "campus7.jpg", "caption": ""},
    {"file": "campus8.jpg", "caption": ""},
    {"file": "campus9.jpg", "caption": ""},
    {"file": "campus10.jpg", "caption": ""},
]
GALLERY_HOMEPAGE_LIMIT = 10

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Connect to the persistent ChromaDB we built during indexing
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="college_faqs")

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-this")

limiter = Limiter(get_remote_address, app=app, default_limits=["30 per hour"])

MAX_HISTORY_TURNS = 4       # how many past exchanges to remember
MAX_MESSAGE_LENGTH = 500    # max characters allowed per question

CHAT_MODEL = "gemini-flash-lite-latest"  # generous free-tier daily quota

response_cache = {}  # simple in-memory cache for repeated exact questions


def get_embedding(text):
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text
    )
    return result.embeddings[0].values


def rewrite_with_context(user_question, history):
    """Clean up the question (fix typos/grammar/abbreviations) and, if there's history, resolve follow-up context."""
    if history:
        history_text = "\n".join(
            f"Student: {h['question']}\nAssistant: {h['answer']}" for h in history
        )
        rewrite_prompt = f"""Given this conversation history, rewrite the student's latest question as a fully standalone question, fixing any typos or grammar issues. If it's already clear and standalone, just fix typos/grammar. Return ONLY the rewritten question, nothing else.

History:
{history_text}

Latest question: {user_question}

Standalone question:"""
    else:
        rewrite_prompt = f"""Rewrite the following student question by correcting any typos, spelling mistakes, abbreviations, or grammar issues, without changing its meaning. Expand common abbreviations (e.g. "u" -> "you", "da"/"de" -> "the", "wat"/"wot" -> "what", "prcess" -> "process"). Return ONLY the corrected question, nothing else.

Question: {user_question}

Corrected question:"""

    response = client.models.generate_content(
        model=CHAT_MODEL,
        contents=rewrite_prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=60,
            temperature=0.2
        )
    )
    return response.text.strip()


def retrieve_context(user_question, top_k=3, distance_threshold=0.85):
    """Find relevant FAQ answers, if any exist close enough to be useful."""
    query_embedding = get_embedding(user_question)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )
    documents = results["documents"][0]
    distances = results["distances"][0]  # lower = more similar
    return [doc for doc, dist in zip(documents, distances) if dist < distance_threshold]


def build_prompt(standalone_question, context_chunks):
    if not context_chunks:
        return None

    context_text = "\n\n".join(context_chunks)
    prompt = f"""You are a helpful college FAQ assistant. Answer the student's question using ONLY the context below.

If the context doesn't have enough information to fully answer, briefly mention that and suggest checking the official website or contacting the relevant department — but don't repeat back the exact wording of the student's question. Do not make up any facts not present in the context. Keep the tone natural and conversational, like a helpful staff member, not overly formal or repetitive.

Context:
{context_text}

Student question: {standalone_question}

Answer:"""
    return prompt


@app.route("/")
def home():
    session.clear()
    return render_template("index.html")


@app.route("/gallery")
def gallery_page():
    return render_template("gallery.html", gallery_images=GALLERY_IMAGES)


@app.route("/new-chat", methods=["POST"])
def new_chat():
    session.clear()
    return jsonify({"status": "cleared"})


@app.route("/chat", methods=["POST"])
@limiter.limit("10 per minute")
def chat():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"reply": "Invalid request."}), 400

    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"reply": "Please type a question."}), 400

    if len(user_message) > MAX_MESSAGE_LENGTH:
        return jsonify({"reply": f"Please keep your question under {MAX_MESSAGE_LENGTH} characters."}), 400

    history = session.get("history", [])

    try:
        standalone_question = rewrite_with_context(user_message, history)
        context_chunks = retrieve_context(standalone_question)

        # Fallback: if the rewritten question found nothing, retry with the raw original message
        if not context_chunks and standalone_question.strip().lower() != user_message.strip().lower():
            context_chunks = retrieve_context(user_message)

        prompt = build_prompt(standalone_question, context_chunks)

        if prompt is None:
            reply = ("I don't have information about that in my knowledge base. "
                      "Please contact the relevant college department, or check the "
                      "official college website for details.")
        else:
            cache_key = standalone_question.strip().lower()
            if cache_key in response_cache:
                reply = response_cache[cache_key]
            else:
                response = client.models.generate_content(
                    model=CHAT_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        max_output_tokens=350,
                        temperature=0.4
                    )
                )
                reply = response.text
                response_cache[cache_key] = reply
    except Exception as e:
        print("Chat error:", e)
        error_text = str(e)
        if "RESOURCE_EXHAUSTED" in error_text or "429" in error_text:
            reply = "I'm getting a lot of questions right now — please wait a few seconds and try again."
        else:
            reply = "Sorry, something went wrong while generating a response."

    history.append({"question": user_message, "answer": reply})
    session["history"] = history[-MAX_HISTORY_TURNS:]

    return jsonify({"reply": reply})


if __name__ == "__main__":
    app.run()