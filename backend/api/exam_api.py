from fastapi import APIRouter, Form, HTTPException, Depends, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from models import get_db, User, Exam, Question, StudentExam, StudentAnswer, ExamHistory
from rag.exam_generator import exam_generator
from datetime import datetime
import json
from auth import get_current_user

router = APIRouter()

@router.post("/generate-exam")
async def generate_exam(course_outline: str = Form(...), question_config: str = Form(None), current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以生成考核内容")
    try:
        config = json.loads(question_config) if question_config else None
        exam_content = exam_generator.generate_exam_content(course_outline, question_config=config)
        return {"exam_content": exam_content}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"考核内容生成失败: {str(e)}"})

@router.post("/exam-history")
async def save_exam_history(outline: str = Form(...), exam_content: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = ExamHistory(user_id=current_user.id, outline=outline, subject_type="", exam_content=exam_content)
    db.add(record)
    db.commit()
    return {"msg": "ok"}

@router.get("/exam-history")
async def get_exam_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(ExamHistory).filter(ExamHistory.user_id == current_user.id).order_by(ExamHistory.time.desc()).all()
    return [{
        "id": r.id,
        "outline": r.outline,
        "examContent": json.loads(r.exam_content),
        "time": r.time.strftime('%Y-%m-%d %H:%M:%S')
    } for r in records]

@router.post("/create-exam")
async def create_exam(title: str = Form(...), description: str = Form(...), duration: int = Form(...), questions_data: str = Form(...), current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以创建考试")
    db = next(get_db())
    try:
        questions = json.loads(questions_data)
        exam = Exam(title=title, description=description, duration=duration, teacher_id=current_user.id, created_at=datetime.now())
        db.add(exam)
        db.commit()
        db.refresh(exam)
        for q_data in questions:
            question = Question(
                exam_id=exam.id,
                question_type=q_data["type"],
                question_text=q_data["question"],
                options=json.dumps(q_data.get("options", {})),
                correct_answer=q_data.get("correct_answer", ""),
                points=q_data.get("points", 1),
                explanation=q_data.get("explanation", ""),
                knowledge_point=q_data.get("knowledge_point", "")
            )
            db.add(question)
        db.commit()
        return {"msg": "考试创建成功", "exam_id": exam.id}
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"error": f"创建考试失败: {str(e)}"})

