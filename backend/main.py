import sys
import os
# 添加当前目录到 Python 路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from api.auth_api import router as auth_router
from api.knowledge_api import router as knowledge_router
from api.exam_api import router as exam_router
# from api.teaching_api import router as teaching_router
from api.analysis_api import router as analysis_router
from api.assistant_api import router as assistant_router
from api import admin_api

# 用于标记初始化是否已完成
_initialization_done = False

def init_database():
    """初始化数据库（仅执行一次）"""
    global _initialization_done
    if _initialization_done:
        return
    
    _initialization_done = True

# 使用 lifespan 事件在应用启动时执行初始化
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 应用启动时
    init_database()
    yield
    # 应用关闭时

app = FastAPI(lifespan=lifespan)

#CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(auth_router)
app.include_router(knowledge_router)
app.include_router(exam_router)
# app.include_router(teaching_router)
app.include_router(analysis_router)
app.include_router(assistant_router)
app.include_router(admin_api.router, prefix="/admin")

# Mount static files - React frontend
# 检查build目录是否存在
build_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")
if os.path.exists(build_path):
    app.mount("/", StaticFiles(directory=build_path, html=True), name="static")
    print(f"✅ 静态文件已挂载: {build_path}")
else:
    print(f"⚠️  静态文件目录不存在: {build_path}")
    print("请先运行 npm run build 构建前端")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 