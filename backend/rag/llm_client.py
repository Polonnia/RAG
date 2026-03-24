import asyncio
import os
import time
from pathlib import Path
from typing import List, Optional, Tuple

from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=True)


def get_api_key() -> str:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("请设置环境变量 DEEPSEEK_API_KEY")
    return api_key


def get_base_url() -> str:
    return os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")


def get_default_model() -> str:
    return os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


def _resolve_model(model: Optional[str]) -> str:
    return model or get_default_model()


def _build_messages(prompt: str, system_prompt: Optional[str], chat_history: Optional[List[dict]]) -> List[dict]:
    messages: List[dict] = list(chat_history) if chat_history else []
    if system_prompt:
        messages.insert(0, {"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    return messages


def chat_completion(
    messages: List[dict],
    model: Optional[str] = None,
    temperature: float = 0,
    max_retries: int = 10,
):
    client = OpenAI(api_key=get_api_key(), base_url=get_base_url())
    last_error = None
    resolved_model = _resolve_model(model)
    
    for i in range(max_retries):
        try:
            return client.chat.completions.create(
                model=resolved_model,
                messages=messages,
                temperature=temperature,
            )
        except Exception as e:
            last_error = e
            error_str = str(e)
            
            # Check for model not exist error
            if "Model Not Exist" in error_str or "model_not_found" in error_str.lower():
                raise ValueError(
                    f"模型 '{resolved_model}' 不存在。"
                    f"请检查 DEEPSEEK_MODEL 环境变量是否设置正确。"
                    f"当前使用的模型: {resolved_model}\n"
                    f"错误信息: {error_str}"
                )
            
            # Retry with backoff for other errors
            if i < max_retries - 1:
                time.sleep(min(2 ** i, 10))  # Exponential backoff
            else:
                raise e
    raise last_error


def completion_text(
    prompt: str,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    chat_history: Optional[List[dict]] = None,
    temperature: float = 0,
    max_retries: int = 10,
) -> str:
    messages = _build_messages(prompt, system_prompt, chat_history)
    response = chat_completion(
        messages=messages,
        model=model,
        temperature=temperature,
        max_retries=max_retries,
    )
    return response.choices[0].message.content


def completion_with_finish_reason(
    prompt: str,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    chat_history: Optional[List[dict]] = None,
    temperature: float = 0,
    max_retries: int = 10,
) -> Tuple[str, str]:
    messages = _build_messages(prompt, system_prompt, chat_history)
    response = chat_completion(
        messages=messages,
        model=model,
        temperature=temperature,
        max_retries=max_retries,
    )
    finish_reason = response.choices[0].finish_reason
    if finish_reason == "length":
        return response.choices[0].message.content, "max_output_reached"
    return response.choices[0].message.content, "finished"


async def completion_text_async(
    prompt: str,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    chat_history: Optional[List[dict]] = None,
    temperature: float = 0,
    max_retries: int = 10,
) -> str:
    messages = _build_messages(prompt, system_prompt, chat_history)
    client = AsyncOpenAI(api_key=get_api_key(), base_url=get_base_url())
    last_error = None
    for i in range(max_retries):
        try:
            response = await client.chat.completions.create(
                model=_resolve_model(model),
                messages=messages,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            last_error = e
            if i < max_retries - 1:
                await asyncio.sleep(1)
            else:
                raise e
    raise last_error
