import os  
import json  
import asyncio  
import re
import time
from typing import AsyncGenerator, List, Dict, Any, Optional
from .pageindex import utils  
from .llm_client import completion_stream_async, get_default_model
  
class MultiDocumentSearcher:  
    """多文档搜索器，加载预生成的JSON结构文件"""  
      
    def __init__(self, json_dir: str, model: Optional[str] = None):
        self.json_dir = json_dir  
        self.model = model or get_default_model()
        self.documents = {}  # {doc_id: {"tree": tree, "metadata": metadata}}  

    @staticmethod
    def _debug(trace_id: str, message: str):
        print(f"[QA-DEBUG][{trace_id}][{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}")

    @staticmethod
    def _iter_nodes(tree):
        if isinstance(tree, dict):
            yield tree
            for child in tree.get('nodes', []) or []:
                yield from MultiDocumentSearcher._iter_nodes(child)
        elif isinstance(tree, list):
            for item in tree:
                yield from MultiDocumentSearcher._iter_nodes(item)

    @staticmethod
    def _detect_doc_type(tree, doc_name: str) -> str:
        lower_name = (doc_name or '').lower()
        if lower_name.endswith(('.mp3', '.wav', '.m4a', '.aac', '.ogg', '.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv')):
            return 'media'
        if lower_name.endswith(('.pdf', '.md', '.markdown', '.doc', '.docx', '.ppt', '.pptx')):
            return 'pdf'

        for node in MultiDocumentSearcher._iter_nodes(tree):
            if node.get('start_time') is not None or node.get('end_time') is not None:
                return 'media'
        return 'pdf'

    @staticmethod
    def _format_time(seconds):
        if seconds is None:
            return "?"
        sec = int(round(float(seconds)))
        hours = sec // 3600
        minutes = (sec % 3600) // 60
        secs = sec % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"

    @staticmethod
    def _extract_page_segments(text: str) -> List[Dict[str, Any]]:
        """从带 <physical_index_x> 标签的文本中提取页级片段"""
        if not text:
            return []

        pattern = re.compile(r'<physical_index_(\d+)>\s*(.*?)\s*<physical_index_\1>', re.DOTALL)
        segments = []
        for match in pattern.finditer(text):
            page_num = int(match.group(1))
            page_text = match.group(2).strip()
            if page_text:
                segments.append({
                    "page": page_num,
                    "text": page_text
                })
        return segments
          
    def load_documents(self):  
        """从目录加载所有JSON结构文件"""  
        if not os.path.exists(self.json_dir):  
            raise FileNotFoundError(f"目录不存在: {self.json_dir}")  
              
        json_files = [f for f in os.listdir(self.json_dir) if f.endswith('_structure.json')]  
          
        for json_file in json_files:  
            file_path = os.path.join(self.json_dir, json_file)  
            doc_name = json_file.replace('_structure.json', '')  
              
            with open(file_path, 'r', encoding='utf-8') as f:  
                data = json.load(f)  
              
            # 生成文档ID  
            doc_id = f"doc_{len(self.documents):04d}"  
              
            self.documents[doc_id] = {  
                "tree": data["structure"],  
                "metadata": {  
                    "name": data.get("doc_name", doc_name),  
                    "description": data.get("doc_description", ""),  
                    "file_path": file_path,
                    "doc_type": self._detect_doc_type(data.get("structure", []), data.get("doc_name", doc_name))
                }  
            }  
              
        print(f"已加载 {len(self.documents)} 个文档")  
      
    async def search_documents(self, query: str, top_k: int = 5, trace_id: str = "-", max_parallel_docs: int = 3) -> List[Dict[str, Any]]:
        """在所有文档中搜索并返回命中文档（不生成最终答案）"""
        started_at = time.perf_counter()
        self._debug(trace_id, f"search start, total_docs={len(self.documents)}, top_k={top_k}, query_len={len(str(query or ''))}")
        all_results = []  

        # 在每个文档中并发搜索（限制并发度）
        semaphore = asyncio.Semaphore(max(1, int(max_parallel_docs or 1)))
        docs = list(self.documents.items())

        async def _search_doc(index: int, total: int, doc_id: str, doc_data: Dict):
            doc_name = doc_data.get("metadata", {}).get("name", doc_id)
            self._debug(trace_id, f"doc_search start [{index}/{total}] doc_id={doc_id}, doc_name={doc_name}")
            per_doc_started = time.perf_counter()
            async with semaphore:
                result = await self._search_single_document(doc_id, doc_data, query, trace_id=trace_id)
            self._debug(trace_id, f"doc_search done [{index}/{total}] doc_id={doc_id}, nodes={len(result.get('nodes', []))}, elapsed={time.perf_counter() - per_doc_started:.2f}s")
            return doc_id, doc_data, result

        tasks = [
            _search_doc(index, len(docs), doc_id, doc_data)
            for index, (doc_id, doc_data) in enumerate(docs, start=1)
        ]
        search_outputs = await asyncio.gather(*tasks)

        for doc_id, doc_data, result in search_outputs:
            if result["nodes"]:
                all_results.append({
                    "doc_id": doc_id,
                    "doc_name": doc_data["metadata"]["name"],
                    "doc_description": doc_data["metadata"]["description"],
                    "results": result
                })
          
        # 按相关节点数量排序  
        all_results.sort(key=lambda x: len(x["results"]["nodes"]), reverse=True)  
          
        self._debug(trace_id, f"search finished, total_elapsed={time.perf_counter() - started_at:.2f}s")
        return all_results[:top_k]

    @staticmethod
    def _build_answer_prompt(query: str, doc_results: List[Dict]) -> str:
        if not doc_results:
            return ""

        all_context = []
        for doc_result in doc_results:
            doc_name = doc_result["doc_name"]
            nodes = doc_result["results"]["nodes"]
            doc_type = doc_result.get("results", {}).get("nodes", [{}])[0].get("doc_type", "pdf") if nodes else "pdf"

            context_parts = [f"\n=== 文档: {doc_name} ==="]
            for node in nodes:
                context_parts.append(f"章节: {node['title']}")
                if doc_type == 'media':
                    context_parts.append(f"时间段: {node.get('time_range', '')}")
                else:
                    context_parts.append(f"位置: {node['page_range']}")

                page_segments = node.get("page_segments", [])
                if doc_type != 'media' and page_segments:
                    for seg in page_segments:
                        snippet = seg["text"][:400].replace("\n", " ")
                        context_parts.append(f"页码 p{seg['page']}: {snippet}...")
                else:
                    context_parts.append(f"内容: {node['text'][:500]}...")

            all_context.append("\n".join(context_parts))

        combined_context = "\n".join(all_context)
        return f"""  
    基于以下多个文档的内容回答问题。请提供准确、全面的答案，并说明信息来源。  
  
    问题: {query}  
  
    文档内容:  
    {combined_context}  
  
    要求：
    1) PDF/文档类型优先引用“页码 pX”证据，格式示例：[文档名 p23]。
    2) 媒体类型必须引用时间段，格式示例：[文档名 00:10-00:35]。
    3) 如果PDF只能定位到范围而无页级标签，才可使用范围引用：[文档名 12-15]。
    4) 引用必须使用英文方括号'[]'，不能是中文括号'【】'。
    """

    async def stream_comprehensive_answer(self, query: str, doc_results: List[Dict], trace_id: str = "-") -> AsyncGenerator[str, None]:
        if not doc_results:
            yield "未找到相关信息。"
            return

        answer_prompt = self._build_answer_prompt(query, doc_results)
        self._debug(trace_id, f"llm final_answer stream start, context_docs={len(doc_results)}")
        llm_started = time.perf_counter()
        total_chars = 0
        async for chunk in completion_stream_async(prompt=answer_prompt, model=self.model):
            total_chars += len(chunk)
            yield chunk
        self._debug(trace_id, f"llm final_answer stream done, elapsed={time.perf_counter() - llm_started:.2f}s, chars={total_chars}")

    async def search(self, query: str, top_k: int = 5, trace_id: str = "-", max_parallel_docs: int = 3) -> Dict[str, Any]:  
        """在所有文档中搜索查询"""  
        all_results = await self.search_documents(query, top_k=top_k, trace_id=trace_id, max_parallel_docs=max_parallel_docs)

        self._debug(trace_id, f"compose answer start, matched_docs={len(all_results)}")
        answer_started = time.perf_counter()
        final_answer = await self._generate_comprehensive_answer(query, all_results, trace_id=trace_id)
        self._debug(trace_id, f"compose answer done, elapsed={time.perf_counter() - answer_started:.2f}s")
          
        return {  
            "query": query,  
            "answer": final_answer,  
            "documents": all_results,  
            "total_docs_searched": len(self.documents)  
        }  
      
    async def _search_single_document(self, doc_id: str, doc_data: Dict, query: str, trace_id: str = "-") -> Dict[str, Any]:  
        """在单个文档中搜索"""  
        tree = doc_data["tree"]  
        doc_type = doc_data.get("metadata", {}).get("doc_type", "pdf")
          
        # 移除文本字段以减少token数量  
        tree_without_text = utils.remove_fields(tree.copy(), fields=['text'])  
          
        # 构建搜索提示  
        search_prompt = f"""  
You are given a question and a tree structure of a document.  
Each node contains a node id, node title, and a corresponding summary.  
Your task is to find all nodes that are likely to contain the answer to the question.  
  
Question: {query}  
  
Document tree structure:  
{json.dumps(tree_without_text, indent=2)}  
  
Please reply in the following JSON format:  
{{  
    "thinking": "<Your thinking process on which nodes are relevant to the question>",  
    "node_list": ["node_id_1", "node_id_2", ..., "node_id_n"]  
}}  
Directly return the final JSON structure. Do not output anything else.  
"""  
          
        # 调用LLM进行搜索  
        self._debug(trace_id, f"llm tree_search request start doc_id={doc_id}, doc_type={doc_type}")
        llm_started = time.perf_counter()
        tree_search_result = await utils.ChatGPT_API_async(self.model, search_prompt)  
        self._debug(trace_id, f"llm tree_search response done doc_id={doc_id}, elapsed={time.perf_counter() - llm_started:.2f}s, response_len={len(str(tree_search_result or ''))}")
        tree_search_json = utils.extract_json(tree_search_result)  
          
        # 创建节点映射  
        node_map = utils.create_node_mapping(tree)  
          
        # 提取相关节点内容  
        relevant_nodes = []  
        node_list = tree_search_json.get("node_list", []) if isinstance(tree_search_json, dict) else []
        for node_id in node_list:  
            if node_id in node_map:  
                node_info = node_map[node_id]  
                start_time = node_info["node"].get("start_time")
                end_time = node_info["node"].get("end_time")
                relevant_nodes.append({  
                    "node_id": node_id,  
                    "title": node_info["node"]["title"],  
                    "page_range": f"{node_info['start_index']}-{node_info['end_index']}" if 'start_index' in node_info else f"line {node_info.get('line_num', 'N/A')}",  
                    "summary": node_info["node"].get("summary", ""),  
                    "text": node_info["node"].get("text", ""),
                    "start_time": start_time,
                    "end_time": end_time,
                    "time_range": f"{self._format_time(start_time)}-{self._format_time(end_time)}" if start_time is not None or end_time is not None else "",
                    "doc_type": doc_type,
                    "page_segments": self._extract_page_segments(node_info["node"].get("text", ""))
                })  
          
        return {  
            "thinking": tree_search_json.get("thinking", ""),  
            "nodes": relevant_nodes  
        }  
      
    async def _generate_comprehensive_answer(self, query: str, doc_results: List[Dict], trace_id: str = "-") -> str:  
        """基于多个文档的搜索结果生成综合答案"""  
        if not doc_results:  
            return "未找到相关信息。"  
        answer_prompt = self._build_answer_prompt(query, doc_results)
          
        self._debug(trace_id, f"llm final_answer request start, context_docs={len(doc_results)}")
        llm_started = time.perf_counter()
        answer = await utils.ChatGPT_API_async(self.model, answer_prompt)  
        self._debug(trace_id, f"llm final_answer response done, elapsed={time.perf_counter() - llm_started:.2f}s, answer_len={len(str(answer or ''))}")
        return answer  
      
    def list_documents(self) -> List[Dict[str, str]]:  
        """列出所有已加载的文档"""  
        return [  
            {  
                "doc_id": doc_id,  
                "name": data["metadata"]["name"],  
                "description": data["metadata"]["description"]  
            }  
            for doc_id, data in self.documents.items()  
        ]  
  
