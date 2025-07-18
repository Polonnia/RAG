from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session
from models import get_db, User, ExamHistory
from rag.qa import get_completion
from auth import get_current_user

router = APIRouter()

@router.post("/ai-weakness-summary")
async def ai_weakness_summary(
    answers: list = Body(None),
    exam_id: int = Body(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 如果没有answers但有exam_id，则自动查找该学生该考试的所有题目和作答
    if (not answers or len(answers) == 0) and exam_id:
        # 查找学生考试记录
        from models import StudentExam, StudentAnswer, Question
        student_exam = db.query(StudentExam).filter(StudentExam.exam_id == exam_id, StudentExam.student_id == current_user.id).first()
        if not student_exam:
            return {"summary": "未找到该考试的作答记录，无法分析。"}
        # 查找所有学生答案
        stu_answers = db.query(StudentAnswer).filter(StudentAnswer.student_exam_id == student_exam.id).all()
        # 查找所有题目
        question_ids = [a.question_id for a in stu_answers]
        questions = db.query(Question).filter(Question.id.in_(question_ids)).all()
        qmap = {q.id: q for q in questions}
        answers = []
        for a in stu_answers:
            q = qmap.get(a.question_id)
            if not q:
                continue
            # 组装完整题目信息
            ans = {
                "question_id": a.question_id,
                "question": q.question_text,
                "options": None,
                "student_answer": a.answer,
                "correct_answer": q.correct_answer,
                "points_earned": a.points_earned,
                "knowledge_points": q.knowledge_points,
                "type": q.question_type,
                "is_correct": a.is_correct,
                "comment": a.comment,
                "points": q.points,
                "explanation": q.explanation
            }
            # 解析选项
            if q.options:
                try:
                    import json
                    ans["options"] = json.loads(q.options)
                except:
                    ans["options"] = None
            answers.append(ans)
    # 组装prompt
    question_details = ""
    for idx, a in enumerate(answers, 1):
        options_str = ""
        if a.get('options') and isinstance(a['options'], dict) and len(a['options']) > 0:
            options_str = '\n'.join([f"    {k}. {v}" for k, v in a['options'].items()])
            options_str = f"\n- 选项：\n{options_str}"
        question_details += f"### 第{idx}题\n- 题目：{a.get('question') or a.get('question_text') or ''}{options_str}\n- 学生答案：{a.get('answer') or a.get('student_answer') or ''}\n- 正确答案：{a.get('correct_answer','')}\n- 得分：{a.get('points_earned','')}\n- 知识点：{a.get('knowledge_points','')}\n\n"
    prompt = f"""
你是一名{current_user.role}学科的智能助教，请根据以下学生答题详情，结合题目涉及的学科知识点，分析学生的薄弱点和改进建议。

- 不要只给通用做题技巧，要结合每道题的知识点、题干、选项、正确答案，指出学生在哪些具体知识点或能力上存在不足。学生回答正确的题目不要分析。若没有错题，则输出“无”。
- 输出内容请用markdown格式，分为"薄弱点分析"和"针对性建议"两部分。

答题详情：
{question_details}

请用简洁的中文总结。
"""
    summary = None
    record = None
    if exam_id:
        record = db.query(ExamHistory).filter(ExamHistory.user_id == current_user.id, ExamHistory.id == exam_id).first()
        if record and getattr(record, 'comment', None):
            summary = record.comment
    if not summary:
        try:
            summary = get_completion(prompt)
        except Exception as e:
            summary = "AI分析失败: " + str(e)
        if exam_id and record:
            record.comment = summary
            db.commit()
    return {"summary": summary} 