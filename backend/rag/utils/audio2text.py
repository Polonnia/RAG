'''
调试音频转带时间戳文本的代码
'''

from funasr import AutoModel

def transcribe_with_timestamps(audio_path):
    # 初始化模型
    model = AutoModel(
        model='iic/speech_paraformer-large-vad-punc-spk_asr_nat-zh-cn',
        timestamp_model=True,
        device = 'cuda'  # 如果有GPU可用，使用GPU加速，否则使用CPU
    )
    
    # 执行识别
    results = model.generate(input=audio_path)
    
    # result返回一个字典列表，每个字典包含：   
    # text: 识别出的文本内容
    # timestamp: 时间戳信息，包含每个字词的开始和结束时间
    # text_postprocessed: 经过后处理(如标点恢复)的文本
    
    # 处理结果
    print(len(results))
    for result in results:
        print(f"识别文本: {result['text']}")
        print("时间戳详情:")
        print(result['timestamp'])
        # for seg in result['timestamp']:
        #     print(f"{seg['text']} ({seg['start']:.2f}s-{seg['end']:.2f}s)")
    
    return results
 
if __name__ == "__main__":
    audio_file = "C:/Users/1haha/Music/20250501_145955.wav"
    transcription = transcribe_with_timestamps(audio_file)