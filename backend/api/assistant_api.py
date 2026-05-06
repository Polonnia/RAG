from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from models import get_db, User, StudentKeywordAccuracy
from auth import get_current_user
import sys, os
import uuid
import asyncio
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from rag.llm_client import completion_text
from rag.pageindex_search import MultiDocumentSearcher

router = APIRouter()
TREE_JSON_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'rag', 'db', 'trees')


async def _search_context_by_pageindex(query: str, top_k: int = 3) -> str:
    searcher = MultiDocumentSearcher(json_dir=TREE_JSON_DIR)
    searcher.load_documents()
    if not searcher.documents:
        return ""
    trace_id = f"assistant-{uuid.uuid4().hex[:8]}"
    result = await searcher.search(query=query, top_k=top_k, trace_id=trace_id, max_parallel_docs=3)
    return result.get("answer", "")

@router.post("/student/socratic-assistant")
async def socratic_assistant(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    data = await request.json()
    history = data.get("history", [])
    action = data.get("action", "next")
    answer = data.get("answer", "")
    current_kp = data.get("current_knowledge_point")

    # 获取学生所有知识点，按正确率升序
    all_kps = db.query(StudentKeywordAccuracy).filter(
        StudentKeywordAccuracy.student_id == current_user.id
    ).order_by(StudentKeywordAccuracy.accuracy.asc()).all()
    if not all_kps:
        weak_point = "操作系统调度"
    else:
        if not current_kp:
            weak_point = all_kps[0].keyword
        else:
            idx = next((i for i, kp in enumerate(all_kps) if kp.keyword == current_kp), -1)
            if idx == -1 or idx == len(all_kps) - 1:
                weak_point = all_kps[0].keyword
            else:
                weak_point = all_kps[idx + 1].keyword

    # 构建对话历史文本
    chat_history = ""
    for msg in history:
        if msg["role"] == "ai":
            chat_history += f"AI: {msg['content']}\n"
        else:
            chat_history += f"学生: {msg['content']}\n"

    # 使用 pageindex_search 检索知识库
    context = await _search_context_by_pageindex(weak_point, top_k=3)

    if action == "next":
        prompt = f"""
你是一名苏格拉底式学习助手，善于针对学生的薄弱知识点进行启发式提问。你正在与学生本人对话，请用学生能听懂的语言进行提问。
学生的薄弱知识点是：{weak_point}
相关知识内容如下：{context}

请基于知识内容，提出一个能引导学生思考的启发式问题，不要直接给出答案。
"""
        question = await asyncio.to_thread(completion_text, prompt)
        return {"question": question, "knowledge_point": weak_point}
    elif action == "answer":
        prompt = f"""
你是一名苏格拉底式学习助手，善于针对学生的薄弱知识点进行追问和引导。
学生的薄弱知识点是：{weak_point}
相关知识内容如下：{context}

对话历史：
{chat_history}
学生最新回答：{answer}

请基于知识内容和学生回答，继续追问或引导学生深入思考，不要直接给出答案。
"""
        reply = await asyncio.to_thread(completion_text, prompt)
        return {"reply": reply, "knowledge_point": weak_point}
    elif action == "explain":
        prompt = f"""
你是一名学习助手，善于用通俗易懂的语言讲解知识点。
学生的薄弱知识点是：{weak_point}
相关知识内容如下：{context}

请基于知识内容，详细讲解该知识点。
"""
        explanation = await asyncio.to_thread(completion_text, prompt)
        return {"explanation": explanation, "knowledge_point": weak_point}
    else:
        raise HTTPException(status_code=400, detail="未知操作") 