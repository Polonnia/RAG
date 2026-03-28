import re
from typing import AsyncGenerator

from .llm_client import completion_text, completion_stream_async, get_default_model

def get_completion(prompt, model=None):
    return completion_text(
        prompt=prompt,
        model=model or get_default_model(),
        system_prompt="你是一位经验丰富的教育专家，擅长设计教学内容和课程计划。",
        temperature=0,
    )


def _strip_code_fences(text: str) -> str:
    value = str(text or '').strip()
    if value.startswith('```'):
        value = re.sub(r'^```[a-zA-Z0-9_-]*\s*', '', value)
        value = re.sub(r'\s*```\s*$', '', value)
    return value.strip()


def extract_duration_from_prompt(prompt: str) -> int:
    """从教师输入文本中提取学时要求，若无则返回0。"""
    match = re.search(r"(\d+)\s*学时", str(prompt or ''))
    if match:
        return int(match.group(1))
    return 0


def _build_teaching_schedule_prompt(selected_outline: str, total_hours: int, total_lessons: int, material_name: str) -> str:
    return f"""
你是一位专业课程设计助手。请基于教师最终勾选的大纲生成教学进度安排。

要求：
1. 只输出一个 Markdown 表格，不要输出解释文字。
2. 表头必须且仅能是：| 课次 | 章节/小节 | 教学内容安排 | 教学方式 | 作业与考核 |
3. 内容必须覆盖大纲中的所有已勾选章节/小节，不得新增无关章节。
4. 表格必须体现课程安排节奏（导入、讲授、练习/讨论、小结等可按需安排）。

教材名称：{material_name or '未提供'}
总课时：{total_hours}
总课数：{total_lessons}

教师最终勾选大纲：
{selected_outline}
"""


def generate_teaching_schedule_markdown(
    selected_outline: str,
    total_hours: int,
    total_lessons: int,
    material_name: str = ''
) -> str:
    """
    根据教师勾选后的教材目录和总课时，生成固定格式的教学内容安排Markdown表格。
    """
    safe_hours = int(total_hours) if str(total_hours).isdigit() else 0
    safe_lessons = int(total_lessons) if str(total_lessons).isdigit() else 0
    if safe_hours <= 0:
        raise ValueError('课时必须为正整数')
    if safe_lessons <= 0:
        raise ValueError('课数必须为正整数')

    prompt = _build_teaching_schedule_prompt(
        selected_outline=selected_outline,
        total_hours=safe_hours,
        total_lessons=safe_lessons,
        material_name=material_name,
    )

    result = get_completion(prompt)
    return _strip_code_fences(result)


async def generate_teaching_schedule_markdown_stream(
    selected_outline: str,
    total_hours: int,
    total_lessons: int,
    material_name: str = ''
) -> AsyncGenerator[str, None]:
    safe_hours = int(total_hours) if str(total_hours).isdigit() else 0
    safe_lessons = int(total_lessons) if str(total_lessons).isdigit() else 0
    if safe_hours <= 0:
        raise ValueError('课时必须为正整数')
    if safe_lessons <= 0:
        raise ValueError('课数必须为正整数')

    prompt = _build_teaching_schedule_prompt(
        selected_outline=selected_outline,
        total_hours=safe_hours,
        total_lessons=safe_lessons,
        material_name=material_name,
    )

    async for chunk in completion_stream_async(
        prompt=prompt,
        model=get_default_model(),
        system_prompt="你是一位经验丰富的教育专家，擅长设计教学内容和课程计划。",
        temperature=0,
    ):
        yield chunk



def generate_detailed_content_for_outline(outline: str) -> str:
    """
    兼容旧流程：根据已给定大纲扩展详细教学内容。
    """
    prompt = f"""
你是一位专业的课程PPT设计AI。
1. 请根据下方知识框架，在每个最小层级标题（即没有子标题的标题）下补充详细教学内容。
2. 内容要求条理清晰、可直接用于PPT授课。
3. 在文档顶部加入如下 frontmatter：
---
title: 课程教学设计
---
4. 最终输出完整的 Markdown 文档。

【知识框架】
{outline}
"""
    return _strip_code_fences(get_completion(prompt))


def generate_teaching_outline(course_outline: str) -> str:
    """兼容旧接口：将教师输入整理为结构化大纲。"""
    prompt = f"""
请将下列课程输入整理为清晰的层级化课程大纲，使用 Markdown 标题和列表表达：

{course_outline}
"""
    return _strip_code_fences(get_completion(prompt))


def generate_lesson_schedule(outline: str) -> str:
    """兼容旧接口：根据旧流程大纲生成简版学时表。"""
    prompt = f"""
请根据课程大纲生成 Markdown 表格，列为“章节”和“学时”。
要求：只输出表格，学时总量合理。

{outline}
"""
    return _strip_code_fences(get_completion(prompt))
