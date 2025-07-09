import React, { useState, useEffect } from 'react';
import { Layout, Upload, Button, Input, message, Typography, Spin, Tabs, Card, Space, List, Popconfirm, Tag, Divider, Select, Collapse, Modal, Form, Radio, Checkbox, Progress, Steps, Result, Table, InputNumber } from 'antd';
import { UploadOutlined, BookOutlined, FileTextOutlined, ClockCircleOutlined, DeleteOutlined, EyeOutlined, DatabaseOutlined, FormOutlined, UserOutlined, LoginOutlined, LogoutOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import ExamDetail from './ExamDetail';
import ReactMarkdown from 'react-markdown';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;
const { Panel } = Collapse;
const { Step } = Steps;

function App() {
  // 认证状态
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  });
  const [loginVisible, setLoginVisible] = useState(false);
  const [registerVisible, setRegisterVisible] = useState(false);

  // 文件上传状态
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);

  // 知识库问答状态
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(() => localStorage.getItem('qa_answer') || '');
  const [qaSources, setQaSources] = useState(() => {
    try {
      const src = localStorage.getItem('qa_sources');
      return src ? JSON.parse(src) : [];
    } catch {
      return [];
    }
  });

  // 教学内容设计状态
  const [courseOutline, setCourseOutline] = useState('');
  const [teachingPlan, setTeachingPlan] = useState(''); // 只显示知识框架
  const [pptDetailContent, setPptDetailContent] = useState(''); // 只用于PPT生成，不显示
  const [pptLoading, setPptLoading] = useState(false);
  const [pptStep, setPptStep] = useState('');
  const [planLoading, setPlanLoading] = useState(false);

  // 考核内容生成状态
  const [examOutline, setExamOutline] = useState('');
  const [examContent, setExamContent] = useState(null);
  const [examLoading, setExamLoading] = useState(false);

  // 考试管理状态
  const [exams, setExams] = useState([]);
  const [examModalVisible, setExamModalVisible] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [examForm] = Form.useForm();

  // 学生考试状态
  const [studentExams, setStudentExams] = useState([]);
  const [currentExam, setCurrentExam] = useState(null);
  const [examAnswers, setExamAnswers] = useState({});
  const [examTimer, setExamTimer] = useState(0);
  const [examInProgress, setExamInProgress] = useState(false);

  // 知识库管理状态
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [fileLoading, setFileLoading] = useState(false);

  // 历史记录状态
  const [qaHistory, setQaHistory] = useState([]);
  const [teachingPlanHistory, setTeachingPlanHistory] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [historyModal, setHistoryModal] = useState({ visible: false, type: '', record: null });

  // 题型配置state
  const [questionConfig, setQuestionConfig] = useState({
    choice: { enabled: true, count: 5, points: 2 },
    multi: { enabled: false, count: 0, points: 3 },
    fill_blank: { enabled: true, count: 2, points: 4 },
    short_answer: { enabled: true, count: 2, points: 5 },
    programming: { enabled: false, count: 0, points: 10 }
  });
  const [selectedQuestions, setSelectedQuestions] = useState([]); // 勾选的题目

  const [gradingList, setGradingList] = useState([]);
  const [gradingLoading, setGradingLoading] = useState(false);

  const [activeTeacherTab, setActiveTeacherTab] = useState('1');

  const navigate = useNavigate();

  // 题型中英文映射
  const questionTypeMap = {
    choice: '单选题',
    multi: '多选题',
    fill_blank: '填空题',
    short_answer: '简答题',
    programming: '编程题'
  };

  // 设置axios默认headers
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      checkAuthStatus();
    }
  }, []);

  // 定时检查token有效性
  useEffect(() => {
    if (isLoggedIn) {
      const interval = setInterval(() => {
        checkAuthStatus();
      }, 10 * 60 * 1000); // 每10分钟检查一次
      
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // 直接请求一个需要认证的接口（如获取教师考试列表）
        try {
          const response = await axios.get('http://localhost:8000/teacher/exams');
          // 如果token有效，接口会返回考试列表
          // 可以从localStorage拿user信息
        const user = JSON.parse(localStorage.getItem('user'));
          setCurrentUser(user);
          setIsLoggedIn(true);
          fetchData();
        } catch (error) {
          // token无效或过期，自动登出
          console.error('Token验证失败:', error);
          logout();
        }
      }
    } catch (error) {
      console.error('验证失败:', error);
      logout();
    }
  };

  const fetchData = async () => {
    if (currentUser?.role === 'teacher') {
      fetchKnowledgeFiles();
      fetchTeacherExams();
    } else if (currentUser?.role === 'student') {
      fetchStudentExams();
    }
  };

  // 认证相关函数
  const handleLogin = async (values) => {
    try {
      const formData = new FormData();
      formData.append('username', values.username);
      formData.append('password', values.password);
      
      const response = await axios.post('http://localhost:8000/login', formData);
      
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      
      setCurrentUser(response.data.user);
      setIsLoggedIn(true);
      setLoginVisible(false);
      
      message.success('登录成功');
      fetchData();
    } catch (error) {
      message.error('登录失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleRegister = async (values) => {
    try {
      const formData = new FormData();
      formData.append('username', values.username);
      formData.append('password', values.password);
      formData.append('role', values.role);
      
      const response = await axios.post('http://localhost:8000/register', formData);
      
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      
      setCurrentUser(response.data.user);
      setIsLoggedIn(true);
      setRegisterVisible(false);
      
      message.success('注册成功');
      fetchData();
    } catch (error) {
      message.error('注册失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('qa_answer');
    localStorage.removeItem('qa_sources');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setIsLoggedIn(false);
    setAnswer('');
    setQaSources([]);
    message.success('已退出登录');
  };

  // 知识库管理函数
  const fetchKnowledgeFiles = async () => {
    setFileLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/knowledge-files');
      setKnowledgeFiles(response.data.files);
    } catch (err) {
      console.error('获取文件列表失败:', err);
      message.error('获取知识库文件列表失败');
    }
    setFileLoading(false);
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }
    const formData = new FormData();
    fileList.forEach(file => {
      formData.append('files', file);
    });
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      
      if (response.data.results) {
        const results = response.data.results;
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        if (errorCount === 0) {
          message.success(response.data.msg);
        } else if (successCount === 0) {
          message.error(response.data.error);
        } else {
          message.warning(response.data.msg);
        }
        
        results.forEach(result => {
          if (result.status === 'success') {
            message.success(`${result.filename}: ${result.msg}`);
          } else {
            message.error(`${result.filename}: ${result.msg}`);
          }
        });
      } else {
        message.success(response.data.msg);
      }
      
      setFileList([]);
      fetchKnowledgeFiles();
    } catch (err) {
      console.error('上传错误:', err);
      if (err.response) {
        message.error(`上传失败: ${err.response.data.error || err.response.statusText}`);
      } else if (err.code === 'ECONNABORTED') {
        message.error('上传超时，请稍后重试');
      } else {
        message.error('上传失败，请检查网络连接');
      }
    }
    setLoading(false);
  };

  const handleDeleteFile = async (filename) => {
    try {
      await axios.delete(`http://localhost:8000/delete-file/${encodeURIComponent(filename)}`);
      message.success('文件删除成功');
      fetchKnowledgeFiles();
    } catch (err) {
      console.error('删除失败:', err);
      if (err.response) {
        message.error(`删除失败: ${err.response.data.error || err.response.statusText}`);
      } else {
        message.error('删除失败，请检查网络连接');
      }
    }
  };

  // 拉取历史记录
  useEffect(() => {
    if (isLoggedIn) {
      fetchQaHistory();
      fetchTeachingPlanHistory();
      fetchExamHistory();
    }
  }, [isLoggedIn]);

  const fetchQaHistory = async () => {
    try {
      const res = await axios.get('http://localhost:8000/qa-history');
      setQaHistory(res.data);
    } catch {}
  };
  const fetchTeachingPlanHistory = async () => {
    try {
      const res = await axios.get('http://localhost:8000/teaching-plan-history');
      setTeachingPlanHistory(res.data);
      console.log('teachingPlanHistory', res.data);
    } catch (e) {
      console.error('teachingPlanHistory error', e);
    }
  };
  const fetchExamHistory = async () => {
    try {
      const res = await axios.get('http://localhost:8000/exam-history');
      setExamHistory(res.data);
    } catch {}
  };

  // 1. 新增删除历史记录的函数
  const handleDeleteQaHistory = async (id) => {
    console.log('delete qa history id:', id);
    if (!id || isNaN(Number(id))) {
      message.error('记录ID无效，无法删除');
      return;
    }
    try {
      await axios.delete(`http://localhost:8000/qa-history/${id}`);
      message.success('删除成功');
      fetchQaHistory();
    } catch (e) {
      message.error('删除失败');
      console.error(e);
    }
  };
  const handleDeleteTeachingPlanHistory = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/teaching-plan-history/${id}`);
      message.success('删除成功');
      fetchTeachingPlanHistory();
    } catch (e) {
      message.error('删除失败');
    }
  };
  const handleDeleteExamHistory = async (id) => {
    console.log('delete exam history id:', id);
    try {
      await axios.delete(`http://localhost:8000/exam-history/${id}`);
      message.success('删除成功');
      fetchExamHistory();
    } catch (e) {
      message.error('删除失败');
      console.error(e);
    }
  };

  // 修改知识库问答
  const handleAsk = async () => {
    if (!question) {
      message.warning('请输入问题');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('question', question);
      const res = await axios.post('http://localhost:8000/qa', formData);
      setAnswer(res.data.answer);
      setQaSources(res.data.sources || []);
      // 存入localStorage
      localStorage.setItem('qa_answer', res.data.answer);
      localStorage.setItem('qa_sources', JSON.stringify(res.data.sources || []));
      // 保存历史到后端
      await axios.post('http://localhost:8000/qa-history', new URLSearchParams({ question, answer: res.data.answer }));
      fetchQaHistory();
    } catch (err) {
      console.error('问答失败:', err);
      if (err.response) {
        message.error(`问答失败: ${err.response.data.error || err.response.statusText}`);
      } else {
        message.error('问答失败，请检查网络连接');
      }
    }
    setLoading(false);
  };

  // 修改教学内容设计
  const handleDesignTeachingPlan = async () => {
    if (!courseOutline.trim()) {
      message.warning('请输入课程大纲');
      return;
    }
    setPlanLoading(true);
    try {
      const formData = new FormData();
      formData.append('course_outline', courseOutline);
      const response = await axios.post('http://localhost:8000/design-teaching-plan', formData, {
        timeout: 120000,
      });
      setTeachingPlan(response.data.plan); // 只显示知识框架
      // 保存历史到后端
      await axios.post('http://localhost:8000/teaching-plan-history', new URLSearchParams({ outline: courseOutline, plan: response.data.plan }));
      fetchTeachingPlanHistory();
      message.success('教学内容设计完成');
    } catch (err) {
      console.error('设计失败:', err);
      if (err.response) {
        message.error(`设计失败: ${err.response.data.error || err.response.statusText}`);
      } else {
        message.error('设计失败，请检查网络连接');
      }
    }
    setPlanLoading(false);
  };

  // 生成PPT时，先请求详细内容，再传给PPT agent
  const handleGeneratePPTFromOutline = async () => {
    if (!teachingPlan) {
      message.warning('请先生成教学内容');
      return;
    }
    setPptLoading(true);
    setPptStep('正在生成详细内容...');
    try {
      const formData = new FormData();
      formData.append('outline', teachingPlan);
      const detailRes = await axios.post('http://localhost:8000/generate-teaching-detail', formData, { timeout: 180000 });
      setPptDetailContent(detailRes.data.detail); // 不显示，仅用于PPT

      setPptStep('正在生成PPT...');
      // 传给PPT agent
      const pptForm = new FormData();
      pptForm.append('outline', detailRes.data.detail);
      const pptRes = await axios.post('http://localhost:8000/teacher/generate-ppt-from-outline', pptForm, { responseType: 'blob' });

      // 下载PPT
      const url = window.URL.createObjectURL(new Blob([pptRes.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'teaching-outline.pptx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      message.success('PPT生成成功');
    } catch (err) {
      console.error('PPT生成失败:', err);
      message.error('PPT生成失败');
    }
    setPptLoading(false);
    setPptStep('');
  };

  // 修改考核内容生成
  const handleGenerateExam = async () => {
    if (!examOutline.trim()) {
      message.warning('请输入课程大纲');
      return;
    }
    setExamLoading(true);
    try {
      const formData = new FormData();
      formData.append('course_outline', examOutline);
      formData.append('question_config', JSON.stringify(questionConfig));
      const response = await axios.post('http://localhost:8000/generate-exam', formData, {
        timeout: 180000,
      });
      setExamContent(response.data.exam_content);
      setSelectedQuestions([]); // 清空勾选
      // 保存历史到后端
      await axios.post('http://localhost:8000/exam-history', new URLSearchParams({ outline: examOutline, exam_content: JSON.stringify(response.data.exam_content) }));
      fetchExamHistory();
      message.success('考核内容生成完成');
    } catch (err) {
      console.error('生成失败:', err);
      if (err.response) {
        if (err.response.status === 401) {
          message.error('认证失败，请重新登录');
          logout();
        } else {
        message.error(`生成失败: ${err.response.data.error || err.response.statusText}`);
        }
      } else {
        message.error('生成失败，请检查网络连接');
      }
    }
    setExamLoading(false);
  };

  // 考试管理函数（教师端）
  const fetchTeacherExams = async () => {
    try {
      const response = await axios.get('http://localhost:8000/teacher/exams');
      setExams(response.data.exams);
    } catch (err) {
      console.error('获取考试列表失败:', err);
    }
  };

  const handleCreateExam = async (values) => {
    try {
      // 合并所有题型
      const allQuestions = [
        ...(examContent.concept_questions || []).map(q => ({ ...q, type: 'choice' })),
        ...(examContent.multi_questions || []).map(q => ({ ...q, type: 'multi' })),
        ...(examContent.fill_blank_questions || []).map(q => ({ ...q, type: 'fill_blank' })),
        ...(examContent.short_answer_questions || []).map(q => ({ ...q, type: 'short_answer' })),
        ...(examContent.programming_questions || []).map(q => ({ ...q, type: 'programming' })),
      ];
      const selected = selectedQuestions.map(idx => allQuestions[idx]);
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('description', values.description);
      formData.append('duration', values.duration);
      formData.append('questions_data', JSON.stringify(selected));
      await axios.post('http://localhost:8000/create-exam', formData);
      message.success('考试创建成功');
      setExamModalVisible(false);
      examForm.resetFields();
      fetchTeacherExams();
    } catch (err) {
      console.error('创建考试失败:', err);
      message.error('创建考试失败');
    }
  };

  // 学生考试函数
  const fetchStudentExams = async () => {
    try {
      const response = await axios.get('http://localhost:8000/student/exams');
      setStudentExams(response.data.exams);
    } catch (err) {
      console.error('获取考试列表失败:', err);
    }
  };

  const startExam = async (examId) => {
    try {
      const response = await axios.get(`http://localhost:8000/student/exam/${examId}`);
      setCurrentExam(response.data);
      setExamInProgress(true);
      setExamTimer(response.data.exam.duration * 60); // 转换为秒
      setExamAnswers({});
    } catch (err) {
      console.error('获取考试失败:', err);
      message.error('获取考试失败');
    }
  };

  const submitExam = async () => {
    try {
      const formData = new FormData();
      formData.append('exam_id', currentExam.exam.id);
      formData.append('answers_data', JSON.stringify(examAnswers));
      
      const response = await axios.post('http://localhost:8000/student/submit-exam', formData);
      message.success(`考试提交成功！得分：${response.data.score}`);
      setExamInProgress(false);
      setCurrentExam(null);
      setExamAnswers({});
      setExamTimer(0);
      fetchStudentExams();
    } catch (err) {
      console.error('提交考试失败:', err);
      message.error('提交考试失败');
    }
  };

  // 计时器效果
  useEffect(() => {
    let interval;
    if (examInProgress && examTimer > 0) {
      interval = setInterval(() => {
        setExamTimer(prev => {
          if (prev <= 1) {
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [examInProgress, examTimer]);

  // 其他辅助函数
  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList.map(file => file.originFileObj || file));
  };

  const getFileTypeTag = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
      'pdf': { color: 'red', text: 'PDF' },
      'doc': { color: 'blue', text: 'Word' },
      'docx': { color: 'blue', text: 'Word' }
    };
    return typeMap[ext] || { color: 'default', text: '文件' };
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染函数
  const renderLoginModal = () => (
    <Modal
      title="用户登录"
      open={loginVisible}
      onCancel={() => setLoginVisible(false)}
      footer={null}
    >
      <Form onFinish={handleLogin} layout="vertical">
        <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderRegisterModal = () => (
    <Modal
      title="用户注册"
      open={registerVisible}
      onCancel={() => setRegisterVisible(false)}
      footer={null}
    >
      <Form onFinish={handleRegister} layout="vertical">
        <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="role" label="角色" rules={[{ required: true }]}>
          <Select>
            <Option value="teacher">教师</Option>
            <Option value="student">学生</Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            注册
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );

  const renderTeacherInterface = () => (
    <Tabs defaultActiveKey="1" activeKey={activeTeacherTab} onChange={key => {
      setActiveTeacherTab(key);
      if (key === 'grading') fetchGradingList();
    }} size="large">
      <TabPane tab={<span><DatabaseOutlined />知识库管理</span>} key="1">
        <Card title="上传教学文档" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              支持格式：PDF、Word文档(.doc/.docx)
            </Text>
          </div>
        <Upload
            beforeUpload={() => false}
            fileList={fileList.map((file, index) => ({
              uid: index,
              name: file.name || `文件${index + 1}`,
              status: 'done',
            }))}
            onChange={handleFileChange}
            multiple={true}
          accept=".pdf,.doc,.docx"
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <Button type="primary" onClick={handleUpload} style={{ marginTop: 16 }} loading={loading}>
            上传并入库 ({fileList.length} 个文件)
          </Button>
        </Card>

        <Divider />

        <Card title="知识库文件列表" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 16 }}>
            <Button onClick={fetchKnowledgeFiles} loading={fileLoading} icon={<EyeOutlined />}>
              刷新列表
            </Button>
            <Text style={{ marginLeft: 16, color: '#666' }}>
              共 {knowledgeFiles.length} 个文件
            </Text>
          </div>
          
          {fileLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>加载中...</div>
            </div>
          ) : knowledgeFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无文件，请先上传文档
            </div>
          ) : (
            <List
              dataSource={knowledgeFiles}
              renderItem={(file) => {
                const fileType = getFileTypeTag(file.filename);
                return (
                  <List.Item
                    actions={[
                      <Popconfirm
                        title="确定要删除这个文件吗？"
                        description="删除后将从知识库中移除，无法恢复"
                        onConfirm={() => handleDeleteFile(file.filename)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button 
                          type="text" 
                          danger 
                          icon={<DeleteOutlined />}
                          size="small"
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{file.filename}</span>
                          <Tag color={fileType.color}>{fileType.text}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size="small">
                          <Text type="secondary">上传时间: {file.upload_time}</Text>
                          <Text type="secondary">文档片段: {file.chunk_count} 个</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </Card>
      </TabPane>

      <TabPane tab={<span><BookOutlined />知识库问答</span>} key="2">
        <Card title="知识库问答" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
          <TextArea
            rows={3}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="请输入你的问题..."
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" onClick={handleAsk} loading={loading}>
            提问
          </Button>
          <div style={{ marginTop: 16, minHeight: 60 }}>
            {loading ? <Spin /> : answer && (
              <div style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
                <Text strong>AI助手：</Text>
                <ReactMarkdown style={{ marginTop: 8, marginBottom: 16 }}>{answer}</ReactMarkdown>
                {qaSources.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text strong>溯源片段：</Text>
                    {qaSources.map((src, idx) => (
                      <div key={idx} style={{ margin: '12px 0', background: '#e6f7ff', borderRadius: 4, padding: 8 }}>
                        <div style={{ fontSize: 13, color: '#888' }}>
                          <b>文档：</b>{src.metadata?.source || src.metadata?.doc_id || '-'}
                          <span> <b>页码：</b>
                            {src.metadata?.page_num || src.metadata?.page || '-'}
                          </span>
                          {typeof src.metadata?.start_pos === 'number' && typeof src.metadata?.end_pos === 'number' && (
                            <span> <b>位置：</b>{src.metadata.start_pos}~{src.metadata.end_pos}</span>
                          )}
                        </div>
                        <div style={{ background: '#fffbe6', borderRadius: 3, padding: 6, marginTop: 4, fontSize: 15 }}>
                          <ReactMarkdown>{src.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="历史记录" style={{ marginTop: 24, maxWidth: 1200, margin: '0 auto' }}>
          <List
            dataSource={qaHistory}
            renderItem={item => (
              <List.Item
                actions={[
                  <Popconfirm title="确定删除该条记录吗？" onConfirm={() => handleDeleteQaHistory(item.id)} okText="删除" cancelText="取消">
                    <Button type="link" icon={<DeleteOutlined />} danger>删除</Button>
                  </Popconfirm>
                ]}
              >
                <a onClick={() => setHistoryModal({ visible: true, type: 'qa', record: item })}>
                  {item.question}（{item.time}）
                </a>
              </List.Item>
            )}
          />
        </Card>
      </TabPane>

      <TabPane tab={<span><FileTextOutlined />教学内容设计</span>} key="3">
        <Card title="课程大纲输入" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
          <TextArea
            rows={6}
            value={courseOutline}
            onChange={e => setCourseOutline(e.target.value)}
            placeholder="请输入课程大纲，包括：\n1. 课程目标\n2. 主要知识点\n3. 教学要求\n4. 学时安排等"
            style={{ marginBottom: 16 }}
          />
          <Space>
            <Button type="primary" onClick={handleDesignTeachingPlan} loading={planLoading} icon={<FileTextOutlined />}>
              设计教学内容
            </Button>
            <Button onClick={() => setCourseOutline('')}>
              清空大纲
            </Button>
          </Space>
        </Card>

        {teachingPlan && (
          <Card title="教学内容设计结果（知识框架）" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
            <ReactMarkdown>{teachingPlan}</ReactMarkdown>
            <Space style={{ marginTop: 16 }}>
              <Button type="primary" onClick={handleGeneratePPTFromOutline} disabled={!teachingPlan}>一键将大纲生成PPT</Button>
              <Upload
                accept=".md,.txt"
                showUploadList={false}
                customRequest={handleGeneratePPTFromUpload}
              >
                <Button>上传txt/md生成PPT</Button>
              </Upload>
            </Space>
          </Card>
        )}

        <Card title="历史记录" style={{ marginTop: 24, maxWidth: 1200, margin: '0 auto' }}>
          <List
            dataSource={teachingPlanHistory}
            renderItem={item => (
              <List.Item
                actions={[
                  <Popconfirm title="确定删除该条记录吗？" onConfirm={() => handleDeleteTeachingPlanHistory(item.id)} okText="删除" cancelText="取消">
                    <Button type="link" icon={<DeleteOutlined />} danger>删除</Button>
                  </Popconfirm>
                ]}
              >
                <a onClick={() => {
                  setCourseOutline(item.outline);
                  setTeachingPlan(item.plan);
                  setHistoryModal({ visible: false, type: '', record: null });
                }}>
                  {item.outline}（{item.time}）
                </a>
              </List.Item>
            )}
          />
        </Card>
      </TabPane>

      <TabPane tab={<span><FormOutlined />考核内容生成</span>} key="4">
        {/* 题型设置表单 */}
        {renderQuestionConfigForm()}
        <Card title="课程大纲输入" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
          <TextArea
            rows={6}
            value={examOutline}
            onChange={e => setExamOutline(e.target.value)}
            placeholder="请输入课程大纲，包括：\n1. 课程目标\n2. 主要知识点\n3. 教学要求\n4. 学时安排等"
            style={{ marginBottom: 16 }}
          />
          <Space>
            <Button type="primary" onClick={handleGenerateExam} loading={examLoading} icon={<FormOutlined />}>
              生成考核内容
            </Button>
            <Button onClick={() => setExamOutline('')}>
              清空大纲
            </Button>
          </Space>
        </Card>
        {/* 生成后题目勾选渲染 */}
        {renderGeneratedQuestions()}

        <Card title="历史记录" style={{ marginTop: 24, maxWidth: 1200, margin: '0 auto' }}>
          <List
            dataSource={examHistory}
            renderItem={item => (
              <List.Item
                actions={[
                  <Popconfirm title="确定删除该条记录吗？" onConfirm={() => handleDeleteExamHistory(item.id)} okText="删除" cancelText="取消">
                    <Button type="link" icon={<DeleteOutlined />} danger>删除</Button>
                  </Popconfirm>
                ]}
              >
                <a onClick={() => {
                  setExamContent(item.examContent);
                  setHistoryModal({ visible: false, type: '', record: null });
                }}>
                  {item.outline}（{item.time}）
                </a>
              </List.Item>
              )}
          />
          </Card>
      </TabPane>

      <TabPane tab={<span><FormOutlined />考试管理</span>} key="5">
        <Card title="考试列表" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
          <List
            dataSource={exams}
            renderItem={(exam) => (
              <List.Item
                actions={[
                  <Button 
                    type="link" 
                    onClick={() => navigate(`/exam/${exam.id}`)}
                  >
                    查看详情
        </Button>
                ]}
              >
                <List.Item.Meta
                  title={exam.title}
                  description={
                    <Space direction="vertical" size="small">
                      <Text>{exam.description}</Text>
                      <Text type="secondary">时长: {exam.duration} 分钟</Text>
                      <Text type="secondary">参与学生: {exam.student_count} 人</Text>
                      <Text type="secondary">创建时间: {exam.created_at}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </TabPane>

      <TabPane tab={<span><CheckCircleOutlined />待批改试卷</span>} key="grading">
        <Card title={<span style={{ fontWeight: 600, fontSize: 18 }}>待批改简答题/编程题</span>} style={{ width: '100%', maxWidth: 1600, margin: '0 auto' }}>
          <Table columns={gradingColumns} dataSource={gradingList} loading={gradingLoading} pagination={{ pageSize: 8 }} bordered rowClassName={(_, idx) => idx % 2 === 0 ? 'table-row-light' : 'table-row-dark'} />
        </Card>
      </TabPane>
    </Tabs>
  );

  const renderStudentInterface = () => (
    <Tabs defaultActiveKey="1" size="large">
      <TabPane tab={<span><BookOutlined />知识库问答</span>} key="1">
        <Card title="知识库问答" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
          <TextArea
            rows={3}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="请输入你的问题..."
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" onClick={handleAsk} loading={loading}>
            提问
          </Button>
          <div style={{ marginTop: 16, minHeight: 60 }}>
            {loading ? <Spin /> : answer && (
              <div style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
                <Text strong>AI助手：</Text>
                <ReactMarkdown style={{ marginTop: 8, marginBottom: 16 }}>{answer}</ReactMarkdown>
                {qaSources.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text strong>溯源片段：</Text>
                    {qaSources.map((src, idx) => (
                      <div key={idx} style={{ margin: '12px 0', background: '#e6f7ff', borderRadius: 4, padding: 8 }}>
                        <div style={{ fontSize: 13, color: '#888' }}>
                          <b>文档：</b>{src.metadata?.source || src.metadata?.doc_id || '-'}
                          <span> <b>页码：</b>
                            {src.metadata?.page_num || src.metadata?.page || '-'}
                          </span>
                          {typeof src.metadata?.start_pos === 'number' && typeof src.metadata?.end_pos === 'number' && (
                            <span> <b>位置：</b>{src.metadata.start_pos}~{src.metadata.end_pos}</span>
                          )}
                        </div>
                        <div style={{ background: '#fffbe6', borderRadius: 3, padding: 6, marginTop: 4, fontSize: 15 }}>
                          <ReactMarkdown>{src.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </TabPane>

      <TabPane tab={<span><FormOutlined />考试系统</span>} key="2">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '80vh', background: '#f5f6fa' }}>
          <div style={{ width: 420, maxWidth: '95vw', marginTop: 32 }}>
            <Card title="可参加的考试" style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 2px 8px #f0f1f2' }} bodyStyle={{ padding: 0 }}>
          <List
            dataSource={studentExams}
                renderItem={exam => (
                  <List.Item style={{ borderBottom: '1px solid #f0f0f0', padding: 20 }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ fontWeight: 'bold', fontSize: 18 }}>{exam.title}</div>
                      <div style={{ color: '#888', margin: '8px 0' }}>{exam.description}</div>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color="blue">时长: {exam.duration} 分钟</Tag>
                        <span style={{ color: '#aaa', marginLeft: 8 }}>创建时间: {exam.created_at?.slice(0, 16)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {exam.completed ? (
                          <>
                    <Tag color="green">已完成</Tag>
                            <span style={{ color: '#52c41a', fontWeight: 'bold' }}>得分: {exam.score}</span>
                            <Button size="small" style={{ marginLeft: 8 }} onClick={() => viewExamResult(exam.id)}>
                              查看结果
                            </Button>
                          </>
                  ) : (
                          <Button type="primary" onClick={() => startExam(exam.id)}>
                      开始考试
                    </Button>
                      )}
                      </div>
                    </div>
              </List.Item>
            )}
          />
        </Card>
          </div>
        </div>
      </TabPane>
    </Tabs>
  );

  const renderExamInterface = () => {
    if (!currentExam) return null;

    return (
      <Card title={`考试：${currentExam.exam.title}`} style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Text strong>剩余时间：</Text>
            <Text type="danger" style={{ fontSize: 18 }}>
              {formatTime(examTimer)}
            </Text>
          </Space>
        </div>

        <Steps current={0} style={{ marginBottom: 24 }}>
          <Step title="答题中" />
          <Step title="提交" />
          <Step title="完成" />
        </Steps>

        <List
          dataSource={currentExam.questions}
          renderItem={(question, index) => (
            <List.Item>
              <Card style={{ width: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>第 {index + 1} 题 ({question.points} 分)</Text>
                  <Tag style={{ marginLeft: 8 }}>{questionTypeMap[question.type] || question.type}</Tag>
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <Text>{question.question}</Text>
                </div>

                {question.type === 'choice' && (
                  <Radio.Group
                    value={examAnswers[question.id]}
                    onChange={(e) => setExamAnswers({
                      ...examAnswers,
                      [question.id]: e.target.value
                    })}
                  >
                    <Space direction="vertical">
                      {Object.entries(question.options).map(([key, value]) => (
                        <Radio key={key} value={key}>
                          {key}. {value}
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                )}

                {question.type === 'fill_blank' && (() => {
                  const blankCount = (question.question.match(/_____/g) || []).length;
                  return (
                    <>
                  <Input
                        placeholder={`请输入答案${blankCount > 1 ? '，多个空用英文分号 ; 分隔' : ''}`}
                    value={examAnswers[question.id] || ''}
                    onChange={(e) => setExamAnswers({
                      ...examAnswers,
                      [question.id]: e.target.value
                    })}
                  />
                      {blankCount > 1 && (
                        <div style={{ color: '#faad14', fontSize: 12, marginTop: 4 }}>
                          多个空请用英文分号 ; 分隔，如：答案1;答案2;答案3
                        </div>
                )}
                    </>
                  );
                })()}

                {(question.type === 'short_answer' || question.type === 'programming') && (
                  <TextArea
                    rows={6}
                    placeholder="请输入答案"
                    value={examAnswers[question.id] || ''}
                    onChange={(e) => setExamAnswers({
                      ...examAnswers,
                      [question.id]: e.target.value
                    })}
                  />
                )}
              </Card>
            </List.Item>
          )}
        />

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Space>
            <Button type="primary" onClick={submitExam}>
              提交考试
            </Button>
            <Button onClick={() => {
              setExamInProgress(false);
              setCurrentExam(null);
              setExamAnswers({});
              setExamTimer(0);
            }}>
              退出考试
        </Button>
          </Space>
        </div>
      </Card>
    );
  };

  // 渲染题目函数
  const renderConceptQuestions = (questions) => {
    if (!questions || questions.length === 0) return <Text type="secondary">暂无概念题</Text>;
    
    return questions.map((q, index) => (
      <Card key={index} size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text strong>{index + 1}. {q.question}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          {Object.entries(q.options || {}).map(([key, value]) => (
            <div key={key} style={{ marginBottom: 4 }}>
              <Text>{key}. {value}</Text>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text type="success" strong>正确答案: {q.correct_answer}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>解析: </Text>
          <Text>{q.explanation}</Text>
        </div>
        <div>
          <Tag color="blue">知识点: {q.knowledge_point}</Tag>
        </div>
      </Card>
    ));
  };

  const renderFillBlankQuestions = (questions) => {
    if (!questions || questions.length === 0) return <Text type="secondary">暂无填空题</Text>;
    
    return questions.map((q, index) => (
      <Card key={index} size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text strong>{index + 1}. {q.question}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text type="success" strong>答案: {q.answer}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>解析: </Text>
          <Text>{q.explanation}</Text>
        </div>
        <div>
          <Tag color="blue">知识点: {q.knowledge_point}</Tag>
        </div>
      </Card>
    ));
  };

  const renderShortAnswerQuestions = (questions) => {
    if (!questions || questions.length === 0) return <Text type="secondary">暂无简答题</Text>;
    
    return questions.map((q, index) => (
      <Card key={index} size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text strong>{index + 1}. {q.question}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>参考答案: </Text>
          <Text>{q.reference_answer}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>评分要点: </Text>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {(q.scoring_points || []).map((point, i) => (
              <li key={i}><Text>{point}</Text></li>
            ))}
          </ul>
        </div>
        <div>
          <Tag color="blue">知识点: {q.knowledge_point}</Tag>
        </div>
      </Card>
    ));
  };

  const renderProgrammingQuestions = (questions) => {
    if (!questions || questions.length === 0) return <Text type="secondary">暂无编程题</Text>;
    
    return questions.map((q, index) => (
      <Card key={index} size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text strong>{index + 1}. {q.question}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>代码要求: </Text>
          <Text>{q.requirements}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>参考答案: </Text>
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: 8, 
            borderRadius: 4, 
            margin: 0,
            fontSize: 12,
            overflow: 'auto'
          }}>
            {q.reference_code}
          </pre>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>解题思路: </Text>
          <Text>{q.explanation}</Text>
        </div>
        <div>
          <Tag color="blue">知识点: {q.knowledge_point}</Tag>
        </div>
      </Card>
    ));
  };

  // 题型配置表单
  const renderQuestionConfigForm = () => (
    <Card title="题型设置" style={{ marginBottom: 24 }}>
      <table style={{ width: '100%', textAlign: 'center' }}>
        <thead>
          <tr>
            <th>题型</th>
            <th>生成</th>
            <th>数量</th>
            <th>分值</th>
          </tr>
        </thead>
        <tbody>
          {[
            { key: 'choice', label: '单选题' },
            { key: 'multi', label: '多选题' },
            { key: 'fill_blank', label: '填空题' },
            { key: 'short_answer', label: '简答题' },
            { key: 'programming', label: '编程题' }
          ].map(item => (
            <tr key={item.key}>
              <td>{item.label}</td>
              <td>
                <Checkbox
                  checked={questionConfig[item.key].enabled}
                  onChange={e => setQuestionConfig({
                    ...questionConfig,
                    [item.key]: { ...questionConfig[item.key], enabled: e.target.checked }
                  })}
                />
              </td>
              <td>
                <Input
                  type="number"
                  min={0}
                  value={questionConfig[item.key].count}
                  disabled={!questionConfig[item.key].enabled}
                  onChange={e => setQuestionConfig({
                    ...questionConfig,
                    [item.key]: { ...questionConfig[item.key], count: Number(e.target.value) }
                  })}
                  style={{ width: 60 }}
                />
              </td>
              <td>
                <Input
                  type="number"
                  min={1}
                  value={questionConfig[item.key].points}
                  disabled={!questionConfig[item.key].enabled}
                  onChange={e => setQuestionConfig({
                    ...questionConfig,
                    [item.key]: { ...questionConfig[item.key], points: Number(e.target.value) }
                  })}
                  style={{ width: 60 }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );

  // 优化生成后题目勾选渲染，分Panel分题型显示
  const renderGeneratedQuestions = () => {
    if (!examContent) return null;
    // 题型映射
    const panels = [
      {
        key: 'choice',
        label: '单选题',
        questions: (examContent.concept_questions || []).map(q => ({ ...q, type: 'choice' }))
      },
      {
        key: 'multi',
        label: '多选题',
        questions: (examContent.multi_questions || []).map(q => ({ ...q, type: 'multi' }))
      },
      {
        key: 'fill_blank',
        label: '填空题',
        questions: (examContent.fill_blank_questions || []).map(q => ({ ...q, type: 'fill_blank' }))
      },
      {
        key: 'short_answer',
        label: '简答题',
        questions: (examContent.short_answer_questions || []).map(q => ({ ...q, type: 'short_answer' }))
      },
      {
        key: 'programming',
        label: '编程题',
        questions: (examContent.programming_questions || []).map(q => ({ ...q, type: 'programming' }))
      }
    ];
    // 合并所有题目用于勾选索引
    const allQuestions = panels.flatMap(p => p.questions);
    let baseIdx = 0;
    return (
      <Card title="生成的题目（请勾选要加入考试的题目）" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>生成时间: </Text>
          <Text>{examContent.generated_time}</Text>
        </div>
        <Collapse defaultActiveKey={panels.map(p => p.key)}>
          {panels.map(panel => {
            if (!panel.questions.length) return null;
            const startIdx = baseIdx;
            baseIdx += panel.questions.length;
            return (
              <Panel header={panel.label} key={panel.key}>
                <List
                  dataSource={panel.questions}
                  renderItem={(q, idx) => {
                    const globalIdx = startIdx + idx;
                    return (
                      <List.Item>
                        <Checkbox
                          checked={selectedQuestions.includes(globalIdx)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedQuestions([...selectedQuestions, globalIdx]);
                            } else {
                              setSelectedQuestions(selectedQuestions.filter(i => i !== globalIdx));
                            }
                          }}
                        />
                        <div style={{ marginLeft: 8, width: '100%' }}>
                          <span style={{ fontWeight: 'bold', color: '#1677ff' }}>{panel.label}</span>
                          <span style={{ marginLeft: 8 }}>{q.question}</span>
                          {q.options && Object.keys(q.options).length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              {Object.entries(q.options).map(([k, v]) => (
                                <div key={k}><b>{k}.</b> {v}</div>
                              ))}
                            </div>
                          )}
                          {q.answer && <div style={{ color: '#d4380d', marginTop: 4 }}>答案：{q.answer}</div>}
                          {q.correct_answer && <div style={{ color: '#d4380d', marginTop: 4 }}>答案：{q.correct_answer}</div>}
                          <div style={{ color: '#52c41a', marginTop: 4 }}>分值：{q.points}</div>
                          <div style={{ color: '#8c8c8c', marginTop: 4 }}>解析：{q.explanation}</div>
                          <div style={{ marginTop: 4 }}>
                            <Tag color="geekblue">知识点：{q.knowledge_point}</Tag>
                          </div>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </Panel>
            );
          })}
        </Collapse>
        <Space style={{ marginTop: 16 }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setExamModalVisible(true)}
            disabled={selectedQuestions.length === 0}
          >
            创建考试
          </Button>
        </Space>
      </Card>
    );
  };

  // 统一历史详情Modal
  const renderHistoryModal = () => (
    <Modal
      open={historyModal.visible}
      onCancel={() => setHistoryModal({ visible: false, type: '', record: null })}
      footer={null}
      title="历史详情"
    >
      {historyModal.type === 'qa' && historyModal.record && (
        <div>
          <p><b>问题：</b>{historyModal.record.question}</p>
          <p><b>AI回答：</b>{historyModal.record.answer}</p>
          <p><b>时间：</b>{historyModal.record.time}</p>
        </div>
      )}
      {historyModal.type === 'teaching' && historyModal.record && (
        <div>
          <p><b>课程大纲：</b>{historyModal.record.outline}</p>
          <p><b>教学设计：</b>{historyModal.record.plan}</p>
          <p><b>时间：</b>{historyModal.record.time}</p>
        </div>
      )}
    </Modal>
  );

  useEffect(() => {
    if (currentUser?.role === 'teacher') {
      fetchTeacherExams();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'teacher') {
      fetchKnowledgeFiles();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'student') {
      fetchStudentExams();
    }
  }, [currentUser]);

  // 页面加载时自动恢复answer和qaSources
  useEffect(() => {
    const savedAnswer = localStorage.getItem('qa_answer');
    const savedSources = localStorage.getItem('qa_sources');
    if (savedAnswer) setAnswer(savedAnswer);
    if (savedSources) {
      try {
        setQaSources(JSON.parse(savedSources));
      } catch {}
    }
  }, []);

  // 跳转到考试结果页面
  const viewExamResult = (examId) => {
    navigate(`/exam-result/${examId}`);
  };

  const fetchGradingList = async () => {
    setGradingLoading(true);
    try {
      // 获取所有考试
      const examsRes = await axios.get('http://localhost:8000/teacher/exams');
      const exams = examsRes.data.exams || [];
      let allToGrade = [];
      for (const exam of exams) {
        // 获取每场考试的学生作答
        const ansRes = await axios.get(`http://localhost:8000/teacher/exam/${exam.id}/answers`);
        const students = ansRes.data.students || [];
        for (const stu of students) {
          for (const ans of stu.answers) {
            if (ans.is_correct === null) {
              allToGrade.push({
                examId: exam.id,
                examTitle: exam.title,
                studentId: stu.student_id,
                studentName: stu.student_name,
                studentExamId: stu.student_exam_id || stu.id,
                questionId: ans.question_id,
                question: ans.question,
                type: ans.type,
                answer: ans.student_answer,
                points: ans.points,
                comment: ans.comment || '',
                key: `${stu.student_exam_id || stu.id}_${ans.question_id}`
              });
            }
          }
        }
      }
      setGradingList(allToGrade);
    } catch (e) {
      setGradingList([]);
    }
    setGradingLoading(false);
  };

  const handleGrade = async (record, score, comment) => {
    try {
      await axios.post('http://localhost:8000/teacher/grade-answer', new URLSearchParams({
        student_exam_id: record.studentExamId,
        question_id: record.questionId,
        points_earned: score,
        comment
      }));
      fetchGradingList();
      message.success('批改成功');
    } catch (e) {
      message.error('批改失败');
    }
  };

  const gradingColumns = [
    { title: '考试', dataIndex: 'examTitle', key: 'examTitle', align: 'center', width: 120 },
    { title: '学生', dataIndex: 'studentName', key: 'studentName', align: 'center', width: 100 },
    { title: '题型', dataIndex: 'type', key: 'type', align: 'center', width: 100, render: t => t === 'short_answer' ? '简答题' : '编程题' },
    { title: '题目', dataIndex: 'question', key: 'question', width: 350, render: text => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</div> },
    { title: '学生答案', dataIndex: 'answer', key: 'answer', width: 250, render: text => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</div> },
    { title: '分值', dataIndex: 'points', key: 'points', align: 'center', width: 80, render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: '打分',
      key: 'grade',
      align: 'center',
      width: 100,
      render: (_, record) => (
        <InputNumber min={0} max={record.points} style={{ width: 60 }} placeholder="分数" id={`score_${record.key}`} />
      )
    },
    {
      title: '评语',
      key: 'comment',
      align: 'center',
      width: 180,
      render: (_, record) => (
        <Input.TextArea rows={2} style={{ minWidth: 100, maxWidth: 180 }} placeholder="可填写评语" id={`comment_${record.key}`} />
      )
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 100,
      render: (_, record) => (
        <Button type="primary" size="small" style={{ marginLeft: 8 }} onClick={() => {
          const score = Number(document.getElementById(`score_${record.key}`).value);
          const comment = document.getElementById(`comment_${record.key}`).value;
          handleGrade(record, score, comment);
        }}>提交批改</Button>
      )
    }
  ];

  // 在App组件内添加方法
  const handleGeneratePPTFromUpload = async ({ file }) => {
    const formData = new FormData();
    formData.append('document', file);
    const res = await axios.post('http://localhost:8000/teacher/generate-ppt-from-upload', formData, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'teaching-upload.pptx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (!isLoggedIn) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            <BookOutlined /> 教学AI助手
          </Title>
          <Space>
            <Button type="primary" icon={<LoginOutlined />} onClick={() => setLoginVisible(true)}>
              登录
            </Button>
            <Button icon={<UserOutlined />} onClick={() => setRegisterVisible(true)}>
              注册
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
          <Result
            icon={<BookOutlined style={{ color: '#1890ff' }} />}
            title="欢迎使用教学AI助手"
            subTitle="登录后可以使用更多功能：知识库管理、教学内容设计、考核内容生成、考试系统等"
            extra={[
              <Button type="primary" key="login" icon={<LoginOutlined />} onClick={() => setLoginVisible(true)}>
                立即登录
              </Button>,
              <Button key="register" icon={<UserOutlined />} onClick={() => setRegisterVisible(true)}>
                注册账号
              </Button>
            ]}
          />
        </Content>
        <Footer style={{ textAlign: 'center' }}>教学AI助手 ©2024</Footer>
        {renderLoginModal()}
        {renderRegisterModal()}
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          <BookOutlined /> 教学AI助手
        </Title>
        <Space>
          <Text style={{ color: 'white' }}>
            {currentUser?.role === 'teacher' ? '教师' : '学生'}：{currentUser?.username}
          </Text>
          <Button type="primary" icon={<LogoutOutlined />} onClick={logout}>
            退出登录
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        {examInProgress ? (
          renderExamInterface()
        ) : currentUser?.role === 'teacher' ? (
          renderTeacherInterface()
        ) : (
          renderStudentInterface()
        )}
      </Content>
      <Footer style={{ textAlign: 'center' }}>教学AI助手 ©2024</Footer>
      
      {/* 创建考试模态框 */}
      <Modal
        title="创建考试"
        open={examModalVisible}
        onCancel={() => setExamModalVisible(false)}
        footer={null}
      >
        <Form form={examForm} onFinish={handleCreateExam} layout="vertical">
          <Form.Item name="title" label="考试标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="考试描述" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="duration" label="考试时长（分钟）" rules={[{ required: true }]}>
            <Input type="number" min={1} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建考试
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {renderHistoryModal()}
      <Modal open={pptLoading} footer={null} closable={false} centered>
        <Spin tip={pptStep || '正在生成PPT...'} size="large" />
      </Modal>
    </Layout>
  );
}

export default function AppWithRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/exam/:examId" element={<ExamDetail />} />
        <Route path="/exam-result/:id" element={<ExamResultPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function ExamResultPage() {
  const { id } = useParams();
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [aiSummary, setAiSummary] = React.useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchResult = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`http://localhost:8000/student/exam-result/${id}`);
        setResult(res.data);
        // AI总结薄弱点
        const aiRes = await axios.post('http://localhost:8000/ai-weakness-summary', { answers: res.data.answers, exam_id: res.data.exam_id });
        setAiSummary(aiRes.data.summary);
      } catch (e) {
        setResult(null);
      }
      setLoading(false);
    };
    fetchResult();
  }, [id]);

  if (loading) return <Spin style={{ marginTop: 80 }} />;
  if (!result) return <Result status="error" title="未找到考试结果" />;

  // 计算用时
  const start = new Date(result.start_time);
  const end = new Date(result.end_time);
  const duration = Math.round((end - start) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <Card title={<span>考试结果 <Button style={{ float: 'right' }} onClick={() => navigate(-1)}>返回</Button></span>} style={{ maxWidth: 1200, margin: '32px auto' }}>
      <Title level={3} style={{ color: '#52c41a' }}>总分：{result.score}</Title>
      <Text type="secondary">用时：{minutes}分{seconds}秒</Text>
      <Divider />
      <List
        dataSource={result.answers}
        renderItem={(a, idx) => (
          <List.Item>
            <Card style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                {['short_answer', 'programming'].includes(a.type) ? (
                  a.is_correct === null ? (
                    <Tag color="orange">待批改</Tag>
                  ) : (
                    <Tag color={a.is_correct ? 'green' : 'red'}>{a.is_correct ? '正确' : '错误'}</Tag>
                  )
                ) : (
                  <Tag color={a.is_correct ? 'green' : 'red'}>{a.is_correct ? '正确' : '错误'}</Tag>
                )}
                <span style={{ marginLeft: 8 }}>得分：{a.is_correct === null ? '--' : a.points_earned}</span>
              </div>
              <div style={{ marginBottom: 8 }}><b>题号：</b>{idx + 1}</div>
              <div style={{ marginBottom: 8 }}><b>你的答案：</b>{a.answer}</div>
              <div style={{ marginBottom: 8 }}><b>正确答案：</b>{a.correct_answer}</div>
              <div style={{ marginBottom: 8 }}><b>解析：</b>{a.explanation || '无'}</div>
              {['short_answer', 'programming'].includes(a.type) && a.is_correct !== null && (
                <div style={{ marginBottom: 8 }}><b>老师评语：</b>{a.comment || '无'}</div>
              )}
            </Card>
          </List.Item>
        )}
      />
      <Divider />
      <Title level={4}>AI总结你的薄弱点</Title>
      <div style={{ minHeight: 60 }}>{aiSummary || 'AI正在分析...'}</div>
    </Card>
  );
} 