"""
将文档结构JSON转换为思维导图数据
"""
import json
import os
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional
from .pageindex.page_index import page_index
from .resources import get_vector_db
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=True)

TREES_DIR = os.path.join(os.path.dirname(__file__), 'db', 'trees')


def ensure_trees_dir():
    """确保trees目录存在"""
    os.makedirs(TREES_DIR, exist_ok=True)


def get_structure_file_path(filename: str) -> str:
    """获取结构文件路径"""
    base_name = os.path.splitext(filename)[0]
    return os.path.join(TREES_DIR, f"{base_name}_structure.json")


def load_structure_json(filename: str) -> Optional[Dict]:
    """加载已有的结构JSON文件"""
    structure_file = get_structure_file_path(filename)
    if os.path.exists(structure_file):
        try:
            with open(structure_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"加载结构文件失败: {e}")
            return None
    return None


def generate_structure_json(file_path: str, model: Optional[str] = None) -> Optional[Dict]:
    """
    生成文档结构JSON文件
    使用与run_pageindex.py相同的逻辑
    """
    try:
        ensure_trees_dir()
        
        # 获取文件扩展名
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # 如果是PDF，使用page_index处理
        if file_ext == '.pdf':
            print(f"开始处理PDF文件: {file_path}")
            result = page_index(
                file_path,
                model=model,
                if_add_node_id='yes',
                if_add_node_summary='yes',
                if_add_doc_description='no',
                if_add_node_text='no'
            )
            
            # 检查是否返回了协程，如果是则需要在事件循环中运行
            if asyncio.iscoroutine(result):
                # 如果已经在事件循环中，使用 run_until_complete 不会起作用
                # 应该创建一个新的事件循环或使用其他方式
                # 但这种情况不应该出现在同步函数中
                # 为了兼容，我们在这里用try-except处理
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # 如果事件循环正在运行，无法使用 run_until_complete
                        # 这需要在调用者处使用async处理
                        raise RuntimeError("Cannot wait for coroutine in running event loop. Use async function instead.")
                    else:
                        structure_data = loop.run_until_complete(result)
                except RuntimeError as e:
                    if "running event loop" in str(e):
                        raise RuntimeError("generate_structure_json must be called from async context when page_index returns coroutine")
                    raise
            else:
                structure_data = result
            
            # 保存结构文件
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            structure_file = os.path.join(TREES_DIR, f"{base_name}_structure.json")
            os.makedirs(os.path.dirname(structure_file), exist_ok=True)
            
            with open(structure_file, 'w', encoding='utf-8') as f:
                json.dump(structure_data, f, ensure_ascii=False, indent=2)
            
            print(f"结构文件已保存: {structure_file}")
            return structure_data
        
        # 其他格式暂不支持思维导图
        print(f"暂不支持{file_ext}格式的思维导图生成")
        return None
        
    except Exception as e:
        error_msg = str(e)
        
        # Check for model errors
        if "模型" in error_msg and "不存在" in error_msg:
            print(f"❌ 模型配置错误: {error_msg}")
            print("请检查 .env 文件中的 DEEPSEEK_MODEL 环境变量设置")
        elif "Model Not Exist" in error_msg:
            print(f"❌ 模型不存在: {error_msg}")
            print("请确保使用的模型名称正确")
        else:
            print(f"❌ 生成结构失败: {e}")
        
        import traceback
        traceback.print_exc()
        return None


async def generate_structure_json_async(file_path: str, model: Optional[str] = None) -> Optional[Dict]:
    """
    异步版本的生成文档结构JSON文件
    """
    try:
        ensure_trees_dir()
        
        # 获取文件扩展名
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # 如果是PDF，使用page_index处理
        if file_ext == '.pdf':
            print(f"开始处理PDF文件: {file_path}")
            result = page_index(
                file_path,
                model=model,
                if_add_node_id='yes',
                if_add_node_summary='yes',
                if_add_doc_description='no',
                if_add_node_text='no'
            )
            
            # 如果返回了协程，等待它
            if asyncio.iscoroutine(result):
                structure_data = await result
            else:
                structure_data = result
            
            # 保存结构文件
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            structure_file = os.path.join(TREES_DIR, f"{base_name}_structure.json")
            os.makedirs(os.path.dirname(structure_file), exist_ok=True)
            
            with open(structure_file, 'w', encoding='utf-8') as f:
                json.dump(structure_data, f, ensure_ascii=False, indent=2)
            
            print(f"结构文件已保存: {structure_file}")
            return structure_data
        
        # 其他格式暂不支持思维导图
        print(f"暂不支持{file_ext}格式的思维导图生成")
        return None
        
    except Exception as e:
        error_msg = str(e)
        
        # Check for model errors
        if "模型" in error_msg and "不存在" in error_msg:
            print(f"❌ 模型配置错误: {error_msg}")
            print("请检查 .env 文件中的 DEEPSEEK_MODEL 环境变量设置")
        elif "Model Not Exist" in error_msg:
            print(f"❌ 模型不存在: {error_msg}")
            print("请确保使用的模型名称正确")
        else:
            print(f"❌ 生成结构失败 (异步): {e}")
        
        import traceback
        traceback.print_exc()
        return None


