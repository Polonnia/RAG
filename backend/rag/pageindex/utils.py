import tiktoken
import logging
import os
from datetime import datetime
import time
import json
import re
import PyPDF2
import copy
import asyncio
import pymupdf
from io import BytesIO
from dotenv import load_dotenv
load_dotenv()
import logging
import yaml
from pathlib import Path
from types import SimpleNamespace as config
from dotenv import load_dotenv
try:
    from ..llm_client import completion_text, completion_text_async, completion_with_finish_reason, get_default_model
except ImportError:
    from llm_client import completion_text, completion_text_async, completion_with_finish_reason, get_default_model

load_dotenv()
API_KEY = os.getenv("DEEPSEEK_API_KEY")


def _get_encoding(model_name):
    try:
        return tiktoken.encoding_for_model(model_name)
    except Exception:
        return tiktoken.get_encoding("cl100k_base")

def count_tokens(text, model="deepseek-chat"):
    if not text:
        return 0
    enc = _get_encoding(model)
    tokens = enc.encode(text)
    return len(tokens)

def ChatGPT_API_with_finish_reason(model, prompt, api_key=API_KEY, chat_history=None):
    try:
        response, finish_reason = completion_with_finish_reason(
            prompt=prompt,
            model=model or get_default_model(),
            chat_history=chat_history,
            temperature=0,
            max_retries=10,
        )
        return response, finish_reason
    except Exception as e:
        print('************* Retrying *************')
        logging.error(f"Error: {e}")
        logging.error('Max retries reached for prompt: ' + prompt)
        return "", "error"



def ChatGPT_API(model, prompt, api_key=API_KEY, chat_history=None):
    try:
        return completion_text(
            prompt=prompt,
            model=model or get_default_model(),
            chat_history=chat_history,
            temperature=0,
            max_retries=10,
        )
    except Exception as e:
        print('************* Retrying *************')
        logging.error(f"Error: {e}")
        logging.error('Max retries reached for prompt: ' + prompt)
        return "Error"
            

async def ChatGPT_API_async(model, prompt, api_key=API_KEY):
    try:
        return await completion_text_async(
            prompt=prompt,
            model=model or get_default_model(),
            temperature=0,
            max_retries=10,
        )
    except Exception as e:
        print('************* Retrying *************')
        logging.error(f"Error: {e}")
        logging.error('Max retries reached for prompt: ' + prompt)
        return "Error"
            
            
def get_json_content(response):
    start_idx = response.find("```json")
    if start_idx != -1:
        start_idx += 7
        response = response[start_idx:]
        
    end_idx = response.rfind("```")
    if end_idx != -1:
        response = response[:end_idx]
    
    json_content = response.strip()
    return json_content
         

def extract_json(content):
    try:
        # First, try to extract JSON enclosed within ```json and ```
        start_idx = content.find("```json")
        if start_idx != -1:
            start_idx += 7  # Adjust index to start after the delimiter
            end_idx = content.rfind("```")
            json_content = content[start_idx:end_idx].strip()
        else:
            # If no delimiters, assume entire content could be JSON
            json_content = content.strip()

        # Clean up common issues that might cause parsing errors
        json_content = json_content.replace('None', 'null')  # Replace Python None with JSON null
        json_content = json_content.replace('\n', ' ').replace('\r', ' ')  # Remove newlines
        json_content = ' '.join(json_content.split())  # Normalize whitespace

        # Attempt to parse and return the JSON object
        return json.loads(json_content)
    except json.JSONDecodeError as e:
        logging.error(f"Failed to extract JSON: {e}")
        # Try to clean up the content further if initial parsing fails
        try:
            # Remove any trailing commas before closing brackets/braces
            json_content = json_content.replace(',]', ']').replace(',}', '}')
            return json.loads(json_content)
        except:
            logging.error("Failed to parse JSON even after cleanup")
            return {}
    except Exception as e:
        logging.error(f"Unexpected error while extracting JSON: {e}")
        return {}

def write_node_id(data, node_id=0):
    if isinstance(data, dict):
        data['node_id'] = str(node_id).zfill(4)
        node_id += 1
        for key in list(data.keys()):
            if 'nodes' in key:
                node_id = write_node_id(data[key], node_id)
    elif isinstance(data, list):
        for index in range(len(data)):
            node_id = write_node_id(data[index], node_id)
    return node_id

