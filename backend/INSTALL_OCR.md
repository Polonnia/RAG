# OCR���ܰ�װָ��

## ����

ɨ���PDF��������Ҫ��װTesseract OCR���档��ָ�Ͻ��������ڲ�ͬ����ϵͳ�ϰ�װTesseract��

## Windows��װ

### ����1��ʹ�ð�װ�����Ƽ���

1. ����Tesseract��װ����
   - ���ʣ�https://github.com/UB-Mannheim/tesseract/wiki
   - �����ʺ���ϵͳ�İ汾��32λ��64λ��

2. ���а�װ����
   - �������ص�.exe�ļ�
   - ѡ��װ·�������飺`C:\Program Files\Tesseract-OCR`��
   - ȷ����ѡ"Additional language data"��֧������

3. ���û���������
   - �Ҽ�"�˵���" �� "����" �� "�߼�ϵͳ����" �� "��������"
   - ��"ϵͳ����"���ҵ�"Path"�����"�༭"
   - ���Tesseract��װ·����`C:\Program Files\Tesseract-OCR`
   - ���"ȷ��"����

4. ��֤��װ��
   ```cmd
   tesseract --version
   ```

### ����2��ʹ��Chocolatey

```cmd
choco install tesseract
```

### ����3��ʹ��Scoop

```cmd
scoop install tesseract
```

## macOS��װ

### ʹ��Homebrew

```bash
brew install tesseract
brew install tesseract-lang  # ��װ���԰�
```

### ��֤��װ

```bash
tesseract --version
```

## Linux��װ

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install tesseract-ocr
sudo apt install tesseract-ocr-chi-sim  # ���ļ���
sudo apt install tesseract-ocr-eng      # Ӣ��
```

### CentOS/RHEL

```bash
sudo yum install tesseract
sudo yum install tesseract-langpack-chi-sim
```

### ��֤��װ

```bash
tesseract --version
```

## ��װPython����

��װ��Tesseract�󣬻���Ҫ��װPython��������

```bash
cd backend
pip install pytesseract==0.3.10 Pillow==10.0.1 opencv-python==4.8.1.78
```

## ����OCR����

��װ��ɺ󣬿������в��Խű���֤���ܣ�

```bash
cd backend
python test_ocr.py
```

## ��������

### 1. Tesseractδ�ҵ�

**������Ϣ��** `TesseractNotFoundError: tesseract is not installed or it's not in your PATH`

**���������**
- ȷ��Tesseract����ȷ��װ
- ��黷������PATH�Ƿ����Tesseract·��
- ���������л�IDE

### 2. ����ʶ��Ч����

**���������**
- ȷ����װ���������԰���`tesseract-ocr-chi-sim`
- ʹ�ø�����ɨ���PDF
- ����ͼ��Ԥ�������

### 3. �ڴ治��

**���������**
- ����ͬʱ�����PDFҳ��
- ����ͼ��ֱ���
- ����ϵͳ�����ڴ�

## �����Ż�

### 1. ͼ��Ԥ�����Ż�

- ����ȥ�����
- �Ż���ֵ����ֵ
- ʹ�ø���������ͼ��

### 2. OCR�����Ż�

- ѡ����ʵ�PSMģʽ
- �����ַ�������
- ʹ��GPU���٣�������ã�

## ֧�ֵ�����

��ǰ֧�ֵ����ԣ�
- ���ļ��� (chi_sim)
- Ӣ�� (eng)
- �������Կɸ�����Ҫ���

## ע������

1. **����ʱ��**��OCR�������ͨPDF�������������ĵȴ�
2. **ʶ��׼ȷ��**��ɨ������ֱ��Ӱ��ʶ��׼ȷ��
3. **�ļ���С**�����ļ�����ʱ��ϳ�
4. **ϵͳ��Դ**��OCR������Ҫ�϶��ڴ��CPU��Դ

## �����ų�

����������⣬���飺

1. Tesseract�Ƿ���ȷ��װ
2. ���������Ƿ���ȷ����
3. Python�����Ƿ�������װ
4. ϵͳ�Ƿ����㹻���ڴ�ʹ��̿ռ�

## ��ϵ֧��

���������Ȼ���ڣ����ṩ��
- ����ϵͳ�汾
- Tesseract�汾
- ������־
- �����ļ���������ܣ� 