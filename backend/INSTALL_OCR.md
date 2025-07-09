# OCR功能安装指南

## 概述

扫描版PDF处理功能需要安装Tesseract OCR引擎。本指南将帮助你在不同操作系统上安装Tesseract。

## Windows安装

### 方法1：使用安装包（推荐）

1. 下载Tesseract安装包：
   - 访问：https://github.com/UB-Mannheim/tesseract/wiki
   - 下载适合你系统的版本（32位或64位）

2. 运行安装程序：
   - 运行下载的.exe文件
   - 选择安装路径（建议：`C:\Program Files\Tesseract-OCR`）
   - 确保勾选"Additional language data"以支持中文

3. 配置环境变量：
   - 右键"此电脑" → "属性" → "高级系统设置" → "环境变量"
   - 在"系统变量"中找到"Path"，点击"编辑"
   - 添加Tesseract安装路径：`C:\Program Files\Tesseract-OCR`
   - 点击"确定"保存

4. 验证安装：
   ```cmd
   tesseract --version
   ```

### 方法2：使用Chocolatey

```cmd
choco install tesseract
```

### 方法3：使用Scoop

```cmd
scoop install tesseract
```

## macOS安装

### 使用Homebrew

```bash
brew install tesseract
brew install tesseract-lang  # 安装语言包
```

### 验证安装

```bash
tesseract --version
```

## Linux安装

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install tesseract-ocr
sudo apt install tesseract-ocr-chi-sim  # 中文简体
sudo apt install tesseract-ocr-eng      # 英文
```

### CentOS/RHEL

```bash
sudo yum install tesseract
sudo yum install tesseract-langpack-chi-sim
```

### 验证安装

```bash
tesseract --version
```

## 安装Python依赖

安装完Tesseract后，还需要安装Python依赖包：

```bash
cd backend
pip install pytesseract==0.3.10 Pillow==10.0.1 opencv-python==4.8.1.78
```

## 测试OCR功能

安装完成后，可以运行测试脚本验证功能：

```bash
cd backend
python test_ocr.py
```

## 常见问题

### 1. Tesseract未找到

**错误信息：** `TesseractNotFoundError: tesseract is not installed or it's not in your PATH`

**解决方案：**
- 确保Tesseract已正确安装
- 检查环境变量PATH是否包含Tesseract路径
- 重启命令行或IDE

### 2. 中文识别效果差

**解决方案：**
- 确保安装了中文语言包：`tesseract-ocr-chi-sim`
- 使用高质量扫描的PDF
- 调整图像预处理参数

### 3. 内存不足

**解决方案：**
- 减少同时处理的PDF页数
- 降低图像分辨率
- 增加系统虚拟内存

## 性能优化

### 1. 图像预处理优化

- 调整去噪参数
- 优化二值化阈值
- 使用更高质量的图像

### 2. OCR参数优化

- 选择合适的PSM模式
- 调整字符白名单
- 使用GPU加速（如果可用）

## 支持的语言

当前支持的语言：
- 中文简体 (chi_sim)
- 英文 (eng)
- 其他语言可根据需要添加

## 注意事项

1. **处理时间**：OCR处理比普通PDF解析慢，请耐心等待
2. **识别准确率**：扫描质量直接影响识别准确率
3. **文件大小**：大文件处理时间较长
4. **系统资源**：OCR处理需要较多内存和CPU资源

## 故障排除

如果遇到问题，请检查：

1. Tesseract是否正确安装
2. 环境变量是否正确配置
3. Python依赖是否完整安装
4. 系统是否有足够的内存和磁盘空间

## 联系支持

如果问题仍然存在，请提供：
- 操作系统版本
- Tesseract版本
- 错误日志
- 测试文件（如果可能） 