from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
import tempfile, os, shutil, traceback, logging
from ppt_agent.document_parser import DocumentModel
from ppt_agent.ppt_generator import PPTGenerator

router = APIRouter()

logging.basicConfig(level=logging.INFO)

@router.post("/teacher/generate-ppt-from-outline")
async def generate_ppt_from_outline(outline: str = Form(...)):
    temp_dir = tempfile.mkdtemp()
    try:
        md_path = os.path.join(temp_dir, "outline.md")
        ppt_path = os.path.join(temp_dir, "output.pptx")
        logging.info(f"[PPT] 保存大纲到: {md_path}")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(outline)
        doc_model = DocumentModel(md_path)
        logging.info("[PPT] 解析大纲文档...")
        doc_model.parse()
        doc_model.download_images(temp_dir)
        ppt_generator = PPTGenerator()
        logging.info(f"[PPT] 生成PPT到: {ppt_path}")
        ppt_generator.generate(doc_model, ppt_path)
        if not os.path.exists(ppt_path):
            logging.error(f"[PPT] 生成失败，文件不存在: {ppt_path}")
            raise HTTPException(status_code=500, detail=f"PPT生成失败，文件未创建: {ppt_path}")
        logging.info(f"[PPT] PPT生成成功: {ppt_path}")
        
        # 创建一个自定义的FileResponse，在文件发送后清理临时目录
        response = FileResponse(
            ppt_path, 
            filename="teaching-outline.pptx", 
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
        
        # 添加清理函数到响应对象
        async def cleanup_after_response():
            import asyncio
            await asyncio.sleep(1)  # 等待文件发送完成
            shutil.rmtree(temp_dir, ignore_errors=True)
            logging.info(f"[PPT] 清理临时目录: {temp_dir}")
        
        # 启动后台任务清理临时目录
        import asyncio
        asyncio.create_task(cleanup_after_response())
        
        return response
    except Exception as e:
        logging.error(f"[PPT] 生成异常: {e}\n{traceback.format_exc()}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"PPT生成异常: {e}")

@router.post("/teacher/generate-ppt-from-upload")
async def generate_ppt_from_upload(document: UploadFile = File(...)):
    temp_dir = tempfile.mkdtemp()
    try:
        input_path = os.path.join(temp_dir, document.filename)
        ppt_path = os.path.join(temp_dir, "output.pptx")
        logging.info(f"[PPT] 保存上传文件到: {input_path}")
        with open(input_path, "wb") as f:
            f.write(await document.read())
        doc_model = DocumentModel(input_path)
        logging.info("[PPT] 解析上传文档...")
        doc_model.parse()
        doc_model.download_images(temp_dir)
        ppt_generator = PPTGenerator()
        logging.info(f"[PPT] 生成PPT到: {ppt_path}")
        ppt_generator.generate(doc_model, ppt_path)
        if not os.path.exists(ppt_path):
            logging.error(f"[PPT] 生成失败，文件不存在: {ppt_path}")
            raise HTTPException(status_code=500, detail=f"PPT生成失败，文件未创建: {ppt_path}")
        logging.info(f"[PPT] PPT生成成功: {ppt_path}")
        
        # 创建一个自定义的FileResponse，在文件发送后清理临时目录
        response = FileResponse(
            ppt_path, 
            filename="teaching-upload.pptx", 
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
        
        # 添加清理函数到响应对象
        async def cleanup_after_response():
            import asyncio
            await asyncio.sleep(1)  # 等待文件发送完成
            shutil.rmtree(temp_dir, ignore_errors=True)
            logging.info(f"[PPT] 清理临时目录: {temp_dir}")
        
        # 启动后台任务清理临时目录
        import asyncio
        asyncio.create_task(cleanup_after_response())
        
        return response
    except Exception as e:
        logging.error(f"[PPT] 生成异常: {e}\n{traceback.format_exc()}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"PPT生成异常: {e}") 