@router.get("/teacher/exams")
async def get_teacher_exams(current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以查看考试列表")
    db = next(get_db())
    exams = db.query(Exam).filter(Exam.teacher_id == current_user.id).all()
    result = []
    for exam in exams:
        student_count = db.query(StudentExam).filter(StudentExam.exam_id == exam.id).count()
        result.append({
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration": exam.duration,
            "created_at": exam.created_at.isoformat(),
            "student_count": student_count
        })
    return {"exams": result}

@router.get("/teacher/exam/{exam_id}")
async def get_teacher_exam_detail(exam_id: int, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以查看考试详情")
    db = next(get_db())
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")
    questions = db.query(Question).filter(Question.exam_id == exam_id).all()
    return {
        "exam": {
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration": exam.duration,
            "created_at": exam.created_at.isoformat()
        },
        "questions": [
            {
                "id": q.id,
                "type": q.question_type,
                "question": q.question_text,
                "options": json.loads(q.options) if q.options else {},
                "correct_answer": q.correct_answer,
                "points": q.points,
                "explanation": q.explanation,
                "knowledge_point": q.knowledge_point
            }
            for q in questions
        ]
    }

@router.get("/teacher/exam/{exam_id}/answers")
async def get_exam_answers(exam_id: int, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以查看学生作答情况")
    db = next(get_db())
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")
    student_exams = db.query(StudentExam).filter(StudentExam.exam_id == exam_id).all()
    result = []
    for se in student_exams:
        student = db.query(User).filter(User.id == se.student_id).first()
        answers = db.query(StudentAnswer).filter(StudentAnswer.student_exam_id == se.id).all()
        answer_list = []
        for ans in answers:
            q = db.query(Question).filter(Question.id == ans.question_id).first()
            answer_list.append({
                "question_id": ans.question_id,
                "question": q.question_text if q else "",
                "student_answer": ans.answer,
                "is_correct": ans.is_correct,
                "points_earned": ans.points_earned,
                "type": q.question_type if q else "",
                "comment": ans.comment if hasattr(ans, 'comment') else "",
                "points": q.points if q else 0
            })
        result.append({
            "student_id": se.student_id,
            "student_name": student.username if student else "",
            "student_exam_id": se.id,
            "score": se.score,
            "answers": answer_list
        })
    return {"students": result}

@router.get("/student/exams")
async def get_student_exams(current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有学生可以查看考试列表")
    db = next(get_db())
    exams = db.query(Exam).all()
    result = []
    for exam in exams:
        student_exam = db.query(StudentExam).filter(StudentExam.exam_id == exam.id, StudentExam.student_id == current_user.id).first()
        result.append({
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration": exam.duration,
            "created_at": exam.created_at.isoformat(),
            "completed": student_exam is not None,
            "score": student_exam.score if student_exam else None
        })
    return {"exams": result}

@router.get("/student/exam/{exam_id}")
async def get_student_exam(exam_id: int, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有学生可以参加考试")
    db = next(get_db())
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")
    existing_exam = db.query(StudentExam).filter(StudentExam.exam_id == exam_id, StudentExam.student_id == current_user.id).first()
    if existing_exam:
        raise HTTPException(status_code=400, detail="您已经参加过这个考试")
    questions = db.query(Question).filter(Question.exam_id == exam_id).all()
    return {
        "exam": {
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration": exam.duration
        },
        "questions": [
            {
                "id": q.id,
                "type": q.question_type,
                "question": q.question_text,
                "options": json.loads(q.options) if q.options else {},
                "points": q.points
            }
            for q in questions
        ]
    }

@router.post("/student/submit-exam")
async def submit_exam(exam_id: int = Form(...), answers_data: str = Form(...), current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有学生可以提交考试")
    db = next(get_db())
    try:
        existing_exam = db.query(StudentExam).filter(StudentExam.exam_id == exam_id, StudentExam.student_id == current_user.id).first()
        if existing_exam:
            raise HTTPException(status_code=400, detail="您已经参加过这个考试")
        answers = json.loads(answers_data)
        student_exam = StudentExam(exam_id=exam_id, student_id=current_user.id, start_time=datetime.now(), end_time=datetime.now(), score=0)
        db.add(student_exam)
        db.commit()
        db.refresh(student_exam)
        total_score = 0
        questions = db.query(Question).filter(Question.exam_id == exam_id).all()
        for question in questions:
            answer_text = answers.get(str(question.id), "")
            student_answer = StudentAnswer(
                student_exam_id=student_exam.id,
                question_id=question.id,
                answer=answer_text,
                is_correct=False,
                points_earned=0,
                comment=""
            )
            db.add(student_answer)
            if question.question_type == "choice":
                is_correct = answer_text == question.correct_answer
                points_earned = question.points if is_correct else 0
                student_answer.is_correct = is_correct
                student_answer.points_earned = points_earned
                total_score += points_earned
            elif question.question_type == "fill_blank":
                is_correct = answer_text.lower().strip() == question.correct_answer.lower().strip()
                points_earned = question.points if is_correct else 0
                student_answer.is_correct = is_correct
                student_answer.points_earned = points_earned
                total_score += points_earned
            else:
                student_answer.is_correct = None
                student_answer.points_earned = 0
                student_answer.comment = ""
        student_exam.score = total_score
        db.commit()
        return {"msg": "考试提交成功", "score": total_score}
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"error": f"提交考试失败: {str(e)}"})

@router.get("/student/exam-result/{exam_id}")
async def get_exam_result(exam_id: int, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有学生可以查看考试结果")
    db = next(get_db())
    student_exam = db.query(StudentExam).filter(StudentExam.exam_id == exam_id, StudentExam.student_id == current_user.id).first()
    if not student_exam:
        raise HTTPException(status_code=404, detail="未找到考试记录")
    answers = db.query(StudentAnswer).filter(StudentAnswer.student_exam_id == student_exam.id).all()
    question_ids = [answer.question_id for answer in answers]
    questions = db.query(Question).filter(Question.id.in_(question_ids)).all()
    question_map = {q.id: q for q in questions}
    return {
        "exam_id": exam_id,
        "score": student_exam.score,
        "start_time": student_exam.start_time.isoformat(),
        "end_time": student_exam.end_time.isoformat(),
        "answers": [
            {
                "question_id": answer.question_id,
                "answer": answer.answer,
                "is_correct": answer.is_correct,
                "points_earned": answer.points_earned,
                "correct_answer": question_map[answer.question_id].correct_answer if answer.question_id in question_map else None,
                "explanation": question_map[answer.question_id].explanation if answer.question_id in question_map else None,
                "type": question_map[answer.question_id].question_type if answer.question_id in question_map else None,
                "comment": answer.comment
            }
            for answer in answers
        ]
    }

@router.post("/teacher/grade-answer")
async def grade_answer(student_exam_id: int = Form(...), question_id: int = Form(...), points_earned: float = Form(...), comment: str = Form(""), current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以批改试卷")
    db = next(get_db())
    try:
        answer = db.query(StudentAnswer).filter(StudentAnswer.student_exam_id == student_exam_id, StudentAnswer.question_id == question_id).first()
        if not answer:
            raise HTTPException(status_code=404, detail="未找到该学生答案")
        q = db.query(Question).filter(Question.id == question_id).first()
        if q.question_type not in ["short_answer", "programming"]:
            raise HTTPException(status_code=400, detail="只能批改简答题和编程题")
        answer.points_earned = points_earned
        answer.comment = comment
        answer.is_correct = points_earned > 0
        db.commit()
        student_exam = db.query(StudentExam).filter(StudentExam.id == student_exam_id).first()
        all_answers = db.query(StudentAnswer).filter(StudentAnswer.student_exam_id == student_exam_id).all()
        total_score = sum(a.points_earned for a in all_answers)
        student_exam.score = total_score
        db.commit()
        return {"msg": "批改成功", "total_score": total_score}
    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"error": f"批改失败: {str(e)}"})

@router.delete("/exam/{exam_id}")
async def delete_exam(exam_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(ExamHistory).filter(ExamHistory.id == exam_id, ExamHistory.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="考试记录不存在")
    db.delete(record)
    db.commit()
    return {"msg": "删除成功"} 