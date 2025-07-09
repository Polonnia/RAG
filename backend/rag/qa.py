import os
from langchain.embeddings.huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from openai import OpenAI

DB_DIR = os.path.join(os.path.dirname(__file__), 'db')
API_KEY = "sk-9fabf0d9e8e84d0994756d5846207c04"

vector_db = Chroma(
    persist_directory=DB_DIR,
    embedding_function=HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
)

client = OpenAI(api_key=API_KEY, base_url="https://api.deepseek.com")

def get_completion(prompt, model="deepseek-chat"):
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": prompt},
        ],
        stream=False
    )
    return response.choices[0].message.content

def qa_query(question: str) -> dict:
    # 检索相关文档
    docs = vector_db.similarity_search(question, k=3)
    print("检索到的片段：")
    for i, doc in enumerate(docs):
        print(f"片段{i+1}: {doc.page_content[:100]}... 元数据: {doc.metadata}")
    context = "\n".join([doc.page_content for doc in docs])
    prompt = f"已知课程资料如下：\n{context}\n\n请根据上述资料回答问题：{question}"
    answer = get_completion(prompt)
    sources = [
        {
            "content": doc.page_content,
            "metadata": doc.metadata
        }
        for doc in docs
    ]
    return {"answer": answer, "sources": sources}