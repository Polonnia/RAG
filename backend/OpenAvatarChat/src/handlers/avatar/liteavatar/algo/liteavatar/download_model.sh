#!/bin/bash

# download model
echo "Downloading LiteAvatar model files..."

modelscope download --model HumanAIGC-Engineering/LiteAvatarGallery lite_avatar_weights/lm.pb lite_avatar_weights/model_1.onnx lite_avatar_weights/model.pb --local_dir ./

# move file
mv lite_avatar_weights/lm.pb ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/lm/
mv lite_avatar_weights/model_1.onnx ./weights/
mv lite_avatar_weights/model.pb ./weights/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/

# remove folder
rm -rf lite_avatar_weights

echo "All model files downloaded successfully!"
