from rank_bm25 import BM25Okapi
import jieba
from .resources import get_vector_db
from .llm_client import completion_text, get_default_model
vector_db = get_vector_db()

def get_completion(prompt, model=None):
    return completion_text(
        prompt=prompt,
        model=model or get_default_model(),
        system_prompt="You are a helpful assistant",
        temperature=0,
    )

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

# 新增：混合检索

def hybrid_search(question, top_k=5, score_threshold=0.6):
    # 1. 稠密向量检索
    docs_with_scores = vector_db.similarity_search_with_score(question, k=top_k)
    dense_docs = [(doc, score) for doc, score in docs_with_scores if score > score_threshold]
    dense_ids = set([doc.metadata.get('chunk_id', doc.page_content[:30]) for doc, _ in dense_docs])

    # 2. BM25检索
    # 获取所有文档片段
    all_docs = vector_db.get()['documents']
    all_metas = vector_db.get()['metadatas']
    all_chunks = [
        {'content': doc, 'metadata': meta}
        for doc, meta in zip(all_docs, all_metas)
    ]
    corpus = [c['content'] for c in all_chunks]
    tokenized_corpus = [list(jieba.cut(doc)) for doc in corpus]
    bm25 = BM25Okapi(tokenized_corpus)
    bm25_scores = bm25.get_scores(list(jieba.cut(question)))
    bm25_top = sorted(enumerate(bm25_scores), key=lambda x: -x[1])[:top_k]
    bm25_docs = [all_chunks[i] for i, _ in bm25_top]
    bm25_ids = set([c['metadata'].get('chunk_id', c['content'][:30]) for c in bm25_docs])

    # 3. 合并去重，优先稠密检索，再补充BM25
    final_chunks = []
    seen = set()
    # 稠密检索结果
    for doc, score in dense_docs:
        cid = doc.metadata.get('chunk_id', doc.page_content[:30])
        if cid not in seen:
            final_chunks.append({'content': doc.page_content, 'metadata': doc.metadata})
            seen.add(cid)
    # BM25补充
    for c in bm25_docs:
        cid = c['metadata'].get('chunk_id', c['content'][:30])
        if cid not in seen:
            final_chunks.append(c)
            seen.add(cid)
        if len(final_chunks) >= top_k:
            break
    return final_chunks[:top_k]


def qa_query(question: str, top_k: int = 5, score_threshold: float = 0.6) -> dict:
    try:
        # 混合检索
        retrieved_chunks = hybrid_search(question, top_k=top_k, score_threshold=score_threshold)
        if not retrieved_chunks:
            return {
                "answer": "抱歉，没有找到与您问题相关的资料片段。",
                "sources": []
            }
        # 调试输出
        for i, fragment in enumerate(retrieved_chunks):
            meta = fragment.get('metadata', {})
            start_time = meta.get('start_time')
            end_time = meta.get('end_time')
            time_info = f", 时间戳={start_time}~{end_time}秒" if start_time is not None or end_time is not None else ""
            print(f"[混合检索] 片段{i+1}: 来源={meta.get('source', '未知')}, 页码={meta.get('page', '?')}, 内容长度={len(fragment['content'])}{time_info}")
        # LLM处理片段
        processed_fragments = process_text_fragments(retrieved_chunks, question)
        context = "\n\n".join(
            f"【资料片段 {i+1}】{fragment['content']}\n"
            f"（来源：{fragment['metadata'].get('source', '未知')} 第{fragment['metadata'].get('page', '?')}页）"
            for i, fragment in enumerate(processed_fragments)
        )
        prompt = f"""基于以下课程资料：\n{context}\n\n请严格根据资料回答：{question}\n注意：\n1.如果涉及数学公式用$...$或$$...$$表示\n2.每个结论需标注来源编号如【1】"""
        
        # 准备sources，确保包含所有metadata包括start_time和end_time
        sources_data = []
        for fragment in processed_fragments:
            meta = fragment.get('metadata', {})
            sources_data.append({
                "content": fragment['content'],
                "metadata": {
                    "source": meta.get('source'),
                    "page": meta.get('page'),
                    "file_path": meta.get('file_path'),
                    "start_time": meta.get('start_time'),  # 确保包含时间戳
                    "end_time": meta.get('end_time')        # 确保包含时间戳
                }
            })
        
        return {
            "answer": get_completion(prompt),
            "sources": sources_data
        }
    except Exception as e:
        print(f"混合检索失败: {str(e)}")
        return {
            "answer": "抱歉，检索相关文档时出现错误，请稍后重试。",
            "sources": []
        }
