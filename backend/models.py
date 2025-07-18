import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import json

Base = declarative_base()

class User(Base):
    """用户表"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False)
    role = Column(String(20), default="student")  # student, teacher, admin
    created_at = Column(DateTime, default=datetime.now)
    session_token = Column(String(100), nullable=True)
    
    # 关系
    created_exams = relationship("Exam", back_populates="teacher")
    student_exams = relationship("StudentExam", back_populates="student")

class Exam(Base):
    """考试表"""
    __tablename__ = "exams"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    duration = Column(Integer, default=60)  # 考试时长（分钟）
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    
    # 关系
    teacher = relationship("User", back_populates="created_exams")
    questions = relationship("Question", back_populates="exam", cascade="all, delete-orphan")
    student_exams = relationship("StudentExam", back_populates="exam", cascade="all, delete-orphan")

class Question(Base):
    """题目表"""
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    question_type = Column(String(20), nullable=False)  # choice, fill_blank, short_answer, programming
    question_text = Column(Text, nullable=False)
    options = Column(Text)  # JSON字符串，选择题选项
    correct_answer = Column(Text)
    points = Column(Float, default=1)  # 分值
    explanation = Column(Text)  # 解析
    knowledge_points = Column(Text)  # 知识点数组，JSON字符串
    
    # 关系
    exam = relationship("Exam", back_populates="questions")
    student_answers = relationship("StudentAnswer", back_populates="question")

class StudentExam(Base):
    """学生考试记录表"""
    __tablename__ = "student_exams"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    start_time = Column(DateTime, default=datetime.now)
    end_time = Column(DateTime)
    score = Column(Float, default=0)
    
    # 关系
    student = relationship("User", back_populates="student_exams")
    exam = relationship("Exam", back_populates="student_exams")
    answers = relationship("StudentAnswer", back_populates="student_exam", cascade="all, delete-orphan")

class StudentAnswer(Base):
    """学生答案表"""
    __tablename__ = "student_answers"
    
    id = Column(Integer, primary_key=True, index=True)
    student_exam_id = Column(Integer, ForeignKey("student_exams.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    answer = Column(Text)
    is_correct = Column(Boolean, nullable=True)
    points_earned = Column(Float, default=0)
    comment = Column(Text, default="")  # 教师评语，可为空
    
    # 关系
    student_exam = relationship("StudentExam", back_populates="answers")
    question = relationship("Question", back_populates="student_answers")

class QAHistory(Base):
    __tablename__ = "qa_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question = Column(Text)
    answer = Column(Text)
    time = Column(DateTime, default=datetime.now)

class TeachingPlanHistory(Base):
    __tablename__ = "teaching_plan_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    outline = Column(Text)
    plan = Column(Text)
    lesson_schedule = Column(Text)  # 新增
    time = Column(DateTime, default=datetime.now)

class ExamHistory(Base):
    __tablename__ = "exam_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exam_id = Column(Integer)  # 新增字段，关联考试ID
    outline = Column(Text)
    subject_type = Column(String(50))
    exam_content = Column(Text)
    comment = Column(Text)  # AI总结
    weak_keywords = Column(Text, default="")  # 新增：AI提取的薄弱知识点关键词
    time = Column(DateTime, default=datetime.now)

class StudentWrongQuestion(Base):
    __tablename__ = "student_wrong_questions"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    exam_id = Column(Integer, nullable=False)
    keyword = Column(String(100), nullable=False)  # 归类的知识点关键词
    question_data = Column(Text)  # 题目内容快照（可存json字符串）
    answer = Column(Text)  # 学生当时的答案
    correct_answer = Column(Text)
    explanation = Column(Text)
    time = Column(DateTime, default=datetime.now)

class StudentKeywordAccuracy(Base):
    """学生-关键词正确率统计表"""
    __tablename__ = "student_keyword_accuracy"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    keyword = Column(String(100), nullable=False)  # 知识点关键词
    total_count = Column(Integer, default=0)  # 该关键词下答题总数
    correct_count = Column(Integer, default=0)  # 该关键词下答对数
    accuracy = Column(Float, default=0.0)  # 正确率（冗余存储，便于查询）
    last_updated = Column(DateTime, default=datetime.now)
    
    # 创建唯一索引，确保每个学生-关键词组合只有一条记录
    __table_args__ = (
        # 这里可以添加唯一约束，但SQLite支持有限，我们在代码中处理
    )

class StudentPracticeRecord(Base):
    __tablename__ = "student_practice_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    keyword = Column(String(100), nullable=False)
    question = Column(Text)
    options = Column(Text)  # JSON字符串
    correct_answer = Column(Text)
    student_answer = Column(Text)
    is_correct = Column(Boolean)
    explanation = Column(Text)
    time = Column(DateTime, default=datetime.now)

class KnowledgeFilePermission(Base):
    __tablename__ = 'knowledge_file_permission'
    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String, unique=True, nullable=False)
    student_can_download = Column(Boolean, default=False)
    upload_time = Column(DateTime, default=datetime.now)

# 数据库连接
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'exam_system.db')}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建表
Base.metadata.create_all(bind=engine)

def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 