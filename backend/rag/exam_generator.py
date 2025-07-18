import os
import json
from datetime import datetime
from typing import List, Dict, Any, Union
from langchain.schema import Document
from langchain.text_splitter import CharacterTextSplitter
import torch
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from langchain_community.vectorstores.chroma import Chroma

# 导入LLM调用模块
from .qa import get_completion

DB_DIR = os.path.join(os.path.dirname(__file__), 'db')
os.makedirs(DB_DIR, exist_ok=True)

model_name = "BAAI/bge-large-zh-v1.5"
model_kwargs = {"device": "cuda" if torch.cuda.is_available() else "cpu"}
encode_kwargs = {"normalize_embeddings": True}
# 初始化向量数据库
vector_db = Chroma(
    persist_directory=DB_DIR,
    embedding_function=HuggingFaceBgeEmbeddings(
        model_name=model_name,
        model_kwargs=model_kwargs,
        encode_kwargs=encode_kwargs
    )
)

os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

class ExamGenerator:
    """考核内容生成器"""
    
    def __init__(self):
        self.embeddings = HuggingFaceBgeEmbeddings(
            model_name=model_name,
            model_kwargs=model_kwargs,
            encode_kwargs=encode_kwargs
        )
    
    def get_existing_keywords(self) -> List[str]:
        """获取已有关词池（从知识库、历史关键词等）"""
        try:
            knowledge_keywords = set()
            
            # 从数据库获取历史关键词
            try:
                from models import SessionLocal, StudentKeywordAccuracy
                db = SessionLocal()
                try:
                    # 获取所有关键词
                    keywords = [row[0] for row in db.query(StudentKeywordAccuracy.keyword).distinct().all()]
                    knowledge_keywords.update(keywords)
                finally:
                    db.close()
            except Exception as e:
                print(f"从数据库获取历史关键词失败: {str(e)}")
            
            return list(knowledge_keywords)
        except Exception as e:
            print(f"获取已有关键词失败: {str(e)}")
            return []
    
    
    def search_knowledge(self, query: str, top_k: int = 5) -> List[Document]:
        """搜索相关知识"""
        try:
            docs = vector_db.similarity_search(query, k=top_k)
            return docs
        except Exception as e:
            print(f"知识搜索失败: {str(e)}")
            return []
    
    def generate_concept_questions(self, outline: str, knowledge_docs: List[Document], count: int = 5, difficulty: str = "中等") -> List[Dict]:
        """生成概念题，支持难度选择"""
        try:
            # 构建提示词
            knowledge_text = "\n".join([doc.page_content for doc in knowledge_docs])
            
            prompt = f"""
基于以下课程大纲和知识库内容，生成{count}道{difficulty}难度的概念题：

课程大纲：
{outline}

相关知识：
{knowledge_text}

要求：
1. 每道题包含题目、选项A-D、正确答案、解析、1-3个知识点
2. 题目要覆盖大纲中的主要概念
3. 选项要合理，避免明显错误
4. 解析要详细说明为什么选择该答案
5. 难度要求：{difficulty}难度

请严格按照以下JSON格式返回，不要添加任何其他内容：
{{
    "questions": [
        {{
            "question": "题目内容",
            "options": {{
                "A": "选项A",
                "B": "选项B", 
                "C": "选项C",
                "D": "选项D"
            }},
            "correct_answer": "A",
            "explanation": "解析内容",
            "knowledge_points": ["知识点1", "知识点2"]
        }}
    ]
}}
"""
            
            response = get_completion(prompt)
            print(f"LLM响应: {response}")  # 打印前200个字符用于调试
            
            # 尝试解析JSON响应
            try:
                import re
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    json_str = json_match.group()
                    result = json.loads(json_str)
                    questions = result.get("questions", [])
                    print(f"成功解析JSON，找到 {len(questions)} 道概念题")
                    return questions
                else:
                    print("未找到JSON格式，尝试手动解析")
                    questions = self._parse_questions_manually(response)
                    return questions
            except json.JSONDecodeError as e:
                print(f"JSON解析失败: {str(e)}")
                print("尝试手动解析")
                questions = self._parse_questions_manually(response)
                return questions
                
        except Exception as e:
            print(f"生成概念题失败: {str(e)}")
            return []
    
    def generate_fill_blank_questions(self, outline: str, knowledge_docs: List[Document], count: int = 5, difficulty: str = "中等") -> List[Dict]:
        """生成填空题，支持难度选择"""
        if count < 1:
            return []
        try:
            knowledge_text = "\n".join([doc.page_content for doc in knowledge_docs])
            
            prompt = f"""
基于以下课程大纲和知识库内容，生成{count}道{difficulty}难度的填空题：

课程大纲：
{outline}

相关知识：
{knowledge_text}

要求：
1. 每道题包含题目（用_____表示空白）、答案、解析
2. 题目要覆盖大纲中的重要概念和术语
3. 答案要准确，解析要详细
4. 填空题要考察核心知识点，1-3个知识点
5. 难度要求：{difficulty}难度
6. 如果有多个空，答案用空格分隔，如："答案1 答案2 答案3"

请严格按照以下JSON格式返回，不要添加任何其他内容：
{{
    "questions": [
        {{
            "question": "题目内容，用_____表示空白",
            "correct_answer": "正确答案（多个空用空格分隔）",
            "explanation": "解析内容",
            "knowledge_points": ["知识点1", "知识点2"]
        }}
    ]
}}
"""
            
            response = get_completion(prompt)
            print(f"填空题LLM响应: {response}")
            
            try:
                import re
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    json_str = json_match.group()
                    result = json.loads(json_str)
                    questions = result.get("questions", [])
                    print(f"成功解析JSON，找到 {len(questions)} 道填空题")
                    return questions
                else:
                    print("未找到JSON格式，尝试手动解析")
                    questions = self._parse_fill_questions_manually(response)
                    return questions
            except json.JSONDecodeError as e:
                print(f"JSON解析失败: {str(e)}")
                questions = self._parse_fill_questions_manually(response)
                return questions
                
        except Exception as e:
            print(f"生成填空题失败: {str(e)}")
            return []
    
    def generate_short_answer_questions(self, outline: str, knowledge_docs: List[Document], count: int = 5, difficulty: str = "中等") -> List[Dict]:
        """生成简答题，支持难度选择"""
        try:
            knowledge_text = "\n".join([doc.page_content for doc in knowledge_docs])
            
            prompt = f"""
基于以下课程大纲和知识库内容，生成{count}道{difficulty}难度的简答题：

课程大纲：
{outline}

相关知识：
{knowledge_text}

要求：
1. 每道题包含题目、参考答案、评分要点、解析、1-3个知识点
2. 题目要考察对概念的理解和应用
3. 参考答案要详细，包含关键要点
4. 评分要点要明确，便于评分
5. 解析要说明解题思路
6. 难度要求：{difficulty}难度

请严格按照以下JSON格式返回，不要添加任何其他内容：
{{
    "questions": [
        {{
            "question": "题目内容",
            "correct_answer": "参考答案",
            "scoring_points": ["评分要点1", "评分要点2"],
            "explanation": "解析内容",
            "knowledge_points": ["知识点1", "知识点2"]
        }}
    ]
}}
"""
            
            response = get_completion(prompt)
            print(f"简答题LLM响应: {response}")
            
            try:
                import re
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    json_str = json_match.group()
                    result = json.loads(json_str)
                    questions = result.get("questions", [])
                    print(f"成功解析JSON，找到 {len(questions)} 道简答题")
                    return questions
                else:
                    print("未找到JSON格式，尝试手动解析")
                    questions = self._parse_short_questions_manually(response)
                    return questions
            except json.JSONDecodeError as e:
                print(f"JSON解析失败: {str(e)}")
                questions = self._parse_short_questions_manually(response)
                return questions
                
        except Exception as e:
            print(f"生成简答题失败: {str(e)}")
            return []
    
    def generate_programming_questions(self, outline: str, knowledge_docs: List[Document], count: int = 3, difficulty: str = "中等") -> List[Dict]:
        """生成编程题（针对计算机类课程），支持难度选择"""
        try:
            knowledge_text = "\n".join([doc.page_content for doc in knowledge_docs])
            
            prompt = f"""
基于以下课程大纲和知识库内容，生成{count}道{difficulty}难度的编程题：

课程大纲：
{outline}

相关知识：
{knowledge_text}

要求：
1. 每道题包含题目描述、代码要求、参考答案、解析、1-3个知识点
2. 题目要考察编程思维和代码实现能力
3. 参考答案要包含完整代码和注释
4. 解析要说明解题思路和关键点
5. 难度要求：{difficulty}难度

请严格按照以下JSON格式返回，不要添加任何其他内容：
{{
    "questions": [
        {{
            "question": "题目描述",
            "requirements": "代码要求",
            "correct_answer": "参考答案代码",
            "explanation": "解题思路和关键点",
            "knowledge_points": ["知识点1", "知识点2"]
        }}
    ]
}}
"""
            
            response = get_completion(prompt)
            print(f"编程题LLM响应: {response}")
            
            try:
                import re
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    json_str = json_match.group()
                    result = json.loads(json_str)
                    questions = result.get("questions", [])
                    print(f"成功解析JSON，找到 {len(questions)} 道编程题")
                    
                    return questions
                else:
                    print("未找到JSON格式，尝试手动解析")
                    questions = self._parse_programming_questions_manually(response)
                    return questions
            except json.JSONDecodeError as e:
                print(f"JSON解析失败: {str(e)}")
                questions = self._parse_programming_questions_manually(response)
                return questions
                
        except Exception as e:
            print(f"生成编程题失败: {str(e)}")
            return []
    
    def generate_multi_questions(self, outline: str, knowledge_docs: List[Document], count: int = 5, difficulty: str = "中等") -> List[Dict]:
        """生成多选题，支持难度选择"""
        try:
            knowledge_text = "\n".join([doc.page_content for doc in knowledge_docs])
            prompt = f"""
基于以下课程大纲和知识库内容，生成{count}道{difficulty}难度的多选题：

课程大纲：
{outline}

相关知识：
{knowledge_text}

要求：
1. 每道题包含题目、选项A-D、所有正确答案（如['A','C']）、解析、1-3个知识点
2. 题目要覆盖大纲中的重要知识点
3. 选项要合理，避免明显错误
4. 解析要详细说明为什么选择这些答案
5. 难度要求：{difficulty}难度

请严格按照以下JSON格式返回，不要添加任何其他内容：
{{
    "questions": [
        {{
            "question": "题目内容",
            "options": {{
                "A": "选项A",
                "B": "选项B", 
                "C": "选项C",
                "D": "选项D"
            }},
            "correct_answer": ["A", "C"],
            "explanation": "解析内容",
            "knowledge_points": ["知识点1", "知识点2"]
        }}
    ]
}}
"""
            response = get_completion(prompt)
            print(f"多选题LLM响应: {response}")
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                result = json.loads(json_str)
                questions = result.get("questions", [])
                print(f"成功解析JSON，找到 {len(questions)} 道多选题")
                return questions
            else:
                print("未找到JSON格式，尝试手动解析")
                questions = []
                # 这里手动解析暂不实现，保持兼容
                return questions
        except Exception as e:
            print(f"生成多选题失败: {str(e)}")
            return []
    
    def _parse_questions_manually(self, response: str) -> List[Dict]:
        """手动解析概念题响应"""
        questions = []
        try:
            print("开始手动解析概念题...")
            lines = response.split('\n')
            current_question = {}
            question_count = 0
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # 检测新题目的开始
                if (line.startswith('题目：') or line.startswith('Q:') or 
                    line.startswith('问题：') or line.startswith('1.') or 
                    line.startswith('2.') or line.startswith('3.') or
                    line.startswith('4.') or line.startswith('5.')):
                    
                    if current_question and 'question' in current_question:
                        questions.append(current_question)
                        question_count += 1
                    
                    if '：' in line:
                        current_question = {'question': line.split('：', 1)[1]}
                    elif ':' in line:
                        current_question = {'question': line.split(':', 1)[1]}
                    else:
                        current_question = {'question': line}
                    current_question['options'] = {}
                    
                elif (line.startswith('A.') or line.startswith('A:') or 
                      line.startswith('选项A:') or line.startswith('A)')):
                    if 'options' not in current_question:
                        current_question['options'] = {}
                    current_question['options']['A'] = line.split('.', 1)[1] if '.' in line else line.split(':', 1)[1] if ':' in line else line.split(')', 1)[1]
                    
                elif (line.startswith('B.') or line.startswith('B:') or 
                      line.startswith('选项B:') or line.startswith('B)')):
                    current_question['options']['B'] = line.split('.', 1)[1] if '.' in line else line.split(':', 1)[1] if ':' in line else line.split(')', 1)[1]
                    
                elif (line.startswith('C.') or line.startswith('C:') or 
                      line.startswith('选项C:') or line.startswith('C)')):
                    current_question['options']['C'] = line.split('.', 1)[1] if '.' in line else line.split(':', 1)[1] if ':' in line else line.split(')', 1)[1]
                    
                elif (line.startswith('D.') or line.startswith('D:') or 
                      line.startswith('选项D:') or line.startswith('D)')):
                    current_question['options']['D'] = line.split('.', 1)[1] if '.' in line else line.split(':', 1)[1] if ':' in line else line.split(')', 1)[1]
                    
                elif (line.startswith('答案：') or line.startswith('正确答案:') or 
                      line.startswith('正确选项:') or line.startswith('答案:')):
                    current_question['correct_answer'] = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    
                elif (line.startswith('解析：') or line.startswith('解释:') or 
                      line.startswith('说明:') or line.startswith('分析:')):
                    current_question['explanation'] = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    
                elif (line.startswith('知识点：') or line.startswith('对应知识点:') or 
                      line.startswith('考点:') or line.startswith('涉及:')):
                    # 支持多个知识点，逗号分隔
                    value = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    points = [kw.strip() for kw in value.replace('，', ',').split(',') if kw.strip()]
                    current_question['knowledge_points'] = points if points else []
            
            if current_question and 'question' in current_question:
                questions.append(current_question)
                question_count += 1
            
            print(f"手动解析完成，找到 {question_count} 道概念题")
            return questions
                
        except Exception as e:
            print(f"手动解析失败: {str(e)}")
            return []
    
    def _parse_fill_questions_manually(self, response: str) -> List[Dict]:
        """手动解析填空题响应"""
        questions = []
        try:
            print("开始手动解析填空题...")
            lines = response.split('\n')
            current_question = {}
            question_count = 0
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                if (line.startswith('题目：') or line.startswith('Q:') or 
                    line.startswith('问题：') or line.startswith('1.') or 
                    line.startswith('2.') or line.startswith('3.') or
                    line.startswith('4.') or line.startswith('5.')):
                    
                    if current_question and 'question' in current_question:
                        questions.append(current_question)
                        question_count += 1
                    
                    if '：' in line:
                        current_question = {'question': line.split('：', 1)[1]}
                    elif ':' in line:
                        current_question = {'question': line.split(':', 1)[1]}
                    else:
                        current_question = {'question': line}
                        
                elif (line.startswith('答案：') or line.startswith('正确答案:') or 
                      line.startswith('答案:') or line.startswith('答:')):
                    current_question['correct_answer'] = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    
                elif (line.startswith('解析：') or line.startswith('解释:') or 
                      line.startswith('说明:') or line.startswith('分析:')):
                    current_question['explanation'] = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    
                elif (line.startswith('知识点：') or line.startswith('对应知识点:') or 
                      line.startswith('考点:') or line.startswith('涉及:')):
                    value = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    points = [kw.strip() for kw in value.replace('，', ',').split(',') if kw.strip()]
                    current_question['knowledge_points'] = points if points else []
            
            if current_question and 'question' in current_question:
                questions.append(current_question)
                question_count += 1
            
            print(f"手动解析完成，找到 {question_count} 道填空题")
            return questions
                
        except Exception as e:
            print(f"手动解析填空题失败: {str(e)}")
            return []
    
    def _parse_short_questions_manually(self, response: str) -> List[Dict]:
        """手动解析简答题响应"""
        questions = []
        try:
            print("开始手动解析简答题...")
            lines = response.split('\n')
            current_question = {}
            question_count = 0
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                if (line.startswith('题目：') or line.startswith('Q:') or 
                    line.startswith('问题：') or line.startswith('1.') or 
                    line.startswith('2.') or line.startswith('3.') or
                    line.startswith('4.') or line.startswith('5.')):
                    
                    if current_question and 'question' in current_question:
                        questions.append(current_question)
                        question_count += 1
                    
                    if '：' in line:
                        current_question = {'question': line.split('：', 1)[1]}
                    elif ':' in line:
                        current_question = {'question': line.split(':', 1)[1]}
                    else:
                        current_question = {'question': line}
                    current_question['scoring_points'] = []
                        
                elif (line.startswith('答案：') or line.startswith('参考答案:') or 
                      line.startswith('答案:') or line.startswith('答:')):
                    current_question['correct_answer'] = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    
                elif (line.startswith('评分要点：') or line.startswith('要点:') or 
                      line.startswith('评分点:') or line.startswith('关键点:')):
                    point = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    if 'scoring_points' not in current_question:
                        current_question['scoring_points'] = []
                    current_question['scoring_points'].append(point)
                    
                elif (line.startswith('知识点：') or line.startswith('对应知识点:') or 
                      line.startswith('考点:') or line.startswith('涉及:')):
                    value = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    points = [kw.strip() for kw in value.replace('，', ',').split(',') if kw.strip()]
                    current_question['knowledge_points'] = points if points else []
            
            if current_question and 'question' in current_question:
                questions.append(current_question)
                question_count += 1
            
            print(f"手动解析完成，找到 {question_count} 道简答题")
            return questions
                
        except Exception as e:
            print(f"手动解析简答题失败: {str(e)}")
            return []
    
    def _parse_programming_questions_manually(self, response: str) -> List[Dict]:
        """手动解析编程题响应"""
        questions = []
        try:
            print("开始手动解析编程题...")
            lines = response.split('\n')
            current_question = {}
            question_count = 0
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                if (line.startswith('题目：') or line.startswith('Q:') or 
                    line.startswith('问题：') or line.startswith('1.') or 
                    line.startswith('2.') or line.startswith('3.')):
                    
                    if current_question and 'question' in current_question:
                        questions.append(current_question)
                        question_count += 1
                    
                    if '：' in line:
                        current_question = {'question': line.split('：', 1)[1]}
                    elif ':' in line:
                        current_question = {'question': line.split(':', 1)[1]}
                    else:
                        current_question = {'question': line}
                        
                elif (line.startswith('要求：') or line.startswith('代码要求:') or 
                      line.startswith('要求:') or line.startswith('需求:')):
                    current_question['requirements'] = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    
                elif (line.startswith('答案：') or line.startswith('参考答案:') or 
                      line.startswith('代码:') or line.startswith('实现:')):
                    current_question['correct_answer'] = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    
                elif (line.startswith('解析：') or line.startswith('解释:') or 
                      line.startswith('说明:') or line.startswith('分析:')):
                    current_question['explanation'] = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    
                elif (line.startswith('知识点：') or line.startswith('对应知识点:') or 
                      line.startswith('考点:') or line.startswith('涉及:')):
                    value = line.split('：', 1)[1] if '：' in line else line.split(':', 1)[1]
                    points = [kw.strip() for kw in value.replace('，', ',').split(',') if kw.strip()]
                    current_question['knowledge_points'] = points if points else []
            
            if current_question and 'question' in current_question:
                questions.append(current_question)
                question_count += 1
            
            print(f"手动解析完成，找到 {question_count} 道编程题")
            return questions
                
        except Exception as e:
            print(f"手动解析编程题失败: {str(e)}")
            return []

    def generate_exam_content(self, outline: str, question_config: dict = None, difficulty: str = "中等") -> Dict[str, Any]:
        """生成完整的考核内容，支持难度选择"""
        try:
            print("开始生成考核内容...")
            # 搜索相关知识
            knowledge_docs = self.search_knowledge(outline, top_k=10)
            print(f"找到 {len(knowledge_docs)} 个相关知识片段")
            # 生成不同类型的题目
            exam_content = {
                "outline": outline,
                "generated_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                "concept_questions": [],
                "multi_questions": [],
                "fill_blank_questions": [],
                "short_answer_questions": [],
                "programming_questions": []
            }
            qc = question_config or {}
            # 概念题（单选）
            if qc.get('choice', {}).get('enabled', True):
                count = qc.get('choice', {}).get('count', 5)
                points = qc.get('choice', {}).get('points', 2)
                print(f"生成{count}道单选题，每题{points}分，难度：{difficulty}")
                questions = self.generate_concept_questions(outline, knowledge_docs, count, difficulty)
                for q in questions:
                    q['points'] = points
                exam_content["concept_questions"] = questions
            # 多选题
            if qc.get('multi', {}).get('enabled', False):
                count = qc.get('multi', {}).get('count', 0)
                points = qc.get('multi', {}).get('points', 3)
                print(f"生成{count}道多选题，每题{points}分，难度：{difficulty}")
                questions = self.generate_multi_questions(outline, knowledge_docs, count, difficulty)
                for q in questions:
                    q['points'] = points
                exam_content["multi_questions"] = questions
            # 填空题
            if qc.get('fill_blank', {}).get('enabled', True):
                count = qc.get('fill_blank', {}).get('count', 2)
                points = qc.get('fill_blank', {}).get('points', 4)
                print(f"生成{count}道填空题，每题{points}分，难度：{difficulty}")
                questions = self.generate_fill_blank_questions(outline, knowledge_docs, count, difficulty)
                for q in questions:
                    q['points'] = points
                exam_content["fill_blank_questions"] = questions
            # 简答题
            if qc.get('short_answer', {}).get('enabled', True):
                count = qc.get('short_answer', {}).get('count', 2)
                points = qc.get('short_answer', {}).get('points', 5)
                print(f"生成{count}道简答题，每题{points}分，难度：{difficulty}")
                questions = self.generate_short_answer_questions(outline, knowledge_docs, count, difficulty)
                for q in questions:
                    q['points'] = points
                exam_content["short_answer_questions"] = questions
            # 编程题：只有勾选时才生成
            if qc.get('programming', {}).get('enabled', False):
                count = qc.get('programming', {}).get('count', 1)
                points = qc.get('programming', {}).get('points', 10)
                print(f"生成{count}道编程题，每题{points}分，难度：{difficulty}")
                questions = self.generate_programming_questions(outline, knowledge_docs, count, difficulty)
                for q in questions:
                    q['points'] = points
                exam_content["programming_questions"] = questions
            else:
                print("未勾选编程题或大纲不适合，不生成编程题。")
            print("考核内容生成完成")
            return exam_content
        except Exception as e:
            print(f"生成考核内容失败: {str(e)}")
            raise e

# 创建全局实例
exam_generator = ExamGenerator() 