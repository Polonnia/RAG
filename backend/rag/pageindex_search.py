import os  
import json  
import asyncio  
from typing import List, Dict, Any  
import pageindex.utils as utils  
  
class MultiDocumentSearcher:  
    """多文档搜索器，加载预生成的JSON结构文件"""  
      
    def __init__(self, json_dir: str, model: str = "gpt-4o-2024-11-20"):  
        self.json_dir = json_dir  
        self.model = model  
        self.documents = {}  # {doc_id: {"tree": tree, "metadata": metadata}}  
          
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
                    "file_path": file_path  
                }  
            }  
              
        print(f"已加载 {len(self.documents)} 个文档")  
      
    async def search(self, query: str, top_k: int = 5) -> Dict[str, Any]:  
        """在所有文档中搜索查询"""  
        all_results = []  
          
        # 在每个文档中搜索  
        for doc_id, doc_data in self.documents.items():  
            result = await self._search_single_document(doc_id, doc_data, query)  
            if result["nodes"]:  
                all_results.append({  
                    "doc_id": doc_id,  
                    "doc_name": doc_data["metadata"]["name"],  
                    "doc_description": doc_data["metadata"]["description"],  
                    "results": result  
                })  
          
        # 按相关节点数量排序  
        all_results.sort(key=lambda x: len(x["results"]["nodes"]), reverse=True)  
          
        # 生成综合答案  
        final_answer = await self._generate_comprehensive_answer(query, all_results[:top_k])  
          
        return {  
            "query": query,  
            "answer": final_answer,  
            "documents": all_results[:top_k],  
            "total_docs_searched": len(self.documents)  
        }  
      
    async def _search_single_document(self, doc_id: str, doc_data: Dict, query: str) -> Dict[str, Any]:  
        """在单个文档中搜索"""  
        tree = doc_data["tree"]  
          
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
        tree_search_result = await utils.ChatGPT_API_async(self.model, search_prompt)  
        tree_search_json = json.loads(tree_search_result)  
          
        # 创建节点映射  
        node_map = utils.create_node_mapping(tree)  
          
        # 提取相关节点内容  
        relevant_nodes = []  
        for node_id in tree_search_json["node_list"]:  
            if node_id in node_map:  
                node_info = node_map[node_id]  
                relevant_nodes.append({  
                    "node_id": node_id,  
                    "title": node_info["node"]["title"],  
                    "page_range": f"{node_info['start_index']}-{node_info['end_index']}" if 'start_index' in node_info else f"line {node_info.get('line_num', 'N/A')}",  
                    "summary": node_info["node"].get("summary", ""),  
                    "text": node_info["node"].get("text", "")  
                })  
          
        return {  
            "thinking": tree_search_json["thinking"],  
            "nodes": relevant_nodes  
        }  
      
    async def _generate_comprehensive_answer(self, query: str, doc_results: List[Dict]) -> str:  
        """基于多个文档的搜索结果生成综合答案"""  
        if not doc_results:  
            return "未找到相关信息。"  
          
        # 收集所有相关内容  
        all_context = []  
        for doc_result in doc_results:  
            doc_name = doc_result["doc_name"]  
            nodes = doc_result["results"]["nodes"]  
              
            context_parts = [f"\n=== 文档: {doc_name} ==="]  
            for node in nodes:  
                context_parts.append(f"章节: {node['title']}")  
                context_parts.append(f"位置: {node['page_range']}")  
                context_parts.append(f"内容: {node['text'][:500]}...")  
              
            all_context.append("\n".join(context_parts))  
          
        combined_context = "\n".join(all_context)  
          
        # 生成最终答案  
        answer_prompt = f"""  
基于以下多个文档的内容回答问题。请提供准确、全面的答案，并说明信息来源。  
  
问题: {query}  
  
文档内容:  
{combined_context}  
  
请提供清晰的答案，并引用具体的文档和章节。  
"""  
          
        answer = await utils.ChatGPT_API_async(self.model, answer_prompt)  
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
    searcher = MultiDocumentSearcher(json_dir=json_dir, model="gpt-4o-2024-11-20")  
      
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