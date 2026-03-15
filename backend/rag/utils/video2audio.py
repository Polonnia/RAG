import os
import subprocess
from pathlib import Path
from moviepy.editor import VideoFileClip
import aiofiles

UPLOAD_DIR = Path('uploads')
AUDIO_DIR = Path('audio')
UPLOAD_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)

SAMPLE_RATE = 16000

class VideoProcessor:
    @staticmethod
    async def save_uploaded_video(file_data: bytes, filename: str) -> Path:
        '''保存上传的视频文件'''
        file_path = UPLOAD_DIR / filename
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_data) 
               
        return file_path
    
    @staticmethod
    def get_video_info(video_path: Path) -> dict:
        """
        获取视频信息
        """
        try:
            with VideoFileClip(str(video_path)) as video:
                return {
                    "duration": video.duration,  # 时长（秒）
                    "fps": video.fps,            # 帧率
                    "size": video.size,           # 尺寸 [width, height]
                    "audio_exists": video.audio is not None
                }
        except Exception as e:
            return {"error": str(e)}
    
    @staticmethod
    def cleanup_file(file_path: Path):
        """清理临时文件"""
        if file_path.exists():
            file_path.unlink()
            
class AudioConverter:
    @staticmethod
    def extract_audio_from_video(video_path: Path) -> Path:
        """
        从视频中提取音频并转换为指定格式
        """
        audio_filename = video_path.stem + '.wav'
        audio_path = AUDIO_DIR / audio_filename
        return AudioConverter._convert(video_path, audio_path)
    
    @staticmethod
    def _convert(video_path: Path, audio_path: Path) -> Path:
        """使用MoviePy转换"""
        with VideoFileClip(str(video_path)) as video:
            if video.audio is None:
                raise ValueError("视频没有音频轨道")
            
            # 提取音频并保存为WAV
            audio = video.audio
            audio.write_audiofile(
                str(audio_path),
                fps=SAMPLE_RATE,
                nbytes=2,  # 16-bit
                codec='pcm_s16le'  # WAV格式
            )
        
        return audio_path