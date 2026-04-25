'''
调试音频转带时间戳文本的代码
'''

from funasr import AutoModel


SENTENCE_ENDINGS = set('。！？!?；;')
IGNORED_CHARS = set('，。、！？；：、“”‘’（）()【】[]《》〈〉…,.!?;:\"\'\n\r\t ')


def format_ms_to_mmss(ms):
    total_seconds = max(0, int(round(float(ms) / 1000)))
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    return f"{minutes:02d}:{seconds:02d}"


def split_sentences(text):
    sentences = []
    buf = []
    for ch in str(text or ''):
        buf.append(ch)
        if ch in SENTENCE_ENDINGS:
            sentence = ''.join(buf).strip()
            if sentence:
                sentences.append(sentence)
            buf = []

    tail = ''.join(buf).strip()
    if tail:
        sentences.append(tail)
    return sentences


def count_timed_units(sentence):
    return sum(1 for ch in sentence if ch not in IGNORED_CHARS)


def extract_sentence_timestamps(result_item):
    text = result_item.get('text', '')
    timestamps = result_item.get('timestamp') or []
    sentences = split_sentences(text)

    mapped = []
    ts_cursor = 0

    for sentence in sentences:
        unit_count = count_timed_units(sentence)
        if unit_count <= 0:
            continue

        if ts_cursor >= len(timestamps):
            break

        start_idx = ts_cursor
        end_idx = min(ts_cursor + unit_count - 1, len(timestamps) - 1)
        start_ms = timestamps[start_idx][0]
        end_ms = timestamps[end_idx][1]

        mapped.append({
            'sentence': sentence,
            'start_ms': start_ms,
            'end_ms': end_ms,
            'start_mmss': format_ms_to_mmss(start_ms),
            'end_mmss': format_ms_to_mmss(end_ms),
        })

        ts_cursor += unit_count

    return mapped

def transcribe_with_timestamps(audio_path):
    # 初始化模型
    model = AutoModel(
            model="paraformer-zh",
            vad_model="fsmn-vad",
            punc_model="ct-punc",
            # 长音频处理参数
            vad_kwargs={"max_single_segment_time": 30000},  # 30秒切片
            device="cpu",  # 或"cuda:0，注意pytorch要安装cuda版本"
            disable_update=True
        )
    
    # 执行识别
    results = model.generate(input=audio_path,output_sentence_timestamp=True)
    
    # result返回一个字典列表，每个字典包含：   
    # text: 识别出的文本内容
    # timestamp: 时间戳信息，包含每个字词的开始和结束时间
    # text_postprocessed: 经过后处理(如标点恢复)的文本
    
    # 处理结果
    print(results)
    for result in results:
        sentence_times = extract_sentence_timestamps(result)
        print('\n按句时间轴（分:秒）:')
        for idx, item in enumerate(sentence_times, start=1):
            print(f"{idx}. [{item['start_mmss']} - {item['end_mmss']}] {item['sentence']}")

    # for result in results:
    #     print(f"识别文本: {result['text']}")
    #     print("时间戳详情:")
    #     print(result['timestamp'])
        # for seg in result['timestamp']:
        #     print(f"{seg['text']} ({seg['start']:.2f}s-{seg['end']:.2f}s)")
    
    return results
 
if __name__ == "__main__":
    audio_file = "C:/Users/1haha/Music/test.mp3"
    transcription = transcribe_with_timestamps(audio_file)