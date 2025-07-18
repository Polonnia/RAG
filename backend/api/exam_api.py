from fastapi import APIRouter, Form, HTTPException, Depends, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from models import get_db, User, Exam, Question, StudentExam, StudentAnswer, ExamHistory, StudentKeywordAccuracy
from rag.exam_generator import exam_generator
from datetime import datetime
import json
from auth import get_current_user
import threading

router = APIRouter()

def update_student_keyword_accuracy(db: Session, student_id: int, keyword: str, is_correct: bool):
    """更新学生-关键词的正确率统计"""
    try:
        if not keyword or keyword.strip() == "":
            return
        
        keyword = keyword.strip()
        
        # 查找或创建学生-关键词记录
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
        
        # 更新统计
        accuracy_record.total_count += 1
        if is_correct:
            accuracy_record.correct_count += 1
        
        # 计算正确率
        accuracy_record.accuracy = accuracy_record.correct_count / accuracy_record.total_count
        accuracy_record.last_updated = datetime.now()
        
        db.commit()
        
    except Exception as e:
        print(f"更新学生关键词正确率失败: {str(e)}")
        db.rollback()

@router.post("/generate-exam")
async def generate_exam(
    course_outline: str = Form(...),
    question_config: str = Form(...),
    difficulty: str = Form("中等"),  # 添加难度参数，默认中等
    current_user: User = Depends(get_current_user)
):
    """生成考核内容"""
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以生成考核内容")
    try:
        # 解析题型配置
        config = json.loads(question_config)
        
        # 生成考核内容
        exam_content = exam_generator.generate_exam_content(
            outline=course_outline,
            question_config=config,
            difficulty=difficulty  # 传递难度参数
        )
        
        return {"exam_content": exam_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成考核内容失败: {str(e)}")

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
        "examContent": json.loads(r.exam_content) if r.exam_content else None,
        "time": r.time.strftime('%Y-%m-%d %H:%M:%S')
    } for r in records]

