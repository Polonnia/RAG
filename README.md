# 溯知：基于多模态大模型的教学智能体

## 系统概述

这是一个基于多模态RAG技术的智能教学助手系统，集成了知识库管理、教学内容设计、考核内容生成和考试系统功能。系统分为教师端和学生端，提供完整的教学辅助功能。

## 安装和运行

### 环境要求
- Python 3.8+
- Node.js 14+
- npm 或 yarn

### 前端安装
```bash
cd frontend
npm install
npm start
```
### 后端安装
```bash
python backend/main.py
```

### OpenAvatarChat
```bash
git clone https://github.com/HumanAIGC-Engineering/OpenAvatarChat.git
cd OpenAvatarChat
git submodule update --init --recursive --depth 1

uv run install.py --config config/chat_with_openai_compatible_bailian_cosyvoice.yaml

uv run scripts/download_models.py --handler liteavatar

pnpm install

pnpm run build

uv run src/demo.py --config config/chat_with_openai_compatible_bailian_cosyvoice.yaml
```