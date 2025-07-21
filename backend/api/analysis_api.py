from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from models import get_db, User, StudentExam, Exam, StudentAnswer, ExamHistory, StudentWrongQuestion, Question, StudentPracticeRecord, StudentKeywordAccuracy
from rag.exam_generator import exam_generator
from auth import get_current_user
import json
from datetime import datetime
from sqlalchemy import func

router = APIRouter()

@router.get("/student/analysis")
async def get_student_analysis(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取学生历次考试正确率和薄弱知识点
    正确率曲线只统计每次考试所有题目的总正确率，不分知识点。
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有学生可以查看学情分析")
    # 1. 正确率曲线
    exams = db.query(StudentExam).filter(StudentExam.student_id == current_user.id).order_by(StudentExam.start_time).all()
    accuracy_curve = []
    for se in exams:
        # 只统计已判分（is_correct为True或False）的题目
        valid_answers = [ans for ans in se.answers if ans.is_correct is not None]
        total = len(valid_answers)
        correct = sum(1 for ans in valid_answers if ans.is_correct)
        accuracy = round(correct / total * 100, 2) if total > 0 else None
        accuracy_curve.append({
            "exam_id": se.exam_id,
            "exam_title": se.exam.title if se.exam else "",
            "date": se.start_time.strftime('%Y-%m-%d'),
            "accuracy": accuracy
        })
    # 2. 薄弱知识点云（统计weak_keywords字段）
    histories = db.query(ExamHistory).filter(ExamHistory.user_id == current_user.id).all()
    keyword_count = {}
    for h in histories:
        if getattr(h, 'weak_keywords', None):
            for kw in h.weak_keywords.split(','):
                kw = kw.strip()
                if kw:
                    keyword_count[kw] = keyword_count.get(kw, 0) + 1
    weak_points = [{"keyword": k, "count": v} for k, v in keyword_count.items()]
    weak_points.sort(key=lambda x: -x["count"])
    # 同时返回知识点正确率数据
    keyword_accuracy = []
    accuracy_records = db.query(StudentKeywordAccuracy).filter(
        StudentKeywordAccuracy.student_id == current_user.id
    ).order_by(StudentKeywordAccuracy.accuracy.asc()).all()
    
    for record in accuracy_records:
        keyword_accuracy.append({
            "keyword": record.keyword,
            "total_count": record.total_count,
            "correct_count": record.correct_count,
            "accuracy": round(record.accuracy * 100, 2),
            "last_updated": record.last_updated.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    print(f"学情分析数据: accuracy_curve={len(accuracy_curve)}, keyword_accuracy={len(keyword_accuracy)}")  # 调试日志
    return {"accuracy_curve": accuracy_curve, "weak_points": weak_points, "keyword_accuracy": keyword_accuracy}

@router.post("/student/generate-practice")
async def generate_practice(
    keyword: str = Form(...),  # 逗号分隔的知识点
    count: int = Form(5),
    difficulty: str = Form("中等"),
    current_user: User = Depends(get_current_user)
):
    """根据知识点生成巩固习题"""
    # 直接用 exam_generator 生成概念题
    outline = "巩固以下知识点：" + keyword
    # 这里只生成单选题和填空题
    questions = exam_generator.generate_concept_questions(outline, [], count=count//2+1, difficulty=difficulty)
    fill_questions = exam_generator.generate_fill_blank_questions(outline, [], count=max(0, count//2-1), difficulty=difficulty)
    return {"questions": questions + fill_questions}

@router.post("/student/submit-practice")
async def submit_practice(
    answers_data: str = Form(...),  # JSON: [{question, answer, correct_answer, explanation, knowledge_points, options}]
    keyword: str = Form(...),  # 新增：当前知识点
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """判分并返回解析，并更新该知识点正确率，并保存练习记录"""
    try:
        answers = json.loads(answers_data)
        total = len(answers)
        correct = 0
        results = []
        for a in answers:
            is_correct = (str(a.get('answer', '')).strip() == str(a.get('correct_answer', '')).strip())
            if is_correct:
                correct += 1
            results.append({
                "question": a.get('question', ''),
                "answer": a.get('answer', ''),
                "correct_answer": a.get('correct_answer', ''),
                "is_correct": is_correct,
                "explanation": a.get('explanation', ''),
                "knowledge_points": keyword,
                "options": a.get('options', {})
            })
            # 新增：直接用keyword更新正确率
            def update_student_keyword_accuracy(db: Session, student_id: int, keyword: str, is_correct: bool):
                """更新学生-关键词的正确率统计"""
                try:
                    if not keyword or keyword.strip() == "":
                        return
                    keyword = keyword.strip()
                    accuracy_record = db.query(StudentKeywordAccuracy).filter(
                        StudentKeywordAccuracy.student_id == student_id,
                        StudentKeywordAccuracy.keyword == keyword
                    ).first()
                    if not accuracy_record:
                        accuracy_record = StudentKeywordAccuracy(
                            student_id=student_id,
                            keyword=keyword,
                            total_count=0,
                            correct_count=0,
                            accuracy=0.0,
                            last_updated=datetime.now()
                        )
                        db.add(accuracy_record)
                    accuracy_record.total_count += 1
                    if is_correct:
                        accuracy_record.correct_count += 1
                    accuracy_record.accuracy = accuracy_record.correct_count / accuracy_record.total_count
                    accuracy_record.last_updated = datetime.now()
                except Exception as e:
                    print(f"更新学生关键词正确率失败: {str(e)}")
            update_student_keyword_accuracy(db, current_user.id, keyword, is_correct)
            # 新增：保存练习记录，options字段要有内容
            db.add(StudentPracticeRecord(
                student_id=current_user.id,
                keyword=keyword,
                question=a.get('question', ''),
                options=json.dumps(a.get('options', {})) if a.get('options') else '{}',
                correct_answer=a.get('correct_answer', ''),
                student_answer=a.get('answer', ''),
                is_correct=is_correct,
                explanation=a.get('explanation', ''),
                time=datetime.now()
            ))
        db.commit()
        score = round(correct / total * 100, 2) if total > 0 else 0
        return {"score": score, "results": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"判分失败: {str(e)}")

# 新增：查询巩固练习历史
@router.get("/student/practice-records")
def get_practice_records(keyword: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(StudentPracticeRecord).filter_by(student_id=current_user.id, keyword=keyword).order_by(StudentPracticeRecord.time.desc()).all()
    return [{
        "question": r.question,
        "options": json.loads(r.options) if r.options else {},
        "correct_answer": r.correct_answer,
        "student_answer": r.student_answer,
        "is_correct": r.is_correct,
        "explanation": r.explanation,
        "time": r.time.strftime('%Y-%m-%d %H:%M:%S')
    } for r in records]

@router.get("/student/wrongbook/keywords")
async def get_wrong_keywords(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """查询学生错题本所有关键词及数量"""
    q = db.query(StudentWrongQuestion.keyword, func.count(StudentWrongQuestion.id)).filter(StudentWrongQuestion.student_id == current_user.id).group_by(StudentWrongQuestion.keyword).all()
    return [{"keyword": k, "count": c} for k, c in q]

@router.get("/student/wrongbook/questions")
async def get_wrong_questions(keyword: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """查询某关键词下所有错题"""
    wrongs = db.query(StudentWrongQuestion).filter(StudentWrongQuestion.student_id == current_user.id, StudentWrongQuestion.keyword == keyword).order_by(StudentWrongQuestion.time.desc()).all()
    result = []
    for w in wrongs:
        qdata = None
        try:
            import json
            qdata = json.loads(w.question_data)
        except:
            qdata = {}
        result.append({
            "id": w.id,
            "question_id": w.question_id,
            "exam_id": w.exam_id,
            "keyword": w.keyword,
            "question": qdata.get("question", ""),
            "options": qdata.get("options", {}),
            "type": qdata.get("type", ""),
            "knowledge_points": qdata.get("knowledge_points", ""),
            "explanation": w.explanation,
            "answer": w.answer,
            "correct_answer": w.correct_answer,
            "time": w.time.strftime('%Y-%m-%d %H:%M:%S')
        })
    return result

@router.post("/student/wrongbook/submit")
async def submit_wrongbook_answer(wrong_id: int = Form(...), answer: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """学生重做错题，判分并返回解析"""
    wrong = db.query(StudentWrongQuestion).filter(StudentWrongQuestion.id == wrong_id, StudentWrongQuestion.student_id == current_user.id).first()
    if not wrong:
        raise HTTPException(status_code=404, detail="未找到该错题")
    import json
    qdata = json.loads(wrong.question_data)
    correct = False
    if qdata.get("type") == "choice":
        correct = answer == wrong.correct_answer
    elif qdata.get("type") == "fill_blank":
        # 填空题支持多个空，答案以空格分隔
        student_answers = [ans.strip() for ans in answer.split() if ans.strip()]
        correct_answers = [ans.strip() for ans in (wrong.correct_answer or '').split() if ans.strip()]
        
        # 逐个比较每个空的答案
        correct_count = 0
        for i in range(len(student_answers)):
            if i < len(correct_answers) and student_answers[i].lower() == correct_answers[i].lower():
                correct_count += 1
        
        # 如果所有空都正确，则全对
        correct = correct_count == len(correct_answers) and len(student_answers) == len(correct_answers)
    # 其他题型可扩展
    return {
        "is_correct": correct,
        "correct_answer": wrong.correct_answer,
        "explanation": wrong.explanation,
        "your_answer": answer,
        "question": qdata.get("question", ""),
        "options": qdata.get("options", {}),
        "type": qdata.get("type", ""),
        "knowledge_points": qdata.get("knowledge_points", "")
    } 

@router.get("/student/exam-keyword-accuracy/{exam_id}")
async def get_exam_keyword_accuracy(exam_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取某场考试下该学生每个知识点的正确率"""
    # 查找该学生该场考试的所有答题
    student_exam = db.query(StudentExam).filter(StudentExam.exam_id == exam_id, StudentExam.student_id == current_user.id).first()
    if not student_exam:
        return []
    answers = db.query(StudentAnswer).filter(StudentAnswer.student_exam_id == student_exam.id).all()
    # 统计每个知识点的答题情况
    keyword_stats = {}
    for ans in answers:
        # 只统计已判分的题目
        if ans.is_correct is None:
            continue
        q = db.query(Question).filter(Question.id == ans.question_id).first()
        if not q or not q.knowledge_points:
            continue
        try:
            keywords = json.loads(q.knowledge_points) if isinstance(q.knowledge_points, str) else q.knowledge_points
        except:
            keywords = [q.knowledge_points]
        for kw in keywords:
            if not kw:
                continue
            if kw not in keyword_stats:
                keyword_stats[kw] = {"total": 0, "correct": 0}
            keyword_stats[kw]["total"] += 1
            if ans.is_correct:
                keyword_stats[kw]["correct"] += 1
    # 组装返回
    result = []
    for kw, stat in keyword_stats.items():
        acc = round(stat["correct"] / stat["total"] * 100, 2) if stat["total"] > 0 else None
        result.append({"keyword": kw, "total": stat["total"], "correct": stat["correct"], "accuracy": acc})
    return result 