@router.post("/create-exam")
async def create_exam(title: str = Form(...), description: str = Form(""), duration: int = Form(...), questions_data: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        print("收到创建考试请求:")
        print("title:", title)
        print("description:", description)
        print("duration:", duration)
        print("questions_data 原始:", questions_data)
        questions = json.loads(questions_data)
        print("questions 解析后:", questions)
        for idx, q_data in enumerate(questions):
            print(f"第{idx+1}题数据:", q_data)
        exam = Exam(
            title=title,
            description=description,
            duration=duration,
            teacher_id=current_user.id
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)
        for q_data in questions:
            # 统一知识点为数组
            knowledge_points = q_data.get("knowledge_points", [])
            if isinstance(knowledge_points, str):
                try:
                    import json as _json
                    knowledge_points = _json.loads(knowledge_points)
                except:
                    knowledge_points = [knowledge_points]
            question = Question(
                exam_id=exam.id,
                question_type=q_data.get("type"),
                question_text=q_data.get("question"),
                options=json.dumps(q_data.get("options", {})),
                correct_answer=json.dumps(q_data.get("correct_answer", "")) if isinstance(q_data.get("correct_answer"), (list, dict)) else q_data.get("correct_answer", ""),
                points=q_data.get("points", 1),
                explanation=q_data.get("explanation", ""),
                knowledge_points=json.dumps(knowledge_points, ensure_ascii=False)  # 统一存为JSON字符串
            )
            db.add(question)
        db.commit()
        return {"msg": "ok", "exam_id": exam.id}
    except Exception as e:
        print("创建考试异常:", str(e))
        import traceback
        traceback.print_exc()
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

    # 统计每道题的正确率和选项正确率
    question_stats = {}
    for q in questions:
        # 查询所有该题的学生答案
        answers = db.query(StudentAnswer).filter(StudentAnswer.question_id == q.id).all()
        total_answers = len(answers)
        correct_answers = sum(1 for a in answers if a.is_correct is True)
        accuracy = correct_answers / total_answers if total_answers > 0 else None
        option_stats = None
        # 只对选择题和多选题统计选项正确率
        if q.question_type in ["choice", "multi"]:
            try:
                options = json.loads(q.options) if q.options else {}
            except Exception:
                options = {}
            option_stats = {}
            if isinstance(options, dict):
                option_keys = list(options.keys())
            elif isinstance(options, list):
                option_keys = options
            else:
                option_keys = []
            for opt in option_keys:
                count = 0
                correct_count = 0
                students = []
                for a in answers:
                    try:
                        ans_val = json.loads(a.answer) if a.answer and (a.answer.startswith('[') or a.answer.startswith('{')) else a.answer
                    except Exception:
                        ans_val = a.answer
                    # 获取学生姓名
                    student_name = None
                    if a.student_exam_id:
                        se = db.query(StudentExam).filter(StudentExam.id == a.student_exam_id).first()
                        if se:
                            user = db.query(User).filter(User.id == se.student_id).first()
                            if user:
                                student_name = user.username
                    # 单选题
                    if q.question_type == "choice":
                        if ans_val == opt or (isinstance(ans_val, list) and opt in ans_val):
                            count += 1
                            if a.is_correct is True:
                                correct_count += 1
                            if student_name:
                                students.append(student_name)
                    # 多选题
                    elif q.question_type == "multi":
                        if isinstance(ans_val, list) and opt in ans_val:
                            count += 1
                            if a.is_correct is True:
                                correct_count += 1
                            if student_name:
                                students.append(student_name)
                        elif isinstance(ans_val, str):
                            try:
                                ans_list = json.loads(ans_val) if ans_val.startswith('[') else [ans_val]
                            except Exception:
                                ans_list = [ans_val]
                            if opt in ans_list:
                                count += 1
                                if a.is_correct is True:
                                    correct_count += 1
                                if student_name:
                                    students.append(student_name)
                opt_acc = correct_count / count if count > 0 else None
                option_stats[opt] = {"count": count, "correct": correct_count, "accuracy": opt_acc, "students": students}
        question_stats[q.id] = {
            "total_answers": total_answers,
            "correct_answers": correct_answers,
            "accuracy": accuracy,
            "option_stats": option_stats
        }

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
                "knowledge_points": json.loads(q.knowledge_points) if q.knowledge_points else [],
                "stats": question_stats.get(q.id, {})
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
    # 学生开始考试时创建StudentExam记录，写入start_time
    student_exam = StudentExam(exam_id=exam_id, student_id=current_user.id, start_time=datetime.now())
    db.add(student_exam)
    db.commit()
    db.refresh(student_exam)
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
                "points": q.points,
                "knowledge_points": json.loads(q.knowledge_points) if q.knowledge_points else []
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
        # 查找已存在的StudentExam记录
        student_exam = db.query(StudentExam).filter(StudentExam.exam_id == exam_id, StudentExam.student_id == current_user.id).first()
        if not student_exam:
            raise HTTPException(status_code=400, detail="未找到考试记录")
        if student_exam.end_time:
            raise HTTPException(status_code=400, detail="您已经提交过这个考试")
        answers = json.loads(answers_data)
        total_score = 0
        questions = db.query(Question).filter(Question.exam_id == exam_id).all()
        for question in questions:
            answer_text = answers.get(str(question.id), "")
            student_answer = StudentAnswer(
                student_exam_id=student_exam.id,
                question_id=question.id,
                answer=json.dumps(answer_text) if isinstance(answer_text, (list, dict)) else answer_text,
                is_correct=False,
                points_earned=0,
                comment=""
            )
            db.add(student_answer)
            # 判题逻辑
            is_correct = False
            if question.question_type == "choice":
                # 解析正确答案（可能是JSON字符串）
                correct_answer = question.correct_answer
                if correct_answer.startswith('[') or correct_answer.startswith('{'):
                    try:
                        correct_answer = json.loads(correct_answer)
                    except:
                        correct_answer = question.correct_answer
                
                # 解析学生答案（可能是JSON字符串）
                student_answer_parsed = answer_text
                if isinstance(answer_text, str) and (answer_text.startswith('[') or answer_text.startswith('{')):
                    try:
                        student_answer_parsed = json.loads(answer_text)
                    except:
                        student_answer_parsed = answer_text
                
                is_correct = student_answer_parsed == correct_answer
                points_earned = question.points if is_correct else 0
                student_answer.is_correct = is_correct
                student_answer.points_earned = points_earned
                total_score += points_earned
            elif question.question_type == "multi":
                # 多选题判题逻辑
                # 解析正确答案（可能是JSON字符串）
                correct_answer = question.correct_answer
                if correct_answer.startswith('[') or correct_answer.startswith('{'):
                    try:
                        correct_answer = json.loads(correct_answer)
                    except:
                        correct_answer = question.correct_answer
                
                # 解析学生答案（可能是JSON字符串）
                student_answer_parsed = answer_text
                if isinstance(answer_text, str) and (answer_text.startswith('[') or answer_text.startswith('{')):
                    try:
                        student_answer_parsed = json.loads(answer_text)
                    except:
                        student_answer_parsed = answer_text
                
                # 多选题：答案必须完全匹配（顺序无关）
                if isinstance(correct_answer, list) and isinstance(student_answer_parsed, list):
                    is_correct = sorted(correct_answer) == sorted(student_answer_parsed)
                else:
                    is_correct = student_answer_parsed == correct_answer
                
                points_earned = question.points if is_correct else 0
                student_answer.is_correct = is_correct
                student_answer.points_earned = points_earned
                total_score += points_earned
            elif question.question_type == "fill_blank":
                # 填空题支持多个空，答案以空格分隔
                student_answers = [ans.strip() for ans in answer_text.split() if ans.strip()]
                correct_answers = [ans.strip() for ans in question.correct_answer.split() if ans.strip()]
                
                # 逐个比较每个空的答案
                correct_count = 0
                for i in range(len(student_answers)):
                    if student_answers[i].lower() == correct_answers[i].lower():
                        correct_count += 1
                
                # 如果所有空都正确，则全对；否则部分正确
                if correct_count == len(correct_answers):
                    is_correct = True
                    points_earned = question.points
                elif correct_count > 0:
                    # 部分正确，按比例给分
                    is_correct = False
                    points_earned = int(question.points * (correct_count / len(correct_answers)))
                else:
                    is_correct = False
                    points_earned = 0
                
                student_answer.is_correct = is_correct
                student_answer.points_earned = points_earned
                total_score += points_earned
            else:
                # 简答题和编程题，设置为None表示待批改
                is_correct = None
                student_answer.is_correct = None
                student_answer.points_earned = 0
                student_answer.comment = ""
            
            # 更新学生-关键词正确率统计（所有知识点都要更新）
            if question.knowledge_points:
                # 假设knowledge_points是JSON字符串数组
                keywords = json.loads(question.knowledge_points) if isinstance(question.knowledge_points, str) else question.knowledge_points
                for keyword in keywords:
                    # 只有已判分的题目才更新正确率统计
                    if is_correct is not None:
                        update_student_keyword_accuracy(db, current_user.id, keyword, is_correct)
        student_exam.score = total_score
        student_exam.end_time = datetime.now()
        db.commit()
        

        
        async def async_ai_weakness_summary(user_id, exam_id):
            from sqlalchemy.orm import Session
            from models import SessionLocal, ExamHistory, User, StudentWrongQuestion, Question, StudentAnswer
            import json as pyjson
            db2 = SessionLocal()
            try:
                user = db2.query(User).filter(User.id == user_id).first()
                from api.ai_api import ai_weakness_summary
                ai_result = None
                try:
                    # 直接调用AI薄弱点分析
                    ai_result = await ai_weakness_summary(answers=None, exam_id=exam_id, current_user=user, db=db2)
                except Exception as e:
                    ai_result = {"summary": f"AI分析失败: {str(e)}"}
                ai_summary = ai_result.get("summary", "") if ai_result else ""
                # 收集本次考试错题的关键词
                weak_keywords = set()
                student_exam = db2.query(StudentExam).filter(StudentExam.exam_id == exam_id, StudentExam.student_id == user_id).first()
                if student_exam:
                    wrong_answers = db2.query(StudentAnswer).filter(StudentAnswer.student_exam_id == student_exam.id, StudentAnswer.is_correct == False).all()
                    for ans in wrong_answers:
                        q = db2.query(Question).filter(Question.id == ans.question_id).first()
                        if q and q.knowledge_points:
                            # 假设knowledge_points是JSON字符串数组，取第一个知识点
                            keyword = json.loads(q.knowledge_points)[0] if isinstance(q.knowledge_points, str) else q.knowledge_points
                            weak_keywords.add(keyword)
                # 保存AI分析结果到ExamHistory
                record = db2.query(ExamHistory).filter(ExamHistory.user_id == user_id, ExamHistory.exam_id == exam_id).first()
                if not record:
                    record = ExamHistory(user_id=user_id, exam_id=exam_id, time=datetime.now())
                    db2.add(record)
                record.comment = ai_summary
                record.weak_keywords = ",".join(weak_keywords) if weak_keywords else ""
                db2.commit()
                # 归档错题到错题本 - 使用题目已有的knowledge_point字段
                # 复用之前查询的错题数据
                if student_exam:
                    for ans in wrong_answers:
                        q = db2.query(Question).filter(Question.id == ans.question_id).first()
                        if not q:
                            continue
                        # 直接使用题目的knowledge_point字段作为关键词
                        keyword = json.loads(q.knowledge_points)[0] if isinstance(q.knowledge_points, str) else q.knowledge_points
                        # 题目快照
                        qdata = {
                            "question": q.question_text,
                            "options": pyjson.loads(q.options) if q.options else {},
                            "type": q.question_type,
                            "knowledge_points": q.knowledge_points,
                            "explanation": q.explanation
                        }
                        # 检查是否已存在相同的错题记录
                        exists = db2.query(StudentWrongQuestion).filter(
                            StudentWrongQuestion.student_id == user_id,
                            StudentWrongQuestion.question_id == q.id
                        ).first()
                        if not exists:
                            db2.add(StudentWrongQuestion(
                                student_id=user_id,
                                question_id=q.id,
                                exam_id=exam_id,
                                keyword=keyword,
                                question_data=pyjson.dumps(qdata, ensure_ascii=False),
                                answer=ans.answer,
                                correct_answer=q.correct_answer,
                                explanation=q.explanation,
                                time=datetime.now()
                            ))
                    db2.commit()
                print(f"学生 {user_id} 的考试 {exam_id} AI薄弱点分析完成并已存储到数据库")
            except Exception as e:
                print(f"AI薄弱点分析失败: {str(e)}")
                db2.rollback()
            finally:
                db2.close()
        
        # 启动异步AI薄弱点分析
        import asyncio
        def run_async_analysis():
            asyncio.run(async_ai_weakness_summary(current_user.id, exam_id))
        threading.Thread(target=run_async_analysis).start()
        return {"msg": "考试提交成功", "score": total_score}
    except Exception as e:
        db.rollback()
        print(e)
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
    # 查找AI薄弱点分析
    from models import ExamHistory
    ai_summary = ""
    record = db.query(ExamHistory).filter(ExamHistory.user_id == current_user.id, ExamHistory.exam_id == exam_id).order_by(ExamHistory.time.desc()).first()
    if record and getattr(record, 'comment', None):
        ai_summary = record.comment
    # 如果AI总结为空，则实时调用AI分析
    if not ai_summary:
        from api.ai_api import ai_weakness_summary
        ai_result = await ai_weakness_summary(answers=None, exam_id=exam_id, current_user=current_user, db=db)
        ai_summary = ai_result.get("summary", "")
        # 保存到ExamHistory
        if not record:
            record = ExamHistory(user_id=current_user.id, exam_id=exam_id, time=datetime.now())
            db.add(record)
        record.comment = ai_summary
        db.commit()
        print("answers:", answers)
        print(type(question_map[answers[0].question_id].options), question_map[answers[0].question_id].options)
    return {
        "exam_id": exam_id,
        "score": student_exam.score,
        "start_time": student_exam.start_time.isoformat(),
        "end_time": student_exam.end_time.isoformat(),
        "answers": [
            {
                "question_id": answer.question_id,
                "options": json.loads(question_map[answer.question_id].options) if answer.question_id in question_map and question_map[answer.question_id].options else {},
                "answer": answer.answer,
                "is_correct": answer.is_correct,
                "points_earned": answer.points_earned,
                "correct_answer": question_map[answer.question_id].correct_answer if answer.question_id in question_map else None,
                "explanation": question_map[answer.question_id].explanation if answer.question_id in question_map else None,
                "type": question_map[answer.question_id].question_type if answer.question_id in question_map else None,
                "comment": answer.comment,
                "question": question_map[answer.question_id].question_text if answer.question_id in question_map else None,
                "points": question_map[answer.question_id].points if answer.question_id in question_map else None,
                "knowledge_points": json.loads(question_map[answer.question_id].knowledge_points) if answer.question_id in question_map and question_map[answer.question_id].knowledge_points else []
            }
            for answer in answers
        ],
        "ai_summary": ai_summary
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
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以删除考试")
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="考试不存在")
    db.delete(exam)
    db.commit()
    return {"msg": "删除成功"} 

@router.get("/student/keyword-accuracy")
async def get_student_keyword_accuracy(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取学生的关键词正确率统计"""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有学生可以查看关键词正确率")
    
    try:
        # 获取学生的所有关键词正确率记录
        accuracy_records = db.query(StudentKeywordAccuracy).filter(
            StudentKeywordAccuracy.student_id == current_user.id
        ).order_by(StudentKeywordAccuracy.accuracy.asc()).all()  # 按正确率升序排列，薄弱点在前
        
        result = []
        for record in accuracy_records:
            result.append({
                "keyword": record.keyword,
                "total_count": record.total_count,
                "correct_count": record.correct_count,
                "accuracy": round(record.accuracy * 100, 2),  # 转换为百分比
                "last_updated": record.last_updated.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return {"keyword_accuracy": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取关键词正确率失败: {str(e)}") 