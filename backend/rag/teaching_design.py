import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
import re
import torch
from langchain_community.vectorstores.chroma import Chroma
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from openai import OpenAI

DB_DIR = os.path.join(os.path.dirname(__file__), 'db')
API_KEY = "sk-9fabf0d9e8e84d0994756d5846207c04"
model_name = "BAAI/bge-large-zh-v1.5"
model_kwargs = {"device": "cuda" if torch.cuda.is_available() else "cpu"}
encode_kwargs = {"normalize_embeddings": True}

vector_db = Chroma(
    persist_directory=DB_DIR,
    embedding_function=HuggingFaceBgeEmbeddings(
        model_name=model_name,
        model_kwargs=model_kwargs,
        encode_kwargs=encode_kwargs
    )
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

def search_teaching_materials(query: str, top_k: int = 10) -> list:
    """
    使用与测试脚本相同的向量查找方式搜索教学资料
    """
    try:
        docs_with_scores = vector_db.similarity_search_with_score(query, k=top_k)
        
        results = []
        for doc, score in docs_with_scores:
            results.append({
                '内容': doc.page_content,
                '来源': doc.metadata.get('source', '未知'),
                '页码': doc.metadata.get('page', '未知'),
                '相似度': float(score)
            })
        
        print(f"[调试] 教学资料搜索找到 {len(results)} 个相关片段")
        return results
    except Exception as e:
        print(f"教学资料搜索失败: {str(e)}")
        return []

def generate_teaching_outline(course_outline):
    relevant_docs = search_teaching_materials(course_outline)
    
    # 格式化资料内容
    if relevant_docs:
        content_text = "\n\n".join([
            f"【资料片段 {i+1}】{doc['内容']}\n（来源：{doc['来源']} 第{doc['页码']}页）"
            for i, doc in enumerate(relevant_docs)
        ])
    else:
        content_text = "暂无相关教学资源"
    
    prompt = f"""
请根据以下资料内容，和教学大纲，梳理出本课程的知识点结构，要求只输出知识点框架。用Markdown标题，只能出现井号（#），不要出现星号（*），层级清晰，不要超过2级。

【教学大纲】
{course_outline}

【资料内容】
{content_text}

输出示例：
# 1.xxx
## 1.1 xxx
## 1.2 xxx
# 2.xxx
# 2.1 xxx
# 2.2 xxx
...
"""
    outline = get_completion(prompt)
    return outline

def generate_detailed_content_for_outline(outline):
    relevant_docs = search_teaching_materials(outline)
    
    # 格式化资料内容
    if relevant_docs:
        content_text = "\n\n".join([
            f"【资料片段 {i+1}】{doc['内容']}\n（来源：{doc['来源']} 第{doc['页码']}页）"
            for i, doc in enumerate(relevant_docs)
        ])
    else:
        content_text = "暂无相关教学资源"
    
    prompt = f"""
你是一位专业的课程PPT设计AI。
1. 请根据下方知识框架在每个最小层级标题（即没有子标题的标题）下自动补充详细教学内容，内容要结合资料，条理清晰，适合PPT展示。
2. 起一个标题，标题要简洁明了，能概括大纲内容。
3. 在知识框架上方加入以下内容：
---
title: 你起的标题 
---
4. 最终输出完整的Markdown文档。

【知识框架】
{outline}

【资料内容】
{content_text}
"""
    content = get_completion(prompt)
    return content



def extract_duration_from_prompt(prompt: str) -> int:
    """从教师输入的课程大纲或prompt中提取学时要求，若无则返回0"""
    match = re.search(r"(\d+)\s*学时", prompt)
    if match:
        return int(match.group(1))
    return 0

def generate_lesson_schedule(outline: str) -> str:
    """
    传入生成的大纲，用LLM生成学时安排表（Markdown格式）
    """
    prompt = f"""
你是一位专业的课程设计AI，请根据下方课程知识框架，为每一章合理分配学时，生成学时安排表，要求如下：
1. 结合常规课程安排和内容难度，合理分配每章学时。
2. 输出标准Markdown表格，表头为“章节”和“学时”。
3. 不要输出多余内容，只输出表格。

【课程知识框架】
{outline}
"""
    table = get_completion(prompt)
    return table