def get_nodes(structure):
    if isinstance(structure, dict):
        structure_node = copy.deepcopy(structure)
        structure_node.pop('nodes', None)
        nodes = [structure_node]
        for key in list(structure.keys()):
            if 'nodes' in key:
                nodes.extend(get_nodes(structure[key]))
        return nodes
    elif isinstance(structure, list):
        nodes = []
        for item in structure:
            nodes.extend(get_nodes(item))
        return nodes
    
def structure_to_list(structure):
    if isinstance(structure, dict):
        nodes = []
        nodes.append(structure)
        if 'nodes' in structure:
            nodes.extend(structure_to_list(structure['nodes']))
        return nodes
    elif isinstance(structure, list):
        nodes = []
        for item in structure:
            nodes.extend(structure_to_list(item))
        return nodes

    
def get_leaf_nodes(structure):
    if isinstance(structure, dict):
        if not structure['nodes']:
            structure_node = copy.deepcopy(structure)
            structure_node.pop('nodes', None)
            return [structure_node]
        else:
            leaf_nodes = []
            for key in list(structure.keys()):
                if 'nodes' in key:
                    leaf_nodes.extend(get_leaf_nodes(structure[key]))
            return leaf_nodes
    elif isinstance(structure, list):
        leaf_nodes = []
        for item in structure:
            leaf_nodes.extend(get_leaf_nodes(item))
        return leaf_nodes

def is_leaf_node(data, node_id):
    # Helper function to find the node by its node_id
    def find_node(data, node_id):
        if isinstance(data, dict):
            if data.get('node_id') == node_id:
                return data
            for key in data.keys():
                if 'nodes' in key:
                    result = find_node(data[key], node_id)
                    if result:
                        return result
        elif isinstance(data, list):
            for item in data:
                result = find_node(item, node_id)
                if result:
                    return result
        return None

    # Find the node with the given node_id
    node = find_node(data, node_id)

    # Check if the node is a leaf node
    if node and not node.get('nodes'):
        return True
    return False

def get_last_node(structure):
    return structure[-1]