# 使用示例  
async def main():  
    # 初始化搜索器，指定JSON文件目录  
    json_dir = "./results"  # 存放structure JSON文件的目录  
    searcher = MultiDocumentSearcher(json_dir=json_dir, model=get_default_model())
      
    # 加载所有文档  
    searcher.load_documents()  
      
    # 列出已加载的文档  
    print("\n已加载的文档:")  
    for doc in searcher.list_documents():  
        print(f"- {doc['doc_id']}: {doc['name']}")  
      
    # 执行搜索  
    queries = [  
        "什么是机器学习？",  
        "深度学习的应用有哪些？",  
        "模型训练的最佳实践是什么？"  
    ]  
      
    for query in queries:  
        print(f"\n搜索: {query}")  
        print("=" * 50)  
          
        result = await searcher.search(query)  
          
        print(f"答案: {result['answer']}")  
        print(f"\n找到 {len(result['documents'])} 个相关文档:")  
          
        for doc_result in result['documents']:  
            print(f"\n文档: {doc_result['doc_name']}")  
            print(f"相关节点数: {len(doc_result['results']['nodes'])}")  
            for node in doc_result['results']['nodes'][:3]:  # 只显示前3个节点  
                print(f"  - {node['title']} (位置 {node['page_range']})")  
  
if __name__ == "__main__":  
    asyncio.run(main())