def convert_structure_to_mindmap(structure: List[Dict]) -> Dict[str, Any]:
    """
    将文档结构转换为思维导图格式
    
    思维导图格式：
    {
      id: 唯一标识,
      name: 节点标题,
      children: [子节点],
      data: {
        summary: 摘要,
        pageRange: 页码范围
      }
    }
    """
    
    def convert_node(node: Dict, parent_id: str = "root") -> Dict:
        """递归转换单个节点"""
        node_id = node.get('node_id', f"node_{hash(str(node))}")
        
        # 获取页码范围
        start_index = node.get('start_index')
        end_index = node.get('end_index')
        page_range = ""
        if start_index and end_index:
            if start_index == end_index:
                page_range = f"第{start_index}页"
            else:
                page_range = f"第{start_index}-{end_index}页"
        
        converted = {
            'id': node_id,
            'name': node.get('title', '未命名'),
            'data': {
                'summary': node.get('summary', ''),
                'pageRange': page_range,
                'nodeId': node_id
            }
        }
        
        # 处理子节点
        if 'nodes' in node and node['nodes']:
            converted['children'] = [
                convert_node(child, node_id) 
                for child in node['nodes']
            ]
        
        return converted
    
    # 创建根节点
    root_children = [convert_node(node) for node in structure]
    
    return {
        'id': 'root',
        'name': '文档结构',
        'children': root_children
    }


def get_mindmap_data(filename: str, file_path: str, model: Optional[str] = None, force_regenerate: bool = False) -> Optional[Dict]:
    """
    获取思维导图数据
    先尝试加载已有的结构文件，如果不存在则生成
    """
    # 如果需要强制重新生成
    if force_regenerate:
        print(f"强制重新生成结构文件: {filename}")
        structure = generate_structure_json(file_path, model)
    else:
        # 先尝试加载已有的结构
        structure = load_structure_json(filename)
        if structure is None:
            print(f"未找到已有的结构文件，开始生成: {filename}")
            structure = generate_structure_json(file_path, model)
    
    if structure is None:
        return None
    
    # 提取structure字段
    if isinstance(structure, dict) and 'structure' in structure:
        structure_list = structure['structure']
    else:
        structure_list = structure
    
    # 转换为思维导图格式
    mindmap = convert_structure_to_mindmap(structure_list)
    
    return mindmap


async def get_mindmap_data_async(filename: str, file_path: str, model: Optional[str] = None, force_regenerate: bool = False) -> Optional[Dict]:
    """
    获取思维导图数据的异步版本
    先尝试加载已有的结构文件，如果不存在则生成
    """
    # 如果需要强制重新生成
    if force_regenerate:
        print(f"强制重新生成结构文件: {filename}")
        structure = await generate_structure_json_async(file_path, model)
    else:
        # 先尝试加载已有的结构
        structure = load_structure_json(filename)
        if structure is None:
            print(f"未找到已有的结构文件，开始生成: {filename}")
            structure = await generate_structure_json_async(file_path, model)
    
    if structure is None:
        return None
    
    # 提取structure字段
    if isinstance(structure, dict) and 'structure' in structure:
        structure_list = structure['structure']
    else:
        structure_list = structure
    
    # 转换为思维导图格式
    mindmap = convert_structure_to_mindmap(structure_list)
    
    return mindmap


def search_in_mindmap(mindmap: Dict, keyword: str) -> List[Dict]:
    """
    在思维导图中搜索关键词
    """
    results = []
    
    def search_node(node: Dict):
        # 检查当前节点
        if keyword.lower() in node['name'].lower():
            results.append({
                'id': node['id'],
                'name': node['name'],
                'type': 'title'
            })
        
        # 检查摘要
        if 'data' in node and keyword.lower() in node['data'].get('summary', '').lower():
            results.append({
                'id': node['id'],
                'name': node['name'],
                'type': 'summary'
            })
        
        # 递归搜索子节点
        if 'children' in node:
            for child in node['children']:
                search_node(child)
    
    if 'children' in mindmap:
        for child in mindmap['children']:
            search_node(child)
    
    return results
