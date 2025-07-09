import os
import re
from langchain_chroma import Chroma
from langchain.embeddings.huggingface import HuggingFaceEmbeddings
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
            {"role": "system", "content": "你是一位经验丰富的教育专家，擅长设计教学内容和课程计划。"},
            {"role": "user", "content": prompt},
        ],
        stream=False
    )
    return response.choices[0].message.content

def retrieve_relevant_docs(query, k=5):
    """检索相关的教学文档"""
    try:
        docs = vector_db.similarity_search(query, k=k)
        return "\n".join([doc.page_content for doc in docs])
    except Exception as e:
        print(f"检索文档失败: {str(e)}")
        return ""

def generate_teaching_outline(course_outline):
    relevant_docs = retrieve_relevant_docs(course_outline)
    prompt = f"""
请根据以下资料内容，梳理出本课程的知识点结构，要求只输出知识点框架（用Markdown标题，层级清晰，不要超过2级），不要输出任何具体内容说明。

【资料内容】
{relevant_docs if relevant_docs else "暂无相关教学资源"}

输出示例：
# 第一章：xxx
## 1.1 xxx
## 1.2 xxx
# 第二章：xxx
...
"""
    outline = get_completion(prompt)
    return outline

def generate_detailed_content_for_outline(outline):
    prompt = f"""
你是一位专业的课程内容设计AI。请根据下方知识框架（Markdown标题结构），结合知识库资料，在每个最小层级标题（即没有子标题的标题）下自动补充详细教学内容，内容要结合资料，条理清晰，适合PPT展示。最终输出完整的Markdown文档，保留原有标题结构，每个最小标题下都要有详细内容。

【知识框架】
{outline}

【资料内容】
{retrieve_relevant_docs(outline)}
"""
    content = get_completion(prompt)
    return content

def generate_practice_exercises(topic, difficulty="中等"):
    """生成实训练习与指导"""
    
    prompt = f"""
请为以下教学主题设计实训练习与指导：

【教学主题】
{topic}

【难度要求】
{difficulty}

请设计：

1. 【基础练习】（适合初学者）
   - 概念理解题
   - 简单应用题

2. 【进阶练习】（适合有一定基础的学生）
   - 综合分析题
   - 实际案例题

3. 【拓展练习】（适合优秀学生）
   - 创新思维题
   - 研究性题目

4. 【练习指导】
   - 解题思路
   - 常见错误分析
   - 学习建议

请确保练习题目由浅入深，覆盖知识点全面，并提供详细的解题指导。
"""

    exercises = get_completion(prompt)
    return exercises

def create_lesson_plan(chapter, duration=90):
    """创建单节课教学计划"""
    
    prompt = f"""
请为以下章节设计详细的单节课教学计划：

【章节内容】
{chapter}

【课时安排】
{duration}分钟

请设计：

1. 【课前准备】（5分钟）
   - 复习上节课内容
   - 引入新课主题

2. 【新课讲授】（60分钟）
   - 知识点讲解
   - 重点难点突破
   - 师生互动

3. 【课堂练习】（15分钟）
   - 即时练习
   - 小组讨论

4. 【总结与作业】（10分钟）
   - 课堂总结
   - 布置作业

请确保教学计划时间安排合理，内容充实，互动性强。
"""

    lesson_plan = get_completion(prompt)
    return lesson_plan 