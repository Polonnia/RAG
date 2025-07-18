import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
import torch
from langchain_community.embeddings import HuggingFaceBgeEmbeddings
from langchain_community.vectorstores.chroma import Chroma
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
            {"role": "system", "content": "You are a helpful assistant"},
            {"role": "user", "content": prompt},
        ],
        stream=False
    )
    return response.choices[0].message.content

def process_text_fragments(text_fragments: list, question: str) -> list:
    """
    使用LLM处理文本片段，使其成为语义完整的句子或段落
    """
    try:
        # 构建处理提示词
        fragments_text = "\n\n".join([
            f"片段{i+1}: {fragment['content']}"
            for i, fragment in enumerate(text_fragments)
        ])
        
        prompt = f"""
请处理以下文本片段，使其成为语义完整的句子或段落，以便更好地回答用户问题。

用户问题：{question}

原始文本片段：
{fragments_text}

要求：
1. 不改变原文内容，只删减头尾
2. 确保每个片段是语义完整的一组句子或段落
3. 保持原有的片段编号和格式
4. 确保处理后的片段能有效回答用户问题
5. 如果几个片段的内容是连续的，则将它们合并为一个片段

请按照以下格式返回处理后的片段：
片段1: [处理后的内容]
片段2: [处理后的内容]
...

只返回处理后的片段内容，不要添加其他说明。
"""
        
        # 调用LLM处理
        processed_text = get_completion(prompt)
        
        # 解析处理后的片段
        processed_fragments = []
        lines = processed_text.strip().split('\n')
        current_fragment = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # 检查是否是新的片段开始
            if line.startswith('片段') and ':' in line:
                # 保存前一个片段
                if current_fragment is not None:
                    processed_fragments.append(current_fragment)
                
                # 开始新片段
                fragment_num = line.split(':', 1)[0].replace('片段', '').strip()
                content = line.split(':', 1)[1].strip()
                current_fragment = {
                    'fragment_num': int(fragment_num),
                    'content': content
                }
            elif current_fragment is not None:
                # 继续当前片段的内容
                current_fragment['content'] += '\n' + line
        
        # 添加最后一个片段
        if current_fragment is not None:
            processed_fragments.append(current_fragment)
        
        # 按片段编号排序
        processed_fragments.sort(key=lambda x: x['fragment_num'])
        
        # 更新原始片段的内容
        for i, fragment in enumerate(text_fragments):
            if i < len(processed_fragments):
                fragment['content'] = processed_fragments[i]['content']
        
        print(f"[调试] 成功处理 {len(processed_fragments)} 个文本片段")
        return text_fragments
        
    except Exception as e:
        print(f"处理文本片段失败: {str(e)}")
        return text_fragments

def qa_query(question: str, top_k: int = 5, score_threshold: float = 0.7) -> dict:
    """
    使用与测试脚本相同的向量查找方式，只返回相似度大于0.7的片段
    """
    try:
        # 使用与测试脚本相同的检索方式
        docs_with_scores = vector_db.similarity_search_with_score(question, k=top_k)
        
        # 只保留相似度大于score_threshold的片段
        filtered_docs_with_scores = [
            (doc, score) for doc, score in docs_with_scores if score > score_threshold
        ]
        
        # 调试输出
        for i, (doc, score) in enumerate(filtered_docs_with_scores):
            print(f"[调试] 片段{i+1}: 相似度={score:.4f}, 来源={doc.metadata.get('source', '未知')}, 页码={doc.metadata.get('page', '?')}, 内容长度={len(doc.page_content)}")
        
        if not filtered_docs_with_scores:
            return {
                "answer": "抱歉，没有找到与您问题相关的资料片段。",
                "sources": []
            }
        
        # 准备原始片段数据
        original_fragments = [
            {
                'content': doc.page_content,
                'metadata': {
                    k: v for k, v in doc.metadata.items()
                    if k in ['source', 'page', 'chunk_id']
                }
            }
            for doc, score in filtered_docs_with_scores
        ]
        
        # 使用LLM处理文本片段
        processed_fragments = process_text_fragments(original_fragments, question)
        
        # 构建上下文
        context = "\n\n".join(
            f"【资料片段 {i+1}】{fragment['content']}\n"
            f"（来源：{fragment['metadata'].get('source', '未知')} 第{fragment['metadata'].get('page', '?')}页）"
            for i, fragment in enumerate(processed_fragments)
        )

        prompt = f"""基于以下课程资料：
{context}

请严格根据资料回答：{question}
注意：
1.如果涉及数学公式用$...$或$$...$$表示
2.每个结论需标注来源编号如【1】"""

        return {
            "answer": get_completion(prompt),
            "sources": [
                {
                    "content": fragment['content'],
                    "metadata": fragment['metadata']
                }
                for fragment in processed_fragments
            ]
        }
    except Exception as e:
        print(f"向量查找失败: {str(e)}")
        return {
            "answer": "抱歉，检索相关文档时出现错误，请稍后重试。",
            "sources": []
        }