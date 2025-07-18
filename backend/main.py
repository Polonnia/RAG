from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.auth_api import router as auth_router
from api.knowledge_api import router as knowledge_router
from api.exam_api import router as exam_router
from api.ai_api import router as ai_router
from api.teaching_api import router as teaching_router
from api.analysis_api import router as analysis_router
from api.assistant_api import router as assistant_router
from api import admin_api

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(knowledge_router)
app.include_router(exam_router)
app.include_router(ai_router)
app.include_router(teaching_router)
app.include_router(analysis_router)
app.include_router(assistant_router)
app.include_router(admin_api.router, prefix="/admin")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 