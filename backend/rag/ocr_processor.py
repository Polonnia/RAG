import os
import fitz  # PyMuPDF
import cv2
import numpy as np
from PIL import Image
import pytesseract
from typing import List, Dict, Any
import tempfile
import shutil

class OCRProcessor:
    """OCR处理器，用于处理扫描版PDF"""
    
    def __init__(self):
        # 检查tesseract是否安装
        try:
            pytesseract.get_tesseract_version()
            print("Tesseract OCR 已安装")
        except Exception as e:
            print(f"Tesseract OCR 未安装或配置错误: {str(e)}")
            print("请安装 Tesseract OCR: https://github.com/tesseract-ocr/tesseract")
    
    def extract_images_from_pdf(self, pdf_path: str) -> List[np.ndarray]:
        """从PDF中提取图像"""
        try:
            doc = fitz.open(pdf_path)
            images = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                
                # 获取页面图像
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2倍分辨率
                img_data = pix.tobytes("png")
                
                # 转换为OpenCV格式
                nparr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is not None:
                    images.append(img)
            
            doc.close()
            print(f"从PDF中提取了 {len(images)} 页图像")
            return images
            
        except Exception as e:
            print(f"提取PDF图像失败: {str(e)}")
            return []
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """预处理图像以提高OCR效果"""
        try:
            # 转换为灰度图
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # 去噪
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # 二值化
            _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # 形态学操作，去除小噪点
            kernel = np.ones((1, 1), np.uint8)
            cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
            
            return cleaned
            
        except Exception as e:
            print(f"图像预处理失败: {str(e)}")
            return image
    
    def ocr_image(self, image: np.ndarray, lang: str = 'chi_sim+eng') -> str:
        """对图像进行OCR识别"""
        try:
            # 预处理图像
            processed_image = self.preprocess_image(image)
            
            # 配置OCR参数
            custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz中文汉字'
            
            # 执行OCR
            text = pytesseract.image_to_string(processed_image, lang=lang, config=custom_config)
            
            return text.strip()
            
        except Exception as e:
            print(f"OCR识别失败: {str(e)}")
            return ""
    
    def ocr_pdf(self, pdf_path: str, lang: str = 'chi_sim+eng') -> List[Dict[str, Any]]:
        """对PDF进行OCR处理"""
        try:
            print(f"开始OCR处理PDF: {pdf_path}")
            
            # 提取图像
            images = self.extract_images_from_pdf(pdf_path)
            
            if not images:
                print("未能从PDF中提取到图像")
                return []
            
            results = []
            
            for i, image in enumerate(images):
                print(f"处理第 {i+1} 页...")
                
                # OCR识别
                text = self.ocr_image(image, lang)
                
                if text:
                    results.append({
                        'page': i + 1,
                        'text': text,
                        'image_shape': image.shape
                    })
                    print(f"第 {i+1} 页识别成功，文本长度: {len(text)}")
                else:
                    print(f"第 {i+1} 页识别失败")
            
            print(f"OCR处理完成，成功处理 {len(results)} 页")
            return results
            
        except Exception as e:
            print(f"OCR处理PDF失败: {str(e)}")
            return []
    
    def save_ocr_results(self, results: List[Dict[str, Any]], output_path: str):
        """保存OCR结果到文本文件"""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                for result in results:
                    f.write(f"=== 第 {result['page']} 页 ===\n")
                    f.write(result['text'])
                    f.write('\n\n')
            
            print(f"OCR结果已保存到: {output_path}")
            
        except Exception as e:
            print(f"保存OCR结果失败: {str(e)}")
    
    def create_text_document(self, results: List[Dict[str, Any]]) -> str:
        """将OCR结果转换为文档格式"""
        try:
            document_text = ""
            
            for result in results:
                document_text += f"第 {result['page']} 页:\n"
                document_text += result['text']
                document_text += "\n\n"
            
            return document_text
            
        except Exception as e:
            print(f"创建文档失败: {str(e)}")
            return ""

# 创建全局实例
ocr_processor = OCRProcessor() 