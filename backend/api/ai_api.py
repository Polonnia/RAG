from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session
from models import get_db, User, ExamHistory
from rag.qa import get_completion
from auth import get_current_user

router = APIRouter()

@router.post("/ai-weakness-summary")
async def ai_weakness_summary(answers: list = Body(...), exam_id: int = Body(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    question_details = ""
    for idx, a in enumerate(answers, 1):
        options_str = ""
        if a.get('options') and isinstance(a['options'], dict) and len(a['options']) > 0:
            options_str = '\n'.join([f"    {k}. {v}" for k, v in a['options'].items()])
            options_str = f"\n- 选项：\n{options_str}"
        question_details += f"### 第{idx}题\n- 题目：{a.get('question') or a.get('question_text') or ''}{options_str}\n- 学生答案：{a.get('answer') or a.get('student_answer') or ''}\n- 正确答案：{a.get('correct_answer','')}\n- 得分：{a.get('points_earned','')}\n- 知识点：{a.get('knowledge_point','')}\n\n"
    prompt = f"""
你是一名{current_user.role}学科的智能助教，请根据以下学生答题详情，结合题目涉及的学科知识点，分析学生的薄弱点和改进建议。

- 不要只给通用做题技巧，要结合每道题的知识点、题干、选项、正确答案，指出学生在哪些具体知识点或能力上存在不足。
- 输出内容请用markdown格式，分为"薄弱点分析"和"针对性建议"两部分。

答题详情：
{question_details}

请用简洁的中文总结。
"""
    summary = None
    if exam_id:
        record = db.query(ExamHistory).filter(ExamHistory.user_id == current_user.id, ExamHistory.id == exam_id).first()
        if record and getattr(record, 'comment', None):
            summary = record.comment
    if not summary:
        try:
            summary = get_completion(prompt)
        except Exception as e:
            summary = "AI分析失败: " + str(e)
        if exam_id:
            if record:
                record.comment = summary
                db.commit()
    return {"summary": summary} 