def extract_text_from_pdf(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    ###return text not list 
    text=""
    for page_num in range(len(pdf_reader.pages)):
        page = pdf_reader.pages[page_num]
        text+=page.extract_text()
    return text

def get_pdf_title(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    meta = pdf_reader.metadata
    title = meta.title if meta and meta.title else 'Untitled'
    return title

def get_text_of_pages(pdf_path, start_page, end_page, tag=True):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    text = ""
    for page_num in range(start_page-1, end_page):
        page = pdf_reader.pages[page_num]
        page_text = page.extract_text()
        if tag:
            text += f"<start_index_{page_num+1}>\n{page_text}\n<end_index_{page_num+1}>\n"
        else:
            text += page_text
    return text

def get_first_start_page_from_text(text):
    start_page = -1
    start_page_match = re.search(r'<start_index_(\d+)>', text)
    if start_page_match:
        start_page = int(start_page_match.group(1))
    return start_page

def get_last_start_page_from_text(text):
    start_page = -1
    # Find all matches of start_index tags
    start_page_matches = re.finditer(r'<start_index_(\d+)>', text)
    # Convert iterator to list and get the last match if any exist
    matches_list = list(start_page_matches)
    if matches_list:
        start_page = int(matches_list[-1].group(1))
    return start_page


def sanitize_filename(filename, replacement='-'):
    # In Linux, only '/' and '\0' (null) are invalid in filenames.
    # Null can't be represented in strings, so we only handle '/'.
    return filename.replace('/', replacement)

def get_pdf_name(pdf_path):
    # Extract PDF name
    if isinstance(pdf_path, str):
        pdf_name = os.path.basename(pdf_path)
    elif isinstance(pdf_path, BytesIO):
        pdf_reader = PyPDF2.PdfReader(pdf_path)
        meta = pdf_reader.metadata
        pdf_name = meta.title if meta and meta.title else 'Untitled'
        pdf_name = sanitize_filename(pdf_name)
    return pdf_name


class JsonLogger:
    def __init__(self, file_path):
        # Extract PDF name for logger name
        pdf_name = get_pdf_name(file_path)
            
        current_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.filename = f"{pdf_name}_{current_time}.json"
        os.makedirs("./logs", exist_ok=True)
        # Initialize empty list to store all messages
        self.log_data = []

    def log(self, level, message, **kwargs):
        if isinstance(message, dict):
            self.log_data.append(message)
        else:
            self.log_data.append({'message': message})
        # Add new message to the log data
        
        # Write entire log data to file
        with open(self._filepath(), "w") as f:
            json.dump(self.log_data, f, indent=2)

    def info(self, message, **kwargs):
        self.log("INFO", message, **kwargs)

    def error(self, message, **kwargs):
        self.log("ERROR", message, **kwargs)

    def debug(self, message, **kwargs):
        self.log("DEBUG", message, **kwargs)

    def exception(self, message, **kwargs):
        kwargs["exception"] = True
        self.log("ERROR", message, **kwargs)

    def _filepath(self):
        return os.path.join("logs", self.filename)
    



def list_to_tree(data):
    def get_parent_structure(structure):
        """Helper function to get the parent structure code"""
        if not structure:
            return None
        parts = str(structure).split('.')
        return '.'.join(parts[:-1]) if len(parts) > 1 else None
    
    # First pass: Create nodes and track parent-child relationships
    nodes = {}
    root_nodes = []
    
    for item in data:
        structure = item.get('structure')
        node = {
            'title': item.get('title'),
            'start_index': item.get('start_index'),
            'end_index': item.get('end_index'),
            'nodes': []
        }
        
        nodes[structure] = node
        
        # Find parent
        parent_structure = get_parent_structure(structure)
        
        if parent_structure:
            # Add as child to parent if parent exists
            if parent_structure in nodes:
                nodes[parent_structure]['nodes'].append(node)
            else:
                root_nodes.append(node)
        else:
            # No parent, this is a root node
            root_nodes.append(node)
    
    # Helper function to clean empty children arrays
    def clean_node(node):
        if not node['nodes']:
            del node['nodes']
        else:
            for child in node['nodes']:
                clean_node(child)
        return node
    
    # Clean and return the tree
    return [clean_node(node) for node in root_nodes]

def add_preface_if_needed(data):
    if not isinstance(data, list) or not data:
        return data

    if data[0]['physical_index'] is not None and data[0]['physical_index'] > 1:
        preface_node = {
            "structure": "0",
            "title": "Preface",
            "physical_index": 1,
        }
        data.insert(0, preface_node)
    return data


def extract_toc_from_pdf_outline(pdf_path):
    try:
        pdf_reader = PyPDF2.PdfReader(pdf_path)
        outlines = getattr(pdf_reader, 'outline', None)
    except Exception:
        return []

    if not outlines:
        return []

    toc_items = []
    level_counters = []

    def get_title(item):
        title = getattr(item, 'title', None)
        if title:
            return str(title).strip()

        if isinstance(item, dict):
            title = item.get('/Title') or item.get('Title')
            if title:
                return str(title).strip()
        return None

    def get_page_number(item):
        try:
            return int(pdf_reader.get_destination_page_number(item)) + 1
        except Exception:
            page_ref = None
            if isinstance(item, dict):
                page_ref = item.get('/Page') or item.get('Page')

            if page_ref is None:
                return None

            for idx, page_obj in enumerate(pdf_reader.pages):
                try:
                    if page_obj == page_ref:
                        return idx + 1
                    if getattr(page_obj, 'indirect_reference', None) == page_ref:
                        return idx + 1
                except Exception:
                    continue
            return None

    def walk(entries, level=1):
        for entry in entries:
            if isinstance(entry, list):
                walk(entry, level + 1)
                continue

            title = get_title(entry)
            if not title:
                continue

            while len(level_counters) < level:
                level_counters.append(0)
            level_counters[level - 1] += 1
            del level_counters[level:]

            physical_index = get_page_number(entry)
            if physical_index is None:
                continue

            structure = '.'.join(str(num) for num in level_counters)
            toc_items.append({
                'structure': structure,
                'title': title,
                'physical_index': physical_index,
            })

    walk(outlines, level=1)
    return toc_items



def get_page_tokens(pdf_path, model=None, pdf_parser="PyPDF2"):
    enc = _get_encoding(model or get_default_model())
    if pdf_parser == "PyPDF2":
        pdf_reader = PyPDF2.PdfReader(pdf_path)
        page_list = []
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            token_length = len(enc.encode(page_text))
            page_list.append((page_text, token_length))
        return page_list
    elif pdf_parser == "PyMuPDF":
        if isinstance(pdf_path, BytesIO):
            pdf_stream = pdf_path
            doc = pymupdf.open(stream=pdf_stream, filetype="pdf")
        elif isinstance(pdf_path, str) and os.path.isfile(pdf_path) and pdf_path.lower().endswith(".pdf"):
            doc = pymupdf.open(pdf_path)
        page_list = []
        for page in doc:
            page_text = page.get_text()
            token_length = len(enc.encode(page_text))
            page_list.append((page_text, token_length))
        return page_list
    else:
        raise ValueError(f"Unsupported PDF parser: {pdf_parser}")

        

def get_text_of_pdf_pages(pdf_pages, start_page, end_page):
    text = ""
    for page_num in range(start_page-1, end_page):
        text += pdf_pages[page_num][0]
    return text

def get_text_of_pdf_pages_with_labels(pdf_pages, start_page, end_page):
    text = ""
    for page_num in range(start_page-1, end_page):
        text += f"<physical_index_{page_num+1}>\n{pdf_pages[page_num][0]}\n<physical_index_{page_num+1}>\n"
    return text

def get_number_of_pages(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    num = len(pdf_reader.pages)
    return num



def post_processing(structure, end_physical_index):
    # First convert page_number to start_index in flat list
    for i, item in enumerate(structure):
        item['start_index'] = item.get('physical_index')
        if i < len(structure) - 1:
            if structure[i + 1].get('appear_start') == 'yes':
                item['end_index'] = structure[i + 1]['physical_index']-1
            else:
                item['end_index'] = structure[i + 1]['physical_index']
        else:
            item['end_index'] = end_physical_index
    tree = list_to_tree(structure)
    if len(tree)!=0:
        return tree
    else:
        ### remove appear_start 
        for node in structure:
            node.pop('appear_start', None)
            node.pop('physical_index', None)
        return structure

def clean_structure_post(data):
    if isinstance(data, dict):
        data.pop('page_number', None)
        data.pop('start_index', None)
        data.pop('end_index', None)
        if 'nodes' in data:
            clean_structure_post(data['nodes'])
    elif isinstance(data, list):
        for section in data:
            clean_structure_post(section)
    return data

def remove_fields(data, fields=['text']):
    if isinstance(data, dict):
        return {k: remove_fields(v, fields)
            for k, v in data.items() if k not in fields}
    elif isinstance(data, list):
        return [remove_fields(item, fields) for item in data]
    return data

def print_toc(tree, indent=0):
    for node in tree:
        print('  ' * indent + node['title'])
        if node.get('nodes'):
            print_toc(node['nodes'], indent + 1)

def print_json(data, max_len=40, indent=2):
    def simplify_data(obj):
        if isinstance(obj, dict):
            return {k: simplify_data(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [simplify_data(item) for item in obj]
        elif isinstance(obj, str) and len(obj) > max_len:
            return obj[:max_len] + '...'
        else:
            return obj
    
    simplified = simplify_data(data)
    print(json.dumps(simplified, indent=indent, ensure_ascii=False))


def remove_structure_text(data):
    if isinstance(data, dict):
        data.pop('text', None)
        if 'nodes' in data:
            remove_structure_text(data['nodes'])
    elif isinstance(data, list):
        for item in data:
            remove_structure_text(item)
    return data


def check_token_limit(structure, limit=110000):
    list = structure_to_list(structure)
    for node in list:
        num_tokens = count_tokens(node['text'], model=get_default_model())
        if num_tokens > limit:
            print(f"Node ID: {node['node_id']} has {num_tokens} tokens")
            print("Start Index:", node['start_index'])
            print("End Index:", node['end_index'])
            print("Title:", node['title'])
            print("\n")


def convert_physical_index_to_int(data):
    if isinstance(data, list):
        for i in range(len(data)):
            # Check if item is a dictionary and has 'physical_index' key
            if isinstance(data[i], dict) and 'physical_index' in data[i]:
                if isinstance(data[i]['physical_index'], str):
                    if data[i]['physical_index'].startswith('<physical_index_'):
                        data[i]['physical_index'] = int(data[i]['physical_index'].split('_')[-1].rstrip('>').strip())
                    elif data[i]['physical_index'].startswith('physical_index_'):
                        data[i]['physical_index'] = int(data[i]['physical_index'].split('_')[-1].strip())
    elif isinstance(data, str):
        if data.startswith('<physical_index_'):
            data = int(data.split('_')[-1].rstrip('>').strip())
        elif data.startswith('physical_index_'):
            data = int(data.split('_')[-1].strip())
        # Check data is int
        if isinstance(data, int):
            return data
        else:
            return None
    return data


def convert_page_to_int(data):
    for item in data:
        if 'page' in item and isinstance(item['page'], str):
            try:
                item['page'] = int(item['page'])
            except ValueError:
                # Keep original value if conversion fails
                pass
    return data


def add_node_text(node, pdf_pages):
    if isinstance(node, dict):
        start_page = node.get('start_index')
        end_page = node.get('end_index')
        node['text'] = get_text_of_pdf_pages(pdf_pages, start_page, end_page)
        if 'nodes' in node:
            add_node_text(node['nodes'], pdf_pages)
    elif isinstance(node, list):
        for index in range(len(node)):
            add_node_text(node[index], pdf_pages)
    return


def add_node_text_with_labels(node, pdf_pages):
    if isinstance(node, dict):
        start_page = node.get('start_index')
        end_page = node.get('end_index')
        node['text'] = get_text_of_pdf_pages_with_labels(pdf_pages, start_page, end_page)
        if 'nodes' in node:
            add_node_text_with_labels(node['nodes'], pdf_pages)
    elif isinstance(node, list):
        for index in range(len(node)):
            add_node_text_with_labels(node[index], pdf_pages)
    return


async def generate_node_summary(node, model=None):
    prompt = f"""You are given a part of a document, your task is to generate a concise description of the partial document about what are main points covered in the partial document. The description should be concise.

    Partial Document Text: {node['text']}
    
    Directly return the description, do not include any other text.
    """
    response = await ChatGPT_API_async(model, prompt)
    return response


async def generate_summaries_for_structure(structure, model=None):
    nodes = structure_to_list(structure)
    tasks = [generate_node_summary(node, model=model) for node in nodes]
    summaries = await asyncio.gather(*tasks)
    
    for node, summary in zip(nodes, summaries):
        node['summary'] = summary
    return structure


def create_clean_structure_for_description(structure):
    """
    Create a clean structure for document description generation,
    excluding unnecessary fields like 'text'.
    """
    if isinstance(structure, dict):
        clean_node = {}
        # Only include essential fields for description
        for key in ['title', 'node_id', 'summary', 'prefix_summary']:
            if key in structure:
                clean_node[key] = structure[key]
        
        # Recursively process child nodes
        if 'nodes' in structure and structure['nodes']:
            clean_node['nodes'] = create_clean_structure_for_description(structure['nodes'])
        
        return clean_node
    elif isinstance(structure, list):
        return [create_clean_structure_for_description(item) for item in structure]
    else:
        return structure


def generate_doc_description(structure, model=None):
    prompt = f"""Your are an expert in generating descriptions for a document.
    You are given a structure of a document. Your task is to generate a description for the document, which makes it easy to distinguish the document from other documents. Make sure the description covers the main points of the document based on the structure. Try to make it concise but informative.
        
    Document Structure: {structure}
    
    Directly return the description, do not include any other text.
    """
    response = ChatGPT_API(model, prompt)
    return response


def reorder_dict(data, key_order):
    if not key_order:
        return data
    return {key: data[key] for key in key_order if key in data}


def format_structure(structure, order=None):
    if not order:
        return structure
    if isinstance(structure, dict):
        if 'nodes' in structure:
            structure['nodes'] = format_structure(structure['nodes'], order)
        if not structure.get('nodes'):
            structure.pop('nodes', None)
        structure = reorder_dict(structure, order)
    elif isinstance(structure, list):
        structure = [format_structure(item, order) for item in structure]
    return structure


class ConfigLoader:
    def __init__(self, default_path: str = None):
        if default_path is None:
            default_path = Path(__file__).parent / "config.yaml"
        self._default_dict = self._load_yaml(default_path)

    @staticmethod
    def _load_yaml(path):
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def _validate_keys(self, user_dict):
        unknown_keys = set(user_dict) - set(self._default_dict)
        if unknown_keys:
            raise ValueError(f"Unknown config keys: {unknown_keys}")

    def load(self, user_opt=None) -> config:
        """
        Load the configuration, merging user options with default values.
        """
        if user_opt is None:
            user_dict = {}
        elif isinstance(user_opt, config):
            user_dict = vars(user_opt)
        elif isinstance(user_opt, dict):
            user_dict = user_opt
        else:
            raise TypeError("user_opt must be dict, config(SimpleNamespace) or None")

        self._validate_keys(user_dict)
        merged = {**self._default_dict, **user_dict}
        
        # Override model with environment variable if set
        env_model = os.getenv("DEEPSEEK_MODEL")
        if env_model:
            merged["model"] = env_model
        
        return config(**merged)

def create_node_mapping(tree, include_page_ranges=False, max_page=None):  
    """  
    创建节点ID到节点信息的映射字典  
      
    Args:  
        tree: 文档树结构  
        include_page_ranges: 是否包含页面范围信息  
        max_page: 最大页数（用于页面范围计算）  
      
    Returns:  
        dict: {node_id: node_info} 的映射  
    """  
    node_map = {}  
      
    def traverse_tree(nodes):  
        if isinstance(nodes, dict):  
            node_id = nodes.get('node_id')  
            if node_id:  
                node_info = {  
                    'node': nodes,  
                    'start_index': nodes.get('start_index'),  
                    'end_index': nodes.get('end_index')  
                }  
                  
                # 添加页面范围信息  
                if include_page_ranges:  
                    start_page = nodes.get('start_index', 1)  
                    end_page = nodes.get('end_index', start_page)  
                    if max_page and end_page > max_page:  
                        end_page = max_page  
                    node_info['page_range'] = f"{start_page}-{end_page}" if start_page != end_page else str(start_page)  
                  
                node_map[node_id] = node_info  
              
            # 递归处理子节点  
            if 'nodes' in nodes and nodes['nodes']:  
                traverse_tree(nodes['nodes'])  
                  
        elif isinstance(nodes, list):  
            for node in nodes:  
                traverse_tree(node)  
      
    traverse_tree(tree)  
    return node_map

def _normalize_audio_sentence_records(records):
    """Normalize sentence-level ASR records into a clean internal list."""
    normalized = []
    for idx, item in enumerate(records or [], start=1):
        sentence = str(item.get('sentence', '')).strip()
        if not sentence:
            continue
        try:
            start_time = float(item.get('start_time', 0.0))
            end_time = float(item.get('end_time', start_time))
        except Exception:
            start_time = 0.0
            end_time = 0.0
        if end_time < start_time:
            end_time = start_time
        normalized.append({
            'sid': f's{idx}',
            'sentence': sentence,
            'start_time': round(start_time, 3),
            'end_time': round(end_time, 3),
        })
    return normalized


def _fallback_merge_audio_paragraphs(records, max_sent_per_paragraph=5, max_duration=25.0):
    """Fallback paragraph merger used when LLM output is invalid."""
    paragraphs = []
    current = []

    def flush_current():
        if not current:
            return
        paragraph_text = ''.join([x['sentence'] for x in current]).strip()
        if not paragraph_text:
            return
        paragraphs.append({
            'paragraph': paragraph_text,
            'start_time': current[0]['start_time'],
            'end_time': current[-1]['end_time'],
        })

    for item in records:
        if not current:
            current.append(item)
            continue

        duration = item['end_time'] - current[0]['start_time']
        if len(current) >= max_sent_per_paragraph or duration >= max_duration:
            flush_current()
            current = [item]
        else:
            current.append(item)

    flush_current()
    return paragraphs


def _validate_sentence_ranges(ranges, sentence_count):
    """Validate that LLM paragraph ranges fully and sequentially cover all sentences."""
    if not isinstance(ranges, list) or not ranges:
        return False

    expected_start = 1
    for block in ranges:
        if not isinstance(block, dict):
            return False
        start_idx = block.get('start_sentence_index')
        end_idx = block.get('end_sentence_index')
        if not isinstance(start_idx, int) or not isinstance(end_idx, int):
            return False
        if start_idx != expected_start:
            return False
        if end_idx < start_idx or end_idx > sentence_count:
            return False
        expected_start = end_idx + 1

    return expected_start == sentence_count + 1


def merge_audio_sentences_with_llm(records, model=None, max_sentences_per_batch=120):
    """
    Convert sentence-level ASR records into semantic paragraphs with merged timestamps.
    Returns: [{paragraph, start_time, end_time, pid}]
    """
    normalized = _normalize_audio_sentence_records(records)
    if not normalized:
        return []

    if len(normalized) <= max_sentences_per_batch:
        batches = [normalized]
    else:
        batches = [normalized[i:i + max_sentences_per_batch] for i in range(0, len(normalized), max_sentences_per_batch)]

    merged_paragraphs = []

    for batch in batches:
        sentence_lines = []
        for i, item in enumerate(batch, start=1):
            sentence_lines.append(
                f"[{i}] ({item['start_time']:.3f}-{item['end_time']:.3f}) {item['sentence']}"
            )
        transcript = '\n'.join(sentence_lines)

        prompt = f"""
You are a transcript editing assistant.
You are given ASR sentences in chronological order. Please:
1) merge them into semantically coherent paragraphs;
2) keep the original order;
3) do not drop or duplicate any sentence;
4) only apply light typo/punctuation cleanup, without changing facts.

Return JSON only in this format:
{{
    "paragraphs": [
        {{
            "start_sentence_index": 1,
            "end_sentence_index": 3,
            "paragraph": "merged paragraph text"
        }}
    ]
}}

Requirements:
- Sentence indices must continuously cover all sentences from 1..N.
- Each paragraph must contain at least one sentence.

Input sentences:
{transcript}
"""

        response = ChatGPT_API(model=model, prompt=prompt)
        json_content = extract_json(response)
        ranges = json_content.get('paragraphs', []) if isinstance(json_content, dict) else []

        if not _validate_sentence_ranges(ranges, len(batch)):
            batch_paragraphs = _fallback_merge_audio_paragraphs(batch)
        else:
            batch_paragraphs = []
            for block in ranges:
                s = block['start_sentence_index'] - 1
                e = block['end_sentence_index']
                selected = batch[s:e]
                paragraph_text = str(block.get('paragraph', '')).strip()
                if not paragraph_text:
                    paragraph_text = ''.join([x['sentence'] for x in selected]).strip()
                batch_paragraphs.append({
                    'paragraph': paragraph_text,
                    'start_time': selected[0]['start_time'],
                    'end_time': selected[-1]['end_time'],
                })

        merged_paragraphs.extend(batch_paragraphs)

    for idx, p in enumerate(merged_paragraphs, start=1):
        p['pid'] = f'p{idx}'

    return merged_paragraphs


def _flatten_audio_outline_ranges(outline_nodes):
    """Collect all paragraph-id ranges from an outline tree for quick validation."""
    ranges = []

    def walk(nodes):
        if not isinstance(nodes, list):
            return
        for node in nodes:
            if not isinstance(node, dict):
                continue
            start_pid = node.get('start_paragraph_id')
            end_pid = node.get('end_paragraph_id')
            if isinstance(start_pid, str) and isinstance(end_pid, str):
                ranges.append((start_pid, end_pid))
            walk(node.get('children', []))

    walk(outline_nodes)
    return ranges


def _parse_paragraph_id_to_index(paragraph_id):
    """Parse paragraph id like 'p12' to a 0-based index."""
    text = str(paragraph_id or '').strip().lower()
    if not text.startswith('p'):
        return None
    value_text = text[1:]
    if not value_text.isdigit():
        return None
    value = int(value_text)
    if value <= 0:
        return None
    return value - 1

def _build_paragraph_leaf_nodes(paragraphs, start_idx, end_idx):
    """Build leaf nodes from paragraph ranges."""
    leaves = []
    for i in range(start_idx, end_idx + 1):
        paragraph = paragraphs[i]
        leaves.append({
            'title': f"Paragraph {i + 1}",
            'start_time': paragraph['start_time'],
            'end_time': paragraph['end_time'],
            'text': paragraph['paragraph'],
        })
    return leaves


def _build_audio_node_from_outline(node_outline, paragraphs):
    """Convert one outline node into the final audio tree node format."""
    title = str(node_outline.get('title', 'Untitled Section')).strip() or 'Untitled Section'
    start_idx = _parse_paragraph_id_to_index(node_outline.get('start_paragraph_id'))
    end_idx = _parse_paragraph_id_to_index(node_outline.get('end_paragraph_id'))

    if start_idx is None or end_idx is None:
        return None

    if start_idx < 0 or end_idx >= len(paragraphs) or end_idx < start_idx:
        return None

    segment = paragraphs[start_idx:end_idx + 1]
    node = {
        'title': title,
        'start_time': segment[0]['start_time'],
        'end_time': segment[-1]['end_time'],
        'text': '\n\n'.join([p['paragraph'] for p in segment]).strip(),
    }

    children_outline = node_outline.get('children', [])
    children = []
    if isinstance(children_outline, list) and children_outline:
        for child_outline in children_outline:
            child_node = _build_audio_node_from_outline(child_outline, paragraphs)
            if child_node is not None:
                children.append(child_node)

    if children:
        node['nodes'] = children

    return node


def build_audio_structure_with_llm(paragraphs, model=None):
    """
    Ask LLM to organize paragraphs into a hierarchical chapter structure,
    then map it into nodes similar to the PDF tree format.
    """
    if not paragraphs:
        return []

    paragraph_lines = []
    for p in paragraphs:
        snippet = p['paragraph']
        if len(snippet) > 120:
            snippet = snippet[:120] + '...'
        paragraph_lines.append(
            f"{p['pid']} ({p['start_time']:.3f}-{p['end_time']:.3f}): {snippet}"
        )

        prompt = f"""
You are a content structuring assistant.
Given chronologically ordered paragraphs (from one video transcript), create a logical chapter tree.
The source has no table of contents, so infer topic boundaries and hierarchy depth yourself (1 to 3 levels).

Return JSON only in this format:
{{
    "chapters": [
        {{
            "title": "chapter title",
            "start_paragraph_id": "p1",
            "end_paragraph_id": "p5",
            "children": [
                {{
                    "title": "subchapter title",
                    "start_paragraph_id": "p1",
                    "end_paragraph_id": "p2",
                    "children": []
                }}
            ]
        }}
    ]
}}

Rules:
- Every chapter range must use existing paragraph IDs.
- Sibling chapters must be in chronological order.
- Top-level chapters should cover all paragraphs from p1 to pN, with minimal overlap.
- Child ranges must be within their parent range.

Paragraph list:
{chr(10).join(paragraph_lines)}
"""

    response = ChatGPT_API(model=model, prompt=prompt)
    json_content = extract_json(response)
    chapters = json_content.get('chapters', []) if isinstance(json_content, dict) else []

    outline_ranges = _flatten_audio_outline_ranges(chapters)
    if not chapters or not outline_ranges:
        return [{
            'title': 'Full Video Content',
            'start_time': paragraphs[0]['start_time'],
            'end_time': paragraphs[-1]['end_time'],
            'text': '\n\n'.join([p['paragraph'] for p in paragraphs]).strip()
        }]

    built = []
    for item in chapters:
        node = _build_audio_node_from_outline(item, paragraphs)
        if node is not None:
            built.append(node)

    if not built:
        return [{
            'title': 'Full Video Content',
            'start_time': paragraphs[0]['start_time'],
            'end_time': paragraphs[-1]['end_time'],
            'text': '\n\n'.join([p['paragraph'] for p in paragraphs]).strip()
        }]

    return built


def resolve_media_doc_name_from_uploads(audio_json_path):
    json_path = Path(audio_json_path)
    json_stem = json_path.stem
    project_root = Path(__file__).resolve().parents[3]
    uploads_dir = project_root / 'uploads'
    media_exts = {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.mp3', '.wav', '.m4a', '.aac', '.ogg'}

    if not uploads_dir.exists() or not uploads_dir.is_dir():
        return json_path.name

    for ext in media_exts:
        candidate = uploads_dir / f"{json_stem}{ext}"
        if candidate.exists() and candidate.is_file():
            return candidate.name

    for candidate in uploads_dir.rglob('*'):
        if candidate.is_file() and candidate.suffix.lower() in media_exts and candidate.stem == json_stem:
            return candidate.name

    return json_path.name


def audio_json_to_tree(audio_json_path,
                       model=None,
                       if_add_node_id='yes',
                       if_add_node_summary='yes',
                       if_add_doc_description='yes',
                       if_add_node_text='yes'):
    """
        Build a PDF-like hierarchical tree from sentence-level ASR JSON.

        Input JSON format (sentence-level):
    [
      {"sentence": "...", "start_time": 0.0, "end_time": 1.2},
      ...
    ]

        Output format:
    {
      "doc_name": "xxx.mp4",
      "doc_description": "...",
      "structure": [ ... ]
    }
    """
    with open(audio_json_path, 'r', encoding='utf-8') as f:
        raw_records = json.load(f)

    if not isinstance(raw_records, list) or not raw_records:
        raise ValueError('Audio JSON is empty or invalid; expected a sentence object list')

    paragraphs = merge_audio_sentences_with_llm(raw_records, model=model)
    if not paragraphs:
        raise ValueError('Failed to generate valid paragraphs from audio records')

    structure = build_audio_structure_with_llm(paragraphs, model=model)
    if not structure:
        raise ValueError('Failed to generate a valid chapter structure from paragraphs')

    if if_add_node_id == 'yes':
        write_node_id(structure)

    if if_add_node_summary == 'yes':
        asyncio.run(generate_summaries_for_structure(structure, model=model))

    if if_add_node_text != 'yes':
        remove_structure_text(structure)

    result = {
        'doc_name': resolve_media_doc_name_from_uploads(audio_json_path),
        'structure': structure,
    }

    if if_add_doc_description == 'yes':
        clean_structure = create_clean_structure_for_description(structure)
        result['doc_description'] = generate_doc_description(clean_structure, model=model)

    trees_dir = Path(__file__).resolve().parent.parent / 'db' / 'trees'
    trees_dir.mkdir(parents=True, exist_ok=True)
    output_name = f"{Path(audio_json_path).stem}_structure.json"
    output_path = trees_dir / output_name
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return result