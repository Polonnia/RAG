@echo off
REM Download LiteAvatar model files using modelscope

echo Downloading LiteAvatar model files...

modelscope download --model HumanAIGC-Engineering/LiteAvatarGallery lite_avatar_weights/lm.pb lite_avatar_weights/model_1.onnx lite_avatar_weights/model.pb --local_dir ./
if %errorlevel% neq 0 (
    echo Error downloading lite_avatar_weights
    pause
    exit /b 1
)

@REM move file
move lite_avatar_weights\lm.pb ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/lm/
move lite_avatar_weights\model_1.onnx ./weights/
move lite_avatar_weights\model.pb ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/

@REM remove folder
rmdir lite_avatar_weights

echo All model files downloaded successfully!
