"""
将文档结构JSON转换为思维导图数据
"""
import json
import os
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional, cast
from .knowledge_manager import _process_with_pageindex
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
        print(f"开始处理文件并生成结构: {file_path}")
        structure_data = _process_with_pageindex(file_path)
        if asyncio.iscoroutine(structure_data):
            structure_data = asyncio.run(structure_data)
        if structure_data is None:
            return None
        structure_data = cast(Dict, structure_data)

        # 保存结构文件（与知识管理模块保持同一命名规则）
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        structure_file = os.path.join(TREES_DIR, f"{base_name}_structure.json")
        os.makedirs(os.path.dirname(structure_file), exist_ok=True)

        with open(structure_file, 'w', encoding='utf-8') as f:
            json.dump(structure_data, f, ensure_ascii=False, indent=2)

        print(f"结构文件已保存: {structure_file}")
        return structure_data
        
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
        print(f"开始处理文件并生成结构(异步): {file_path}")
        structure_data = await asyncio.to_thread(_process_with_pageindex, file_path)
        if asyncio.iscoroutine(structure_data):
            structure_data = await structure_data
        if structure_data is None:
            return None
        structure_data = cast(Dict, structure_data)

        # 保存结构文件（与知识管理模块保持同一命名规则）
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        structure_file = os.path.join(TREES_DIR, f"{base_name}_structure.json")
        os.makedirs(os.path.dirname(structure_file), exist_ok=True)

        with open(structure_file, 'w', encoding='utf-8') as f:
            json.dump(structure_data, f, ensure_ascii=False, indent=2)

        print(f"结构文件已保存: {structure_file}")
        return structure_data
        
    except Exception as e:
        error_msg = str(e)
        
        # Check for model errors
        if "模型" in error_msg and "不存在" in error_msg:
            print(f"模型配置错误: {error_msg}")
            print("请检查 .env 文件中的 DEEPSEEK_MODEL 环境变量设置")
        elif "Model Not Exist" in error_msg:
            print(f"模型不存在: {error_msg}")
            print("请确保使用的模型名称正确")
        else:
            print(f"生成结构失败 (异步): {e}")
        
        import traceback
        traceback.print_exc()
        return None


def _normalize_structure_list(structure: Any) -> List[Dict]:
    """将多种结构结果统一为节点列表。"""
    if structure is None:
        return []

    if isinstance(structure, list):
        return structure

    if isinstance(structure, dict):
        if isinstance(structure.get('structure'), list):
            return structure['structure']
        if isinstance(structure.get('nodes'), list):
            return structure['nodes']
        if 'title' in structure:
            return [structure]

    return []


def convert_structure_to_mindmap(structure: Any) -> Dict[str, Any]:
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
    
    def _format_seconds(seconds: float) -> str:
        total = int(round(max(0.0, float(seconds))))
        hours = total // 3600
        minutes = (total % 3600) // 60
        secs = total % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"

    def _build_time_range(node: Dict) -> str:
        start_time = node.get('start_time')
        end_time = node.get('end_time')
        if start_time is None or end_time is None:
            return ""
        try:
            return f"{_format_seconds(float(start_time))}-{_format_seconds(float(end_time))}"
        except Exception:
            return ""

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

        # 媒体类结构使用时间范围（例如 00:15-01:23）
        time_range = _build_time_range(node)
        display_range = page_range or time_range
        
        converted = {
            'id': node_id,
            'name': node.get('title', '未命名'),
            'data': {
                'summary': node.get('summary', ''),
                'text': node.get('text', ''),
                'pageRange': display_range,
                'timeRange': time_range,
                'startTime': node.get('start_time'),
                'endTime': node.get('end_time'),
                'startIndex': start_index,
                'endIndex': end_index,
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
    normalized_structure = _normalize_structure_list(structure)
    root_children = [convert_node(node) for node in normalized_structure]
    
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
    
    # 转换为思维导图格式
    mindmap = convert_structure_to_mindmap(structure)
    
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
    
    # 转换为思维导图格式
    mindmap = convert_structure_to_mindmap(structure)
    
    return mindmap


def search_in_mindmap(mindmap: Dict, keyword: str) -> List[Dict]:
    """
    在思维导图中搜索关键词
    """
    results = []
    seen = set()

    def _format_seconds(seconds: float) -> str:
        total = int(round(max(0.0, float(seconds))))
        hours = total // 3600
        minutes = (total % 3600) // 60
        secs = total % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"

    def _extract_precise_position(data: Dict) -> Dict:
        start_index = data.get('startIndex')
        start_time = data.get('startTime')

        precise_page = None
        if isinstance(start_index, int) and start_index > 0:
            precise_page = start_index

        precise_timestamp = None
        try:
            if start_time is not None:
                precise_timestamp = _format_seconds(float(start_time))
        except (TypeError, ValueError):
            precise_timestamp = None

        position_label = ''
        if precise_page is not None:
            position_label = f"第{precise_page}页"
        elif precise_timestamp:
            position_label = precise_timestamp

        return {
            'page': precise_page,
            'timestamp': precise_timestamp,
            'position': position_label,
        }

    def add_result(node: Dict, match_type: str):
        node_id = node.get('id')
        if not node_id:
            return
        if node_id in seen:
            return
        seen.add(node_id)

        data = node.get('data') or {}
        precise = _extract_precise_position(data)
        results.append({
            'id': node_id,
            'name': node.get('name', ''),
            'type': match_type,
            'pageRange': data.get('pageRange', ''),
            'timeRange': data.get('timeRange', ''),
            'page': precise['page'],
            'timestamp': precise['timestamp'],
            'position': precise['position'],
        })
    
    def search_node(node: Dict):
        children = node.get('children') or []
        is_leaf = not isinstance(children, list) or len(children) == 0

        # 只在叶子节点中搜索，避免父节点重复命中
        if not is_leaf:
            for child in children:
                search_node(child)
            return

        # 检查当前叶子节点
        if keyword.lower() in node['name'].lower():
            add_result(node, 'title')
        
        # 检查摘要
        if 'data' in node and keyword.lower() in node['data'].get('summary', '').lower():
            add_result(node, 'summary')

        if 'data' in node and keyword.lower() in node['data'].get('text', '').lower():
            add_result(node, 'text')
        
        # 叶子节点到此结束
    
    if 'children' in mindmap:
        for child in mindmap['children']:
            search_node(child)
    
    return results
