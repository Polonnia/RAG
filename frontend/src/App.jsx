import React, { useState, useEffect, useRef } from 'react';
import { Layout, Upload, Button, Input, message, Typography, Spin, Card, Space, List, Popconfirm, Tag, Divider, Select, Collapse, Modal, Form, Radio, Checkbox, Progress, Steps, Result, Table, InputNumber, Menu, Switch, Empty, Avatar } from 'antd';
import { UploadOutlined, BookOutlined, FileTextOutlined, ClockCircleOutlined, DeleteOutlined, EyeOutlined, DatabaseOutlined, FormOutlined, UserOutlined, LoginOutlined, LogoutOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, LockOutlined, BarChartOutlined, RobotOutlined } from '@ant-design/icons';
import axios from 'axios';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import ExamDetail from './ExamDetail';
import ReactMarkdown from 'react-markdown';
import { Tabs } from 'antd';
// 新增依赖
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'antd/dist/reset.css';
import './global.css';
import { Line } from '@ant-design/charts';
// 词云依赖：如未安装请运行 npm install react-tagcloud
import { TagCloud } from 'react-tagcloud';
// 新增 ECharts 依赖
import ReactECharts from 'echarts-for-react';
import 'echarts-wordcloud';

// 新增MarkdownWithLatex组件
function MarkdownWithLatex({ children }) {
  let safe = '';
  if (typeof children === 'string') {
    safe = children;
  } else if (children) {
    safe = String(children);
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      children={safe}
    />
  );
}

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;
const { Panel } = Collapse;
const { Step } = Steps;

function renderAdminLayout(activeAdminMenu, setActiveAdminMenu, handleLogout) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={220} style={{ background: '#f4f6fa', boxShadow: '2px 0 8px #e6eaf1', borderRight: '1.5px solid #e6eaf1', paddingTop: 0 }}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 22,
          color: '#1677ff',
          letterSpacing: 2,
          marginBottom: 16,
          background: 'linear-gradient(90deg, #1677ff 0%, #49c7f7 100%)',
          borderRadius: '0 0 18px 18px',
          boxShadow: '0 2px 8px #e6eaf1',
        }}>
          <BarChartOutlined style={{ fontSize: 28, marginRight: 8, color: '#fff' }} />
          <span style={{ color: '#fff' }}>管理员后台</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeAdminMenu]}
          onClick={({ key }) => setActiveAdminMenu(key)}
          style={{ height: '100%', borderRight: 0, fontSize: 18, background: '#f4f6fa', fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif', fontWeight: 500 }}
          items={adminMenuItems.map(item => ({
            ...item,
            style: {
              borderRadius: 10,
              margin: '6px 8px',
              transition: 'background 0.2s',
            }
          }))}
          theme="light"
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ background: '#fff', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: 64, boxShadow: '0 2px 8px #e6eaf1' }}>
          <Button type="link" icon={<LogoutOutlined />} onClick={handleLogout} style={{ fontSize: 16, fontWeight: 600 }}>
            退出登录
          </Button>
        </Layout.Header>
        <Layout.Content style={{ padding: 24, minHeight: 360, background: '#f8fafc' }}>
          {activeAdminMenu === 'ppt' && <AdminPPTExport />}
          {activeAdminMenu === 'activity' && <AdminActivity />}
          {activeAdminMenu === 'users' && <AdminUserManagement />}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

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
  const [qaLoading, setQaLoading] = useState(false);

  // 教学内容设计状态
  const [courseOutline, setCourseOutline] = useState('');
  const [teachingPlan, setTeachingPlan] = useState(''); // 只显示知识框架
  const [lessonSchedule, setLessonSchedule] = useState(''); // 新增：学时安排表
  const [pptDetailContent, setPptDetailContent] = useState(''); // 只用于PPT生成，不显示
  const [pptLoading, setPptLoading] = useState(false);
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
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [pptStep, setPptStep] = useState('');

  // 历史记录状态
  const [qaHistory, setQaHistory] = useState([]);
  const [teachingPlanHistory, setTeachingPlanHistory] = useState([]);
  const [examHistory, setExamHistory] = useState([]);
  const [historyModal, setHistoryModal] = useState({ visible: false, type: '', record: null });

  // 试题批改状态
  const [gradingModalVisible, setGradingModalVisible] = useState(false);
  const [gradingModalQuestion, setGradingModalQuestion] = useState(null);
  const [gradingModalStudentAnswers, setGradingModalStudentAnswers] = useState([]);
  const [gradingModalSelectedStudent, setGradingModalSelectedStudent] = useState(null);

  // 题型配置state
  const [questionConfig, setQuestionConfig] = useState({
    choice: { enabled: true, count: 5, points: 2 },
    multi: { enabled: false, count: 0, points: 3 },
    fill_blank: { enabled: true, count: 2, points: 4 },
    short_answer: { enabled: true, count: 2, points: 5 },
    programming: { enabled: false, count: 0, points: 10 }
  });
  const [selectedQuestions, setSelectedQuestions] = useState([]); // 勾选的题目
  const [difficulty, setDifficulty] = useState('中等'); // 添加难度选择状态

  const [gradingList, setGradingList] = useState([]);
  const [gradingLoading, setGradingLoading] = useState(false);
  
  const [activeAdminMenu, setActiveAdminMenu] = useState('ppt');

  // 教师端菜单状态，支持 localStorage 恢复
  const [activeTeacherMenu, setActiveTeacherMenu] = useState(() => localStorage.getItem('activeTeacherMenu') || 'knowledge');
  useEffect(() => { localStorage.setItem('activeTeacherMenu', activeTeacherMenu); }, [activeTeacherMenu]);

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
      const userStr = localStorage.getItem('user');
      if (token && userStr) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const user = JSON.parse(userStr);
        if (user.role === 'teacher') {
          await axios.get('http://localhost:8000/teacher/exams');
        } else if (user.role === 'student') {
          await axios.get('http://localhost:8000/student/exams');
        }
        setCurrentUser(user);
        setIsLoggedIn(true);
        fetchData();
      } else {
        logout();
      }
    } catch (error) {
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
      const res = await axios.post('http://localhost:8000/login', {
        username: values.username,
        password: values.password,
      });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      // 立即设置 axios header，防止登录后第一次请求没带 token
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setCurrentUser(user);
      setIsLoggedIn(true);
      setLoginVisible(false);
      message.success('登录成功');
    } catch (err) {
      message.error(err.response?.data?.detail || '登录失败');
    }
  };

  const handleRegister = async (values) => {
    try {
      const res = await axios.post('http://localhost:8000/register', {
        username: values.username,
        password: values.password,
        role: values.role,
      });
      message.success('注册成功，请登录');
      setRegisterVisible(false);
      setLoginVisible(true);
    } catch (err) {
      message.error(err.response?.data?.detail || '注册失败');
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
    setQaLoading(true);
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
    setQaLoading(false);
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
      let schedule = response.data.lesson_schedule || '';
      schedule = schedule.trim();
      if (schedule.startsWith('```')) {
        schedule = schedule.replace(/```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
      }
      setLessonSchedule(schedule); // 新增：保存学时安排表
      // 保存历史到后端
      await axios.post('http://localhost:8000/teaching-plan-history', new URLSearchParams({
        outline: courseOutline,
        plan: response.data.plan,
        lesson_schedule: schedule // 新增
      }));
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
      await axios.post('http://localhost:8000/teacher/generate-ppt-from-outline', pptForm);
      message.success('PPT生成成功，已加入历史列表');
      // 生成后刷新PPT历史
      if (typeof fetchPptHistory === 'function') fetchPptHistory();
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
      formData.append('difficulty', difficulty); // 添加难度参数
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

  // 在学生考试流程中添加阶段状态
  const [examStep, setExamStep] = useState('answer'); // 'answer' | 'submit' | 'done'

  // 修改 submitExam 函数，先进入提交阶段弹窗，确认后再真正提交
  const handleSubmitExam = () => {
    setExamStep('submit');
  };

  const confirmSubmitExam = async () => {
    setExamLoading(true);
    try {
      const formData = new FormData();
      formData.append('exam_id', currentExam.exam.id);
      formData.append('answers_data', JSON.stringify(examAnswers));
      const response = await axios.post('http://localhost:8000/student/submit-exam', formData);
      message.success(`考试提交成功！得分：${response.data.score}`);
      setExamStep('done');
      setExamInProgress(false);
      setCurrentExam(null);
      setExamAnswers({});
      setExamTimer(0);
      fetchStudentExams();
      // 立即开始轮询AI薄弱点分析结果
      message.info('正在分析考试薄弱点，请稍候...');
      await pollAiAnalysis(currentExam.exam.id);
      window.dispatchEvent(new Event('updateStudentAnalysis'));
      setTimeout(async () => {
        try {
          const analysisRes = await axios.get(`http://localhost:8000/student/latest-analysis/${currentExam.exam.id}`);
          const studentAnalysisComponent = document.querySelector('[data-testid="student-analysis"]');
          if (studentAnalysisComponent) {
            window.dispatchEvent(new CustomEvent('updateLatestAnalysis', { detail: analysisRes.data }));
          }
        } catch (error) {
          console.error('刷新最新分析失败:', error);
        }
      }, 2000);
    } catch (err) {
      console.error('提交考试失败:', err);
      message.error('提交考试失败');
    }
    setExamLoading(false);
  };

  const handleReturnToExamList = () => {
    setExamStep('answer');
    setExamInProgress(false);
    setCurrentExam(null);
    setExamAnswers({});
    setExamTimer(0);
    fetchStudentExams();
  };

  // 轮询AI薄弱点分析结果
  const pollAiAnalysis = async (examId) => {
    const maxAttempts = 30; // 最多等待30次
    const interval = 2000; // 每2秒检查一次
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(`http://localhost:8000/student/exam-result/${examId}`);
        if (response.data.ai_summary && response.data.ai_summary.trim()) {
          message.success('AI薄弱点分析完成！');
          return;
        }
      } catch (error) {
        console.error('检查AI分析状态失败:', error);
      }
      
      // 等待一段时间再检查
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    message.warning('AI分析可能仍在进行中，请稍后查看学情分析页面');
  };

  // 计时器效果
  useEffect(() => {
    let interval;
    if (examInProgress && examTimer > 0) {
      interval = setInterval(() => {
        setExamTimer(prev => {
          if (prev <= 1) {
            confirmSubmitExam();
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
      className="login-modal"
    >
      <Form onFinish={handleLogin} layout="vertical">
        <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
          <Input prefix={<UserOutlined style={{color:'#1677ff'}} />} placeholder="请输入用户名" />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true }]}>
          <Input.Password prefix={<LockOutlined style={{color:'#1677ff'}} />} placeholder="请输入密码" />
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
        <Form.Item name="role" label="角色" initialValue="student" rules={[{ required: true, message: '请选择角色' }]}> 
          <Select>
            <Select.Option value="student">学生</Select.Option>
            <Select.Option value="teacher">教师</Select.Option>
            <Select.Option value="admin">管理员</Select.Option>
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

  // 教师端左侧菜单项
  const teacherMenuItems = [
    { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库管理' },
    { key: 'qa', icon: <BookOutlined />, label: '知识库问答' },
    { key: 'teaching', icon: <FileTextOutlined />, label: '教学内容设计' },
    { key: 'exam', icon: <FormOutlined />, label: '考核内容生成' },
    { key: 'manage', icon: <FormOutlined />, label: '考试管理' },
    { key: 'grading', icon: <CheckCircleOutlined />, label: '待批改试卷' }
  ];

  // 教师端内容区渲染
  const renderTeacherContent = () => {
    switch (activeTeacherMenu) {
      case 'knowledge':
        return (
          <>
            {/* 知识库管理内容 */}
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
                          <Switch
                            checked={file.student_can_download}
                            checkedChildren="可下载"
                            unCheckedChildren="不可下载"
                            onChange={checked => {
                              axios.post('http://localhost:8000/set-student-download', new URLSearchParams({
                                filename: file.filename,
                                can_download: checked
                              })).then(() => {
                                message.success('设置成功');
                                fetchKnowledgeFiles();
                              });
                            }}
                            style={{ marginRight: 16 }}
                          />,
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
          </>
        );
      case 'qa':
        return (
          <Card style={{ margin: 0, maxWidth: '100vw', minHeight: '100vh', borderRadius: 0, boxShadow: 'none', background: '#fafdff', padding: '48px 0' }}>
            <div style={{ marginBottom: 32, padding: 24, background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px #e6eaf1' }}>
              <TextArea
                rows={3}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="请输入你的问题..."
                style={{ marginBottom: 16, fontSize: 15, borderRadius: 10, boxShadow: '0 1px 4px #e6eaf1' }}
              />
              <Button type="primary" onClick={handleAsk} loading={qaLoading} disabled={qaLoading || !question.trim()} style={{ height: 42, fontSize: 16, borderRadius: 10, fontWeight: 600, width: 140 }}>
                提问
              </Button>
              <Button style={{ marginLeft: 24 }} onClick={() => setFileModalVisible(true)}>
                可下载资料
              </Button>
            </div>
            <div style={{ marginTop: 16, minHeight: 60 }}>
              {qaLoading ? <Spin size="large" style={{ margin: '32px 0' }} /> : answer && (
                <div style={{ padding: 22, background: '#f6faff', borderRadius: 14, marginBottom: 24, boxShadow: '0 2px 8px #e6eaf1', fontSize: 16, color: '#222', lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 700, color: '#1677ff', marginBottom: 8, fontSize: 16 }}><RobotOutlined style={{marginRight:8}}/>AI助手：</div>
                  <MarkdownWithLatex>{answer}</MarkdownWithLatex>
                </div>
              )}
            </div>
            {qaSources && qaSources.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#1677ff', marginBottom: 14 }}>原文片段</div>
                <List
                  dataSource={qaSources}
                  renderItem={src => {
                    let page = '';
                    if (src.metadata && (src.metadata.page || src.metadata.page_number)) {
                      page = src.metadata.page || src.metadata.page_number;
                    }
                    return (
                      <List.Item style={{ background: '#fff', borderRadius: 12, marginBottom: 16, boxShadow: '0 2px 8px #e6eaf1', padding: 14, display: 'block' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, minHeight: 28 }}>
                          <span style={{ display: 'inline-block', background: '#e6f4ff', color: '#1677ff', borderRadius: 8, padding: '2px 12px', fontWeight: 600, fontSize: 13, height: 24, lineHeight: '20px', marginRight: 8 }}>
                            {src.metadata?.source || src.filename || src.source || '未知'}
                          </span>
                          {page !== '' && (
                            <span style={{ display: 'inline-block', background: '#f6ffed', color: '#52c41a', borderRadius: 8, padding: '2px 12px', fontWeight: 600, fontSize: 13, height: 24, lineHeight: '20px', marginLeft: 0 }}>
                              第{page}页
                            </span>
                          )}
                        </div>
                        <div style={{ borderLeft: '4px solid #e6eaf1', paddingLeft: 16, fontSize: 14, color: '#444', lineHeight: 1.6 }}>
                          <span style={{ color: '#bbb', fontSize: 13, marginRight: 8 }}>&ldquo;</span>
                          {src.content || src.text || src.chunk || src}
                          <span style={{ color: '#bbb', fontSize: 13, marginLeft: 8 }}>&rdquo;</span>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </div>
            )}
            <Modal
              open={fileModalVisible}
              title="可下载资料"
              onCancel={() => setFileModalVisible(false)}
              footer={null}
            >
              <List
                dataSource={knowledgeFiles.filter(f => f.student_can_download)}
                renderItem={file => (
                  <List.Item>
                    <span>{file.filename}</span>
                    <span style={{ color: '#bbb', marginLeft: 12 }}>{file.upload_time}</span>
                    <Button
                      style={{ marginLeft: 16 }}
                      onClick={() => handleDownload(file.filename)}
                      type="link"
                    >下载</Button>
                  </List.Item>
                )}
              />
            </Modal>
          </Card>
        );
      case 'teaching':
        return (
          <>
            <Card title="课程大纲输入" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
              <TextArea
                rows={6}
                value={courseOutline}
                onChange={e => setCourseOutline(e.target.value)}
                placeholder="请输入课程大纲，包括课程目标、主要知识点、 教学要求、学时安排等"
                style={{ marginBottom: 16 }}
              />
              <Space style={{ marginTop: 16 }}>
                <Button type="primary" onClick={handleDesignTeachingPlan} loading={planLoading} icon={<FormOutlined />}>
                  生成教学内容
                </Button>
                <Button onClick={() => setCourseOutline('')}>
                  清空大纲
                </Button>
                <Upload
                  beforeUpload={() => false}
                  showUploadList={false}
                  accept=".txt,.md"
                  customRequest={({ file }) => handleGeneratePPTFromUpload({ file })}
                >
                  <Button icon={<UploadOutlined />}>使用txt/md文件生成PPT</Button>
                </Upload>
              </Space>
            </Card>
            {/* 始终显示PPT历史记录栏 */}
            <TeacherPPTHistory />
            {teachingPlan && (
              <Card title="教学内容设计结果" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
                <MarkdownWithLatex>{teachingPlan}</MarkdownWithLatex>
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
                {pptLoading && (
                  <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <Spin tip={pptStep || '正在生成PPT...'} size="large" />
                  </div>
                )}
              </Card>
            )}
            {lessonSchedule && (
              <Card title="学时安排表" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
                <div className="markdown-body">
                  <MarkdownWithLatex>{lessonSchedule}</MarkdownWithLatex>
                </div>
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
                      setLessonSchedule(item.lesson_schedule || ''); // 新增
                      setHistoryModal({ visible: false, type: '', record: null });
                    }}>
                      {item.outline}（{item.time}）
                    </a>
                  </List.Item>
                )}
              />
            </Card>
          </>
        );
      case 'exam':
        return (
          <>
            {renderQuestionConfigForm()}
            <Card title="课程大纲输入" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
              <TextArea
                rows={6}
                value={examOutline}
                onChange={e => setExamOutline(e.target.value)}
                placeholder="请输入课程大纲，包括课程目标、主要知识点、教学要求等"
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
          </>
        );
      case 'manage':
        return (
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
                    </Button>,
                    <Popconfirm
                      title="确定要删除这个考试吗？"
                      description="删除后将无法恢复，且相关学生记录也会被删除"
                      onConfirm={() => handleDeleteExam(exam.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="link" danger>删除</Button>
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={<div style={{fontWeight:700, fontSize:20, color:'#222'}}>{exam.title}</div>}
                    description={
                      <Space direction="vertical" size="small">
                        <div style={{color:'#888', fontSize:15, marginTop:4}}>{exam.description}</div>
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
        );
      case 'grading':
        return (
          <Card title={<span style={{ fontWeight: 600, fontSize: 18 }}>待批改简答题/编程题</span>} style={{ width: '100%', maxWidth: 1600, margin: '0 auto' }}>
            <Table columns={gradingQuestionColumns} dataSource={gradingList} loading={gradingLoading} pagination={{ pageSize: 8 }} bordered rowClassName={(_, idx) => idx % 2 === 0 ? 'table-row-light' : 'table-row-dark'} />
            {/* 批改弹窗 */}
            <Modal
              open={gradingModalVisible}
              onCancel={() => setGradingModalVisible(false)}
              footer={null}
              title={<span>批改试题</span>}
              width={600}
            >
              {gradingModalQuestion && gradingModalStudentAnswers.length > 0 ? (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <b>题目：</b>{gradingModalQuestion.question}
                    <br /><b>题型：</b>{gradingModalQuestion.type === 'short_answer' ? '简答题' : '编程题'}
                    <br /><b>分值：</b>{gradingModalQuestion.points}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <b>选择学生：</b>
                    <Select
                      style={{ width: 200 }}
                      value={gradingModalSelectedStudent}
                      onChange={sid => setGradingModalSelectedStudent(sid)}
                    >
                      {gradingModalStudentAnswers.map(stu => (
                        <Select.Option key={stu.studentId} value={stu.studentId}>{stu.studentName}</Select.Option>
                      ))}
                    </Select>
                  </div>
                  {gradingModalStudentAnswers.filter(stu => stu.studentId === gradingModalSelectedStudent).map(stu => (
                    <div key={stu.studentId} style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8 }}><b>学生：</b>{stu.studentName}</div>
                      <div style={{ marginBottom: 8 }}><b>学生答案：</b>{stu.answer}</div>
                      <div style={{ marginBottom: 8 }}>
                        <InputNumber min={0} max={gradingModalQuestion.points} style={{ width: 80 }} placeholder="分数" id={`modal_score_${stu.key}`} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <Input.TextArea rows={2} style={{ minWidth: 100, maxWidth: 300 }} placeholder="可填写评语" id={`modal_comment_${stu.key}`} />
                      </div>
                      <Button type="primary" size="small" onClick={() => {
                        const score = Number(document.getElementById(`modal_score_${stu.key}`).value);
                        const comment = document.getElementById(`modal_comment_${stu.key}`).value;
                        handleModalGrade(stu.studentExamId, gradingModalQuestion.questionId, score, comment);
                      }}>提交批改</Button>
                    </div>
                  ))}
                </div>
              ) : <div>暂无待批改学生</div>}
            </Modal>
          </Card>
        );
      default:
        return null;
    }
  };

  // 教师端整体布局
  const renderTeacherLayout = () => (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={220} style={{ background: '#f4f6fa', boxShadow: '2px 0 8px #e6eaf1', borderRight: '1.5px solid #e6eaf1', paddingTop: 0 }}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 22,
          color: '#1677ff',
          letterSpacing: 2,
          marginBottom: 16,
          background: 'linear-gradient(90deg, #1677ff 0%, #49c7f7 100%)',
          borderRadius: '0 0 18px 18px',
          boxShadow: '0 2px 8px #e6eaf1',
        }}>
          <BookOutlined style={{ fontSize: 28, marginRight: 8, color: '#fff' }} />
          <span style={{ color: '#fff' }}>智能教学助手</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeTeacherMenu]}
          onClick={({ key }) => {
            setActiveTeacherMenu(key);
            if (key === 'grading') {
              fetchGradingList();
            }
          }}
          style={{ height: '100%', borderRight: 0, fontSize: 18, background: '#f4f6fa', fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif', fontWeight: 500 }}
          items={teacherMenuItems.map(item => ({
            ...item,
            style: {
              borderRadius: 10,
              margin: '6px 8px',
              transition: 'background 0.2s',
            }
          }))}
          theme="light"
        />
      </Layout.Sider>
      <Layout>
        {/* 顶部Header去除白色长条，背景色与整体统一 */}
        <div style={{ height: 64, background: '#f4f6fa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 32px' }}>
          <Space>
            <Text style={{ color: '#1677ff', fontWeight: 600 }}>
              教师：{currentUser?.username}
            </Text>
            <Button type="primary" icon={<LogoutOutlined />} onClick={logout} style={{ borderRadius: 20, fontWeight: 500 }}>
              退出登录
            </Button>
          </Space>
        </div>
        <Layout.Content style={{ padding: '48px 0', background: '#f4f6fa', minHeight: 800, fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32, background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1', minHeight: 600 }}>
            {renderTeacherContent()}
          </div>
          {/* 创建考试Modal */}
          <Modal
            title="创建考试"
            open={examModalVisible}
            onCancel={() => setExamModalVisible(false)}
            footer={null}
          >
            <Form form={examForm} onFinish={handleCreateExam} layout="vertical" initialValues={{}} validateTrigger={['onChange','onBlur']}>
              <Form.Item name="title" label="考试标题" rules={[{ required: true, message: '请输入考试标题' }]} validateTrigger={['onChange','onBlur']}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label="考试描述" rules={[{ required: true, message: '请输入考试描述' }]} validateTrigger={['onChange','onBlur']}>
                <TextArea rows={3} />
              </Form.Item>
              <Form.Item name="duration" label="考试时长（分钟）" rules={[{ required: true, message: '请输入考试时长' }]} validateTrigger={['onChange','onBlur']}>
                <Input type="number" min={1} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block> 创建考试 </Button>
              </Form.Item>
            </Form>
          </Modal>
        </Layout.Content>
        <Footer style={{ textAlign: 'center', background: '#f4f6fa', color: '#888', fontWeight: 500, letterSpacing: 1 }}>智能教学助手 ©2025</Footer>
      </Layout>
    </Layout>
  );

  const renderStudentInterface = () => (
    <Tabs activeKey={activeStudentMenu} onChange={key => setActiveStudentMenu(key)} size="large">
      <TabPane tab={<span><BookOutlined />知识库问答</span>} key="1">
        <Card title="知识库问答" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
          <TextArea
            rows={3}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="请输入你的问题..."
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" onClick={handleAsk} loading={qaLoading} disabled={qaLoading}>
            提问
          </Button>
          <div style={{ marginTop: 16, minHeight: 60 }}>
            {qaLoading ? <Spin /> : answer && (
              <div style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
                <Text strong>AI助手：</Text>
                <MarkdownWithLatex>{answer}</MarkdownWithLatex>
              </div>
            )}
          </div>
          {/* 新增：问答历史记录 */}
          <div style={{ marginTop: 32 }}>
            <b>问答历史记录：</b>
            <List
              dataSource={qaHistory}
              locale={{ emptyText: '暂无历史记录' }}
              renderItem={item => (
                <List.Item style={{ alignItems: 'flex-start' }}>
                  <div style={{ width: '100%' }}>
                    <div><Text strong>Q：</Text>{item.question}</div>
                    <div style={{ margin: '8px 0 0 0', color: '#1677ff' }}><Text strong>A：</Text>{item.answer}</div>
                    <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{item.time}</div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        </Card>
      </TabPane>

      <TabPane tab={<span><FormOutlined />考试系统</span>} key="2">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '80vh', background: '#f5f6fa' }}>
          <div style={{ width: 420, maxWidth: '95vw', marginTop: 32 }}>
            <Card title="可参加的考试" style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 2px 8px #f0f1f2', width: '100%', minHeight: 400, padding: 0 }} bodyStyle={{ padding: 0 }}>
          <List
            grid={{ gutter: 16, column: 2 }}
            dataSource={studentExams}
                renderItem={exam => (
              <List.Item>
                <Card
                  hoverable
                  style={{ minHeight: 120, marginBottom: 12, padding: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  bodyStyle={{ padding: 16 }}
                >
                  <div style={{ fontWeight: 600, fontSize: 18 }}>{exam.title}</div>
                  <div style={{ margin: '8px 0 4px 0', color: '#888', fontSize: 13 }}>
                    创建时间: {formatDateTime(exam.created_at)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                        <Tag color="blue">时长: {exam.duration} 分钟</Tag>
                    {exam.completed && (
                      <Tag color="green">
                        得分: {typeof exam.score === 'number' ? exam.score : '--'}
                        {exam.total_score || exam.max_score ? `/${exam.total_score || exam.max_score}` : ''}
                      </Tag>
                    )}
                    {!exam.completed && <Tag color="red">未完成</Tag>}
                      </div>
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <Button type="primary" size="small" onClick={() => startExam(exam.id)} disabled={exam.completed}>
                      {exam.completed ? '已完成' : '开始考试'}
                            </Button>
                      </div>
                </Card>
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
    if (examStep === 'done') {
      return (
        <Result
          status="success"
          title="已成功提交！"
          subTitle="您的考试答卷已成功提交。"
          extra={[
            <Button type="primary" key="result" onClick={() => viewExamResult(currentExam.exam.id)}>
              查看考试结果
            </Button>,
            <Button key="back" onClick={handleReturnToExamList}>
              返回
            </Button>
          ]}
        />
      );
    }
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Card title={`考试：${currentExam.exam.title}`} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Text strong>剩余时间：</Text>
            <Text type="danger" style={{ fontSize: 18 }}>
              {formatTime(examTimer)}
            </Text>
          </Space>
        </div>

        <Steps current={examStep === 'answer' ? 0 : examStep === 'submit' ? 1 : 2} style={{ marginBottom: 24 }}>
          <Step title="作答中" />
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

                {question.type === 'multi' && (
                  <Checkbox.Group
                    value={examAnswers[question.id] || []}
                    onChange={checkedValues => setExamAnswers({
                      ...examAnswers,
                      [question.id]: checkedValues
                    })}
                  >
                    <Space direction="vertical">
                      {Object.entries(question.options).map(([key, value]) => (
                        <Checkbox key={key} value={key}>
                          {key}. {value}
                        </Checkbox>
                      ))}
                    </Space>
                  </Checkbox.Group>
                )}

                {question.type === 'fill_blank' && (() => {
                  const blankCount = (question.question.match(/_____/g) || []).length;
                  return (
                    <>
                  <Input
                          placeholder={`请输入答案${blankCount > 1 ? '，多个空用空格分隔' : ''}`}
                    value={examAnswers[question.id] || ''}
                    onChange={(e) => setExamAnswers({
                      ...examAnswers,
                      [question.id]: e.target.value
                    })}
                  />
                      {blankCount > 1 && (
                        <div style={{ color: '#faad14', fontSize: 12, marginTop: 4 }}>
                            多个空请用空格分隔，如：答案1 答案2 答案3
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
            <Button type="primary" onClick={handleSubmitExam} disabled={examLoading}>
              提交试卷
            </Button>
          </Space>
        </div>
        {/* 提交确认弹窗 */}
        <Modal
          open={examStep === 'submit'}
          title="确认提交"
          onOk={confirmSubmitExam}
          onCancel={() => setExamStep('answer')}
          okText="确认提交"
          cancelText="继续作答"
          confirmLoading={examLoading}
        >
          <p>提交后将无法修改答案，确定要提交吗？</p>
        </Modal>
      </Card>
      </div>
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
          <Tag color="blue">知识点: {q.knowledge_points}</Tag>
        </div>
      </Card>
    ));
  };

  const renderFillBlankQuestions = (questions) => {
    if (!questions || questions.length === 0) return <Text type="secondary">暂无填空题</Text>;
    
    return questions.map((q, index) => {
      // 处理多个空的答案显示
      const answers = (q.answer || q.correct_answer || '').split().map(ans => ans.trim()).filter(ans => ans);
      const answerDisplay = answers.length > 1 
        ? answers.map((ans, i) => `空${i + 1}: ${ans}`).join(' ')
        : answers[0] || '';
      
      return (
      <Card key={index} size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text strong>{index + 1}. {q.question}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
            <Text type="success" strong>答案: {answerDisplay}</Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>解析: </Text>
          <Text>{q.explanation}</Text>
        </div>
        <div>
            <Tag color="blue">知识点: {q.knowledge_points}</Tag>
        </div>
      </Card>
      );
    });
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
          <Tag color="blue">知识点: {q.knowledge_points}</Tag>
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
          <Tag color="blue">知识点: {q.knowledge_points}</Tag>
        </div>
      </Card>
    ));
  };

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

    // 全选相关
    const allSelected = selectedQuestions.length === allQuestions.length && allQuestions.length > 0;
    const handleSelectAll = (checked) => {
      if (checked) {
        setSelectedQuestions(allQuestions.map((_, idx) => idx));
      } else {
        setSelectedQuestions([]);
      }
    };

    return (
      <Card title="勾选要加入考试的题目" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Checkbox
            checked={allSelected}
            indeterminate={selectedQuestions.length > 0 && selectedQuestions.length < allQuestions.length}
            onChange={e => handleSelectAll(e.target.checked)}
          >
            全选
          </Checkbox>
          <span style={{ marginLeft: 16, color: '#888' }}>
            已选 {selectedQuestions.length} / {allQuestions.length} 题
          </span>
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
                    const checked = selectedQuestions.includes(globalIdx);
                    return (
                      <List.Item style={{ alignItems: 'flex-start' }}>
                        <Checkbox
                          checked={checked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedQuestions([...selectedQuestions, globalIdx]);
                            } else {
                              setSelectedQuestions(selectedQuestions.filter(i => i !== globalIdx));
                            }
                          }}
                          style={{ marginRight: 12, marginTop: 4 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: 8 }}>
                            <Text strong>第 {globalIdx + 1} 题 ({q.points} 分)</Text>
                            <Tag style={{ marginLeft: 8 }}>{questionTypeMap[q.type] || q.type}</Tag>
                          </div>
                          <div style={{ marginBottom: 8 }}>{q.question}</div>
                          {q.options && Object.keys(q.options).length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <Text type="secondary">选项：</Text>
                              <ul style={{ margin: 0, paddingLeft: 20 }}>
                                {Object.entries(q.options).map(([key, value]) => (
                                  <li key={key}>{key}. {value}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {q.knowledge_points && (
                            <div style={{ marginBottom: 8 }}>
                              <Tag color="geekblue">知识点：{Array.isArray(q.knowledge_points) ? q.knowledge_points.join('，') : q.knowledge_points}</Tag>
                            </div>
                          )}
                          {q.explanation && (
                            <div style={{ color: '#888', fontSize: 13 }}>解析：{q.explanation}</div>
                          )}
                          <div style={{ color: '#1677ff', marginTop: 4 }}>正确答案：{Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : (typeof q.correct_answer === 'object' ? JSON.stringify(q.correct_answer) : q.correct_answer || '--')}</div>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </Panel>
            );
          })}
        </Collapse>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            disabled={selectedQuestions.length === 0}
            onClick={() => setExamModalVisible(true)}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            创建考试
          </Button>
        </div>
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
      const examsRes = await axios.get('http://localhost:8000/teacher/exams');
      const exams = examsRes.data.exams || [];
      let questionMap = {};
      for (const exam of exams) {
        const ansRes = await axios.get(`http://localhost:8000/teacher/exam/${exam.id}/answers`);
        const students = ansRes.data.students || [];
        for (const stu of students) {
          for (const ans of stu.answers) {
            if (ans.is_correct === null) {
              const key = `${exam.id}_${ans.question_id}`;
              if (!questionMap[key]) {
                questionMap[key] = {
                examId: exam.id,
                examTitle: exam.title,
                questionId: ans.question_id,
                question: ans.question,
                type: ans.type,
                points: ans.points,
                  waitStudents: [],
                };
              }
              questionMap[key].waitStudents.push({
                studentId: stu.student_id,
                studentName: stu.student_name,
                studentExamId: stu.student_exam_id || stu.id,
                answer: ans.student_answer,
                comment: ans.comment || '',
                key: `${stu.student_exam_id || stu.id}_${ans.question_id}`
              });
            }
          }
        }
      }
      const questionList = Object.values(questionMap).map(q => ({
        ...q,
        waitCount: q.waitStudents.length
      }));
      setGradingList(questionList);
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

  const gradingQuestionColumns = [
    { title: '考试', dataIndex: 'examTitle', key: 'examTitle', align: 'center', width: 120 },
    { title: '题型', dataIndex: 'type', key: 'type', align: 'center', width: 100, render: t => t === 'short_answer' ? '简答题' : '编程题' },
    { title: '题目', dataIndex: 'question', key: 'question', width: 350, render: text => <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</div> },
    { title: '待批改人数', dataIndex: 'waitCount', key: 'waitCount', align: 'center', width: 100 },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 120,
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => {
          setGradingModalQuestion(record);
          setGradingModalStudentAnswers(record.waitStudents);
          setGradingModalSelectedStudent(record.waitStudents[0]?.studentId || null);
          setGradingModalVisible(true);
        }}>进入批改</Button>
      )
    }
  ];

  // 批改弹窗提交
  const handleModalGrade = async (studentExamId, questionId, score, comment) => {
    try {
      await axios.post('http://localhost:8000/teacher/grade-answer', new URLSearchParams({
        student_exam_id: studentExamId,
        question_id: questionId,
        points_earned: score,
        comment
      }));
      message.success('批改成功');
      setGradingModalVisible(false);
      fetchGradingList();
    } catch (e) {
      message.error('批改失败');
    }
  };

  // 在App组件内添加方法
  const handleGeneratePPTFromUpload = async ({ file }) => {
    const formData = new FormData();
    formData.append('document', file);
    await axios.post('http://localhost:8000/teacher/generate-ppt-from-upload', formData);
    message.success('PPT生成成功，已加入历史列表');
    if (typeof fetchPptHistory === 'function') fetchPptHistory();
  };

  // 在App组件内添加删除考试函数
  const handleDeleteExam = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/exam/${id}`);
      message.success('考试删除成功');
      fetchTeacherExams(); // 重新拉取考试列表
    } catch (e) {
      message.error('删除失败');
      console.error(e);
    }
  };

  // 题型配置表单
  const renderQuestionConfigForm = () => (
    <Card title="题型设置" style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ marginRight: 8 }}>试题难度：</Text>
        <Select value={difficulty} onChange={setDifficulty} style={{ width: 120 }}>
          <Option value="简单">简单</Option>
          <Option value="中等">中等</Option>
          <Option value="困难">困难</Option>
        </Select>
      </div>
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

  // 学生端左侧菜单项
  const studentMenuItems = [
    { key: 'qa', icon: <BookOutlined />, label: '知识库问答' },
    { key: 'exam', icon: <FormOutlined />, label: '考试系统' },
    { key: 'analysis', icon: <DatabaseOutlined />, label: '学情分析' },
    { key: 'wrongbook', icon: <BookOutlined />, label: '错题巩固' },
    { key: 'assistant', icon: <BookOutlined />, label: '学习助手' }, // 新增
  ];
  // 学生端菜单状态，支持 localStorage 恢复
  const [activeStudentMenu, setActiveStudentMenu] = useState(() => localStorage.getItem('activeStudentMenu') || 'qa');
  useEffect(() => { localStorage.setItem('activeStudentMenu', activeStudentMenu); }, [activeStudentMenu]);

  // 学生端内容区渲染
  const renderStudentContent = () => {
    switch (activeStudentMenu) {
      case 'qa':
        return (
          <Card title="知识库问答" style={{ marginBottom: 24, maxWidth: 1200, margin: '0 auto' }}>
            <TextArea
              rows={3}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="请输入你的问题..."
              style={{ marginBottom: 16 }}
            />
            <Button type="primary" onClick={handleAsk} loading={qaLoading} disabled={qaLoading}>
              提问
            </Button>
            <div style={{ marginTop: 16, minHeight: 60 }}>
              {qaLoading ? <Spin /> : answer && (
                <div style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
                  <Text strong>AI助手：</Text>
                  <MarkdownWithLatex>{answer}</MarkdownWithLatex>
                </div>
              )}
            </div>
            {/* 新增：可下载资料列表 */}
            <div style={{ marginTop: 32 }}>
              <b>可下载资料：</b>
              <List
                dataSource={knowledgeFiles.filter(f => f.student_can_download)}
                renderItem={file => (
                  <List.Item>
                    <span>{file.filename}</span>
                    <span style={{ color: '#bbb', marginLeft: 12 }}>{file.upload_time}</span>
                    <Button
                      style={{ marginLeft: 16 }}
                      onClick={() => handleDownload(file.filename)}
                      type="link"
                    >下载</Button>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        );
      case 'exam':
        return (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              width: '100%',
              minHeight: 400,
              background: 'transparent',
              margin: '0 auto',
              justifyContent: 'flex-start'
            }}
          >
            {studentExams.length === 0 ? (
              <div style={{ color: '#888', fontSize: 18, margin: '80px auto' }}>暂无可参加的考试</div>
            ) : (
              studentExams.map((exam) => (
                <Card
                  key={exam.id}
                  title={<span style={{ fontWeight: 600, fontSize: 20 }}>{exam.title}</span>}
                  bordered={false}
                  style={{
                    width: 340,
                    minHeight: 220,
                    boxShadow: '0 2px 12px #e6eaf1',
                    borderRadius: 14,
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                  bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20 }}
                  extra={
                    exam.completed ? (
                      <Tag color="green" style={{ fontWeight: 600 }}>已完成</Tag>
                    ) : (
                      <Tag color="blue" style={{ fontWeight: 600 }}>未完成</Tag>
                    )
                  }
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#888', marginBottom: 8 }}>{exam.description}</div>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color="blue">时长: {exam.duration} 分钟</Tag>
                      <span style={{ color: '#aaa', marginLeft: 8 }}>创建时间: {formatDateTime(exam.created_at)}</span>
                    </div>
                    {exam.completed && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>得分: {exam.score}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {exam.completed ? (
                      <Button size="small" type="primary" ghost onClick={() => viewExamResult(exam.id)}>
                        查看结果
                      </Button>
                    ) : (
                      <Button type="primary" onClick={() => startExam(exam.id)}>
                        开始考试
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        );
      case 'analysis':
        return <StudentAnalysis />;
      case 'wrongbook':
        return <StudentWrongbook />;
      case 'assistant':
        return <SocraticAssistant />;
      default:
        return null;
    }
  };

  function StudentAnalysis() {
    const [accuracyData, setAccuracyData] = useState([]);
    const [keywordAccuracy, setKeywordAccuracy] = useState([]);
    // 新增：存储每场考试的知识点正确率
    const [examKeywordAccuracy, setExamKeywordAccuracy] = useState({});
    // 新增：存储 tooltip 的 examId，强制刷新
    const [tooltipExamId, setTooltipExamId] = useState(null);
    const [hoveredExamId, setHoveredExamId] = useState(null);

    const fetchStudentAnalysis = async () => {
      try {
        const res = await axios.get('http://localhost:8000/student/analysis');
        setAccuracyData(res.data.accuracy_curve || []);
        setKeywordAccuracy(res.data.keyword_accuracy || []);
      } catch (error) {
        console.error('获取学情分析失败:', error);
      }
    };

    useEffect(() => {
      fetchStudentAnalysis();
      axios.get('http://localhost:8000/student/keyword-accuracy').then(res => {
        setKeywordAccuracy(res.data.keyword_accuracy || []);
      });
      // 新增：监听 updateStudentAnalysis 事件
      const handler = () => fetchStudentAnalysis();
      window.addEventListener('updateStudentAnalysis', handler);
      return () => window.removeEventListener('updateStudentAnalysis', handler);
    }, []);

    // 只保留正确率低于80%的知识点
    const weakKeywords = keywordAccuracy.filter(item => item.accuracy < 80);
    // 词云数据，声明为 let，后续根据 hoveredExamId 赋值（只声明一次）
    let tagData = [];
    if (hoveredExamId && examKeywordAccuracy[hoveredExamId]) {
      tagData = (examKeywordAccuracy[hoveredExamId] || []).map(item => ({
        value: item.keyword,
        count: Math.max(20, Math.round(40 + (80 - item.accuracy) * 1.5)),
        accuracy: item.accuracy,
        disabled: item.accuracy === 100
      }));
    } else {
      tagData = weakKeywords.map(item => ({
        value: item.keyword,
        count: Math.max(20, Math.round(40 + (80 - item.accuracy) * 1.5)),
        accuracy: item.accuracy,
        disabled: item.accuracy === 100
      }));
    }

    // ECharts option
    const echartsOption = {
      title: { text: '历次考试正确率曲线', left: 'center' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        // formatter 支持异步
        formatter: function (params) {
          if (!params || !params.length) return '';
          const d = params[0].data;
          const examId = d.exam_id;
          setTooltipExamId(examId); // 触发 useEffect
          setHoveredExamId(examId); // 新增：记录悬停考试id
          let content = `<div><div>考试：${d.exam_title || '-'}<\/div><div>总正确率：${d.accuracy != null ? d.accuracy + '%' : '-'}<\/div><div>知识点正确率：<\/div>`;
          const keywordData = examKeywordAccuracy[examId];
          if (!keywordData) {
            // 触发异步请求
            axios.get(`http://localhost:8000/student/exam-keyword-accuracy/${examId}`)
              .then(res => {
                setExamKeywordAccuracy(prev => ({ ...prev, [examId]: res.data }));
              })
              .catch(() => {
                setExamKeywordAccuracy(prev => ({ ...prev, [examId]: [] }));
              });
            content += '<div style="color:#aaa">加载中...<\/div>';
          } else if (Array.isArray(keywordData) && keywordData.length > 0) {
            content += '<ul style="margin:0;padding-left:16px">' +
              keywordData.map(item => `<li>${item.keyword}：${item.accuracy != null ? item.accuracy + '%' : '-'}（${item.correct || 0}/${item.total || 0}）<\/li>`).join('') +
              '<\/ul>';
          } else {
            content += '<div style="color:#aaa">暂无数据<\/div>';
          }
          content += '<\/div>';
          return content;
        },
        // 新增：tooltip消失时清空 hoveredExamId
        hideDelay: 100,
        enterable: true,
        confine: true,
        extraCssText: 'z-index: 9999;',
        // ECharts 5 支持事件
        triggerOn: 'mousemove|click',
        // 监听 tooltip 隐藏
        // 下面的 events 仅供参考，实际需在 onEvents 里处理
      },
      xAxis: {
        type: 'category',
        name: '考试',
        data: (accuracyData.length > 0 ? accuracyData : []).map(d => d.exam_title),
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { rotate: 0 }
      },
      yAxis: {
        type: 'value',
        name: '正确率(%)',
        min: 0,
        max: 100,
        nameLocation: 'middle',
        nameGap: 40
      },
      series: [
        {
          data: (accuracyData.length > 0 ? accuracyData : []).map(d => ({ ...d, value: d.accuracy })),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          lineStyle: { width: 3, color: '#1677ff' },
          itemStyle: { color: '#1677ff', borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true,
            formatter: p => (p.data.accuracy == null ? '-' : p.data.accuracy + '%'),
            fontSize: 12,
            color: '#666',
            fontWeight: 500
          }
        }
      ],
      grid: { left: 40, right: 20, top: 60, bottom: 60 }
    };

    // 词云鼠标移出时清空 hoveredExamId
    const handleChartEvents = {
      mouseout: () => setHoveredExamId(null)
    };

    // ECharts 词云 option
    const wordCloudOption = {
      tooltip: {
        formatter: function(params) {
          return `知识点：${params.name}<br/>正确率：${params.data && params.data.accuracy !== undefined ? params.data.accuracy + '%' : '--'}`;
        }
      },
      series: [{
        type: 'wordCloud',
        gridSize: 8,
        sizeRange: [20, 60],
        rotationRange: [-45, 90],
        shape: 'circle',
        textStyle: {
          color: (params) => {
            // 100% 正确率变灰色
            if (params && params.data && params.data.accuracy === 100) return '#bbb';
            const colors = ['#1677ff', '#52c41a', '#faad14', '#d4380d', '#722ed1'];
            return colors[Math.floor(Math.random() * colors.length)];
          }
        },
        data: tagData.map(item => ({
          name: item.value,
          value: item.count,
          accuracy: item.accuracy
        }))
      }]
    };

    // 词云点击事件：切换到错题本并选中知识点（修正顺序）
    const handleWordClick = params => {
      if (params && params.name) {
        // 查找当前词条是否 disabled
        const tag = tagData.find(t => t.value === params.name);
        if (tag && tag.disabled) return;
        window.selectedWrongbookKeyword = params.name;
        setActiveStudentMenu('wrongbook');
      }
    };

    // 统计卡片和词云部分保持不变，折线图部分替换为 ECharts
    return (
      <Card style={{ marginBottom: 32, borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
        {/* 统计信息卡片 ... 保持原样 ... */}
        <div className="stats-grid fade-in-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div className="stats-card" style={{
            background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #91d5ff',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1677ff', marginBottom: '8px' }}>
              {accuracyData.length}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>参加考试次数</div>
          </div>
          
          <div className="stats-card" style={{
            background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #b7eb8f',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a', marginBottom: '8px' }}>
              {accuracyData.length > 0 ? 
                Math.round(accuracyData.reduce((sum, item) => sum + item.accuracy, 0) / accuracyData.length) : 
                0}%
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>平均正确率</div>
          </div>
          
          <div className="stats-card" style={{
            background: 'linear-gradient(135deg, #fff7e6 0%, #ffd591 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #ffc53d',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14', marginBottom: '8px' }}>
              {weakKeywords.length}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>薄弱知识点</div>
          </div>
          
          <div className="stats-card" style={{
            background: 'linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid #ffa39e',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5222d', marginBottom: '8px' }}>
              {accuracyData.length > 0 ? 
                accuracyData.filter(item => item.accuracy < 60).length : 
                0}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>需加强考试</div>
          </div>
        </div>
        {/* 折线图部分用 ECharts 替换 */}
        <div className="chart-container fade-in-up" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)', border: '1px solid #e8e8e8', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '0', left: '0', right: '0', height: '3px', background: 'linear-gradient(90deg, #1677ff 0%, #52c41a 50%, #faad14 100%)' }} />
          <ReactECharts option={echartsOption} style={{ height: 320 }} notMerge={true} onEvents={handleChartEvents} />
        </div>
        {/* 词云部分用 ECharts 替换 */}
        <div className="wordcloud-container fade-in-up" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: 240,
          background: 'linear-gradient(135deg, #fff7e6 0%, #fff2e8 100%)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #ffd591'
        }}>
          <ReactECharts 
            option={wordCloudOption} 
            style={{ width: 650, height: 240 }} 
            onEvents={{ click: handleWordClick }}
          />
        </div>
      </Card>
    );
  }

  function StudentWrongbook() {
    const [keywords, setKeywords] = useState([]);
    const [accuracyMap, setAccuracyMap] = useState({}); // 新增：知识点正确率
    const [selectedKeyword, setSelectedKeyword] = useState('');
    const [questions, setQuestions] = useState([]);
    const [activeQuestion, setActiveQuestion] = useState(null);
    const [answer, setAnswer] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    // 巩固练习相关
    const [practiceModal, setPracticeModal] = useState(false);
    const [practiceCount, setPracticeCount] = useState(5);
    const [practiceQuestions, setPracticeQuestions] = useState([]);
    const [practiceAnswers, setPracticeAnswers] = useState({});
    const [practiceResult, setPracticeResult] = useState(null);
    const [practiceLoading, setPracticeLoading] = useState(false);
    const [practiceHistory, setPracticeHistory] = useState([]); // 新增：巩固练习历史

    useEffect(() => {
      axios.get('http://localhost:8000/student/wrongbook/keywords').then(res => {
        setKeywords(res.data || []);
      });
      // 拉取知识点正确率
      axios.get('http://localhost:8000/student/keyword-accuracy').then(res => {
        const map = {};
        (res.data.keyword_accuracy || []).forEach(item => {
          map[item.keyword] = item.accuracy;
        });
        setAccuracyMap(map);
      });
    }, []);

    useEffect(() => {
      if (selectedKeyword) {
        setLoading(true);
        axios.get('http://localhost:8000/student/wrongbook/questions', { params: { keyword: selectedKeyword } })
          .then(res => setQuestions(res.data || []))
          .finally(() => setLoading(false));
        // 新增：拉取巩固练习历史
        axios.get('http://localhost:8000/student/practice-records', { params: { keyword: selectedKeyword } })
          .then(res => setPracticeHistory(res.data || []));
      }
    }, [selectedKeyword]);

    useEffect(() => {
      if (window.selectedWrongbookKeyword) {
        setSelectedKeyword(window.selectedWrongbookKeyword);
        window.selectedWrongbookKeyword = null;
      }
    }, []);

    // 标签区优化：可取消选择，悬停气泡显示正确率，颜色区分
    const handleSelectKeyword = (keyword) => {
      if (selectedKeyword === keyword) {
        setSelectedKeyword('');
        setQuestions([]);
        setPracticeHistory([]);
      } else {
        setSelectedKeyword(keyword);
        setResult(null);
        setActiveQuestion(null);
      }
    };

    // 错题重做弹窗美化
    const redoInputRef = React.useRef(null);
    useEffect(() => {
      if (activeQuestion && redoInputRef.current) {
        redoInputRef.current.focus();
      }
    }, [activeQuestion]);

    const handleRedoKeyDown = (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    };

    const handleSubmit = async () => {
      if (!activeQuestion) return;
      setLoading(true);
      try {
        const res = await axios.post('http://localhost:8000/student/wrongbook/submit',
          new URLSearchParams({ wrong_id: activeQuestion.id, answer })
        );
        setResult(res.data);
      } catch (e) {
        message.error('提交失败');
      }
      setLoading(false);
    };

    // 巩固练习相关
    const handleGeneratePractice = async () => {
      if (!selectedKeyword) return;
      setPracticeLoading(true);
      setPracticeQuestions([]);
      setPracticeResult(null);
      setPracticeAnswers({});
      try {
        const res = await axios.post('http://localhost:8000/student/generate-practice',
          new URLSearchParams({ keyword: selectedKeyword, count: practiceCount, difficulty: '中等' })
        );
        setPracticeQuestions(res.data.questions || []);
      } catch (e) {
        message.error('生成习题失败');
      }
      setPracticeLoading(false);
    };
    const handleSubmitPractice = async () => {
      setPracticeLoading(true);
      try {
        const answers = practiceQuestions.map((q, idx) => ({
          question: q.question,
          answer: practiceAnswers[idx] || '',
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          knowledge_points: q.knowledge_points,
          options: q.options // 关键：加上这一行
        }));
        const res = await axios.post('http://localhost:8000/student/submit-practice',
          new URLSearchParams({ answers_data: JSON.stringify(answers), keyword: selectedKeyword })
        );
        setPracticeResult(res.data);
        // 新增：提交后刷新正确率
        const accRes = await axios.get('http://localhost:8000/student/keyword-accuracy');
        const map = {};
        (accRes.data.keyword_accuracy || []).forEach(item => {
          map[item.keyword] = item.accuracy;
        });
        setAccuracyMap(map);
        // 新增：刷新巩固练习历史
        const historyRes = await axios.get('http://localhost:8000/student/practice-records', { params: { keyword: selectedKeyword } });
        setPracticeHistory(historyRes.data || []);
      } catch (e) {
        message.error('提交失败');
      }
      setPracticeLoading(false);
    };

    // 巩固练习进度条
    const practiceProgress = practiceQuestions.length > 0 ? Math.round(Object.keys(practiceAnswers).length / practiceQuestions.length * 100) : 0;

    return (
      <Card title={<span style={{ fontWeight: 700, fontSize: 22 }}><BookOutlined style={{ color: '#1677ff', marginRight: 8 }} />错题本</span>} style={{ maxWidth: 1200, margin: '0 auto', marginBottom: 24, borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
        {/* 知识点标签区美化 */}
        <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          <b style={{ marginRight: 12 }}>知识点标签：</b>
          {keywords.length === 0 ? <Empty description="暂无错题" /> :
            keywords.map(k => (
              <Tag.CheckableTag
                key={k.keyword}
                checked={selectedKeyword === k.keyword}
                onChange={() => handleSelectKeyword(k.keyword)}
                style={{
                  fontSize: 16,
                  margin: 6,
                  background: selectedKeyword === k.keyword ? '#e6f7ff' : '#f5f5f5',
                  border: selectedKeyword === k.keyword ? '1.5px solid #1890ff' : '1px solid #eee',
                  color: accuracyMap[k.keyword] < 60 ? '#f5222d' : accuracyMap[k.keyword] < 80 ? '#faad14' : '#52c41a',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  boxShadow: selectedKeyword === k.keyword ? '0 2px 8px #bae7ff' : 'none'
                }}
                title={`正确率：${accuracyMap[k.keyword] !== undefined ? accuracyMap[k.keyword] + '%' : '--'}`}
              >
                {k.keyword}
                <span style={{ color: '#bbb', fontSize: 12, marginLeft: 4 }}>正确率：{accuracyMap[k.keyword] !== undefined ? accuracyMap[k.keyword] + '%' : '--'}</span>
              </Tag.CheckableTag>
            ))}
        </div>
        {/* 错题列表美化 */}
        {selectedKeyword && (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#888', marginRight: 16 }}>
                正确率：{accuracyMap[selectedKeyword] !== undefined ? accuracyMap[selectedKeyword] + '%' : '--'}
              </span>
              <Button size="small" type="primary" ghost onClick={() => setPracticeModal(true)} style={{ borderRadius: 16, fontWeight: 600 }}>
                巩固练习
              </Button>
            </div>
            <b style={{ fontSize: 18 }}>错题列表{selectedKeyword ? `（${selectedKeyword}）` : ''}：</b>
            {loading ? <Spin style={{ marginLeft: 16 }} /> : (
              <List
                dataSource={questions}
                locale={{ emptyText: <Empty description="该知识点暂无错题" /> }}
                renderItem={q => (
                  <List.Item style={{ padding: '16px 0', border: 'none', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{q.question}</div>
                      {q.options && Object.keys(q.options).length > 0 && (
                        <div style={{ margin: '8px 0' }}>
                          {Object.entries(q.options).map(([k, v]) => (
                            <div key={k}>{k}. {v}</div>
                          ))}
                        </div>
                      )}
                      <Button type="primary" ghost onClick={() => {
                        setActiveQuestion(q);
                        setAnswer('');
                        setResult(null);
                      }} style={{ marginTop: 8, borderRadius: 12, fontWeight: 600 }}>重做</Button>
                    </div>
                  </List.Item>
                )}
              />
            )}
            {/* 巩固练习历史 */}
            <div style={{ marginTop: 32 }}>
              <b style={{ fontSize: 16 }}>巩固练习历史：</b>
              {practiceHistory.length === 0 ? (
                <div style={{ color: '#aaa', margin: '12px 0' }}><Empty description="暂无巩固练习记录" /></div>
              ) : (
                <List
                  dataSource={practiceHistory}
                  renderItem={h => (
                    <List.Item style={{ padding: '16px 0', border: 'none', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{h.question}</div>
                        {h.options && Object.keys(h.options).length > 0 && (
                          <div style={{ margin: '8px 0' }}>
                            {Object.entries(h.options).map(([k, v]) => (
                              <div key={k}>{k}. {v}</div>
                            ))}
                          </div>
                        )}
                        <div style={{ margin: '8px 0' }}>你的答案：{h.student_answer}</div>
                        <div style={{ margin: '8px 0' }}>正确答案：{h.correct_answer}</div>
                        <div style={{ margin: '8px 0' }}>解析：{h.explanation}</div>
                        <div style={{ color: '#888', fontSize: 12 }}>{h.time}</div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </div>
        )}
        {/* 错题重做弹窗美化 */}
        <Modal
          open={!!activeQuestion}
          onCancel={() => { setActiveQuestion(null); setResult(null); setAnswer(''); }}
          footer={null}
          title={<span style={{ fontWeight: 700, fontSize: 20 }}>错题重做</span>}
          bodyStyle={{ padding: 24 }}
        >
          {activeQuestion && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 16 }}>{activeQuestion.question}</div>
              {activeQuestion.options && Object.keys(activeQuestion.options).length > 0 ? (
                <Radio.Group
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  style={{ marginBottom: 16 }}
                >
                  <Space direction="vertical">
                    {Object.entries(activeQuestion.options).map(([k, v]) => (
                      <Radio key={k} value={k}>{k}. {v}</Radio>
                    ))}
                  </Space>
                </Radio.Group>
              ) : (
                <Input
                  ref={redoInputRef}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={handleRedoKeyDown}
                  placeholder="请输入答案"
                  style={{ width: '100%', marginBottom: 16, fontSize: 16, padding: 8, borderRadius: 8 }}
                />
              )}
              <Button type="primary" onClick={handleSubmit} loading={loading} style={{ marginTop: 8, width: '100%', borderRadius: 12, fontWeight: 600 }}>
                提交
              </Button>
              {result && (
                <Result
                  status={result.is_correct ? 'success' : 'error'}
                  title={result.is_correct ? '回答正确' : '回答错误'}
                  subTitle={
                    <div style={{ marginTop: 8 }}>
                      <div>你的答案：<span style={{ color: result.is_correct ? '#52c41a' : '#d4380d' }}>{result.your_answer}</span></div>
                      <div>正确答案：<span style={{ color: '#52c41a' }}>{result.correct_answer}</span></div>
                      <div>解析：{result.explanation}</div>
                    </div>
                  }
                />
              )}
            </div>
          )}
        </Modal>
        {/* 巩固练习弹窗美化 */}
        <Modal
          open={practiceModal}
          onCancel={() => { setPracticeModal(false); setPracticeQuestions([]); setPracticeResult(null); setPracticeAnswers({}); }}
          footer={null}
          title={<span style={{ fontWeight: 700, fontSize: 20 }}>巩固练习 - {selectedKeyword}</span>}
          bodyStyle={{ padding: 24 }}
          width={700}
        >
          <div style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              onClick={handleGeneratePractice}
              loading={practiceLoading}
              disabled={practiceLoading || !selectedKeyword}
              style={{ marginRight: 16 }}
            >
              生成巩固练习
            </Button>
            <span style={{ color: '#888' }}>共 {practiceQuestions.length} 题</span>
            <Progress percent={practiceProgress} size="small" style={{ width: 200, display: 'inline-block', marginLeft: 16 }} />
          </div>
          {practiceQuestions.length === 0 ? (
            <Empty description="暂无巩固练习题目" />
          ) : (
            <List
              dataSource={practiceQuestions}
              renderItem={(q, idx) => (
                <List.Item style={{ padding: '16px 0', border: 'none', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>题目{idx + 1}：{q.question}</div>
                    {q.options && Object.keys(q.options).length > 0 ? (
                      <Radio.Group
                        value={practiceAnswers[idx]}
                        onChange={e => setPracticeAnswers({ ...practiceAnswers, [idx]: e.target.value })}
                        style={{ marginBottom: 8 }}
                      >
                        <Space direction="vertical">
                          {Object.entries(q.options).map(([k, v]) => (
                            <Radio key={k} value={k}>{k}. {v}</Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    ) : (
                      <Input
                        value={practiceAnswers[idx] || ''}
                        onChange={e => setPracticeAnswers({ ...practiceAnswers, [idx]: e.target.value })}
                        placeholder="请输入答案"
                        style={{ width: '100%', marginBottom: 8, fontSize: 16, padding: 8, borderRadius: 8 }}
                      />
                    )}
                  </div>
                </List.Item>
              )}
            />
          )}
          {practiceQuestions.length > 0 && !practiceResult && (
            <Button type="primary" onClick={handleSubmitPractice} loading={practiceLoading} style={{ marginTop: 16, width: '100%', borderRadius: 12, fontWeight: 600 }}>
              提交练习
            </Button>
          )}
          {/* 练习结果美化 */}
          {practiceResult && (
            <Card title={<span>练习得分：<span style={{ color: '#52c41a' }}>{practiceResult.score}</span></span>} style={{ marginTop: 16, borderRadius: 12 }}>
              <List
                dataSource={practiceResult.results}
                renderItem={(r, idx) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div><b>题目{idx + 1}：</b>{r.question}</div>
                      <div>你的答案：<span style={{ color: r.is_correct ? '#52c41a' : '#d4380d' }}>{r.answer}</span></div>
                      <div>正确答案：<span style={{ color: '#52c41a' }}>{r.correct_answer}</span></div>
                      <div>解析：{r.explanation}</div>
                      <div>知识点：{Array.isArray(r.knowledge_points) ? r.knowledge_points.join('，') : r.knowledge_points}</div>
                      <div>判定：{r.is_correct ? <Tag color="green">正确</Tag> : <Tag color="red">错误</Tag>}</div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Modal>
      </Card>
    );
  }

  // 在App组件内添加下载函数
  const handleDownload = async (filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/download/${filename}`, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('下载失败：' + (err.response?.data?.detail || err.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  // 未登录时只渲染登录/注册界面和欢迎页
  if (!currentUser) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            <BookOutlined /> 智能教学助手
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
            title="欢迎使用智能教学助手"
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
        <Footer style={{ textAlign: 'center' }}>智能教学助手 ©2025</Footer>
        {renderLoginModal()}
        {renderRegisterModal()}
      </Layout>
    );
  }

  return (
    currentUser?.role === 'teacher'
      ? renderTeacherLayout()
      : currentUser?.role === 'admin'
        ? renderAdminLayout(activeAdminMenu, setActiveAdminMenu, handleLogout)
        : (
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Sider width={220} style={{ background: '#f4f6fa', boxShadow: '2px 0 8px #e6eaf1', borderRight: '1.5px solid #e6eaf1', paddingTop: 0 }}>
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 22,
            color: '#1677ff',
            letterSpacing: 2,
            marginBottom: 16,
            background: 'linear-gradient(90deg, #1677ff 0%, #49c7f7 100%)',
            borderRadius: '0 0 18px 18px',
            boxShadow: '0 2px 8px #e6eaf1',
          }}>
            <BookOutlined style={{ fontSize: 28, marginRight: 8, color: '#fff' }} />
            <span style={{ color: '#fff' }}>智能教学助手</span>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[activeStudentMenu]}
            onClick={({ key }) => setActiveStudentMenu(key)}
            style={{ height: '100%', borderRight: 0, fontSize: 18, background: '#f4f6fa', fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif', fontWeight: 500 }}
            items={studentMenuItems.map(item => ({
              ...item,
              style: {
                borderRadius: 10,
                margin: '6px 8px',
                transition: 'background 0.2s',
              }
            }))}
            theme="light"
          />
        </Layout.Sider>
        <Layout>
          {/* 顶部Header */}
          <div style={{ height: 64, background: '#f4f6fa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 32px' }}>
          <Space>
              <Text style={{ color: '#1677ff', fontWeight: 600 }}>
              学生：{currentUser?.username}
            </Text>
              <Button type="primary" icon={<LogoutOutlined />} onClick={logout} style={{ borderRadius: 20, fontWeight: 500 }}>
              退出登录
            </Button>
          </Space>
          </div>
          <Layout.Content style={{ padding: '48px 0', background: '#f4f6fa', minHeight: 800, fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32, background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1', minHeight: 600 }}>
              {examInProgress ? renderExamInterface() : renderStudentContent()}
            </div>
          </Layout.Content>
          <Footer style={{ textAlign: 'center', background: '#f4f6fa', color: '#888', fontWeight: 500, letterSpacing: 1 }}>智能教学助手 ©2025</Footer>
        </Layout>
      </Layout>
    )
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
        setAiSummary(res.data.ai_summary || '');
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
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={220} style={{ background: '#f4f6fa', boxShadow: '2px 0 8px #e6eaf1', borderRight: '1.5px solid #e6eaf1', paddingTop: 0 }}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 22,
          color: '#1677ff',
          letterSpacing: 2,
          marginBottom: 16,
          background: 'linear-gradient(90deg, #1677ff 0%, #49c7f7 100%)',
          borderRadius: '0 0 18px 18px',
          boxShadow: '0 2px 8px #e6eaf1',
        }}>
          <BookOutlined style={{ fontSize: 28, marginRight: 8, color: '#fff' }} />
          <span style={{ color: '#fff' }}>智能教学助手</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={['exam']}
          onClick={({ key }) => {
            if (key === 'qa') navigate('/');
            else if (key === 'exam') navigate('/');
            else if (key === 'analysis') navigate('/');
            else if (key === 'wrongbook') navigate('/');
          }}
          style={{ height: '100%', borderRight: 0, fontSize: 18, background: '#f4f6fa', fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif', fontWeight: 500 }}
          items={[
            {
              key: 'qa',
              icon: <BookOutlined />,
              label: '知识库问答',
              style: { borderRadius: 10, margin: '6px 8px', transition: 'background 0.2s' }
            },
            {
              key: 'exam',
              icon: <FormOutlined />,
              label: '考试系统',
              style: { borderRadius: 10, margin: '6px 8px', transition: 'background 0.2s' }
            },
            {
              key: 'analysis',
              icon: <BarChartOutlined />,
              label: '学情分析',
              style: { borderRadius: 10, margin: '6px 8px', transition: 'background 0.2s' }
            },
            {
              key: 'wrongbook',
              icon: <BookOutlined />,
              label: '错题本',
              style: { borderRadius: 10, margin: '6px 8px', transition: 'background 0.2s' }
            }
          ]}
          theme="light"
        />
      </Layout.Sider>
      <Layout>
        <div style={{ height: 64, background: '#f4f6fa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 32px' }}>
          <Space>
            <Button type="primary" icon={<LogoutOutlined />} onClick={() => navigate('/')} style={{ borderRadius: 20, fontWeight: 500 }}>
              返回主页
            </Button>
          </Space>
        </div>
        <Layout.Content style={{ padding: '48px 0', background: '#f4f6fa', minHeight: 800, fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32, background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1', minHeight: 600 }}>
            <Card title={<span>考试结果 <Button style={{ float: 'right' }} onClick={() => navigate(-1)}>返回</Button></span>}>
      <Title level={3} style={{ color: '#52c41a' }}>总分：{result.score}</Title>
      <Text type="secondary">用时：{minutes}分{seconds}秒</Text>
      <Divider />
      <List
        dataSource={result.answers}
        renderItem={(a, idx) => (
          <List.Item>
            <Card style={{ width: '100%' }}>
                      {/* 题干部分，样式与考试界面一致 */}
                      <div style={{ marginBottom: 16 }}>
                        <Text strong>第 {idx + 1} 题 ({a.points} 分)</Text>
                        <Tag style={{ marginLeft: 8 }}>{a.type === 'choice' ? '单选题' : a.type === 'multi' ? '多选题' : a.type === 'fill_blank' ? '填空题' : a.type === 'short_answer' ? '简答题' : a.type === 'programming' ? '编程题' : a.type}</Tag>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <Text>{a.question}</Text>
                      </div>
                      {/* 新增：显示选项 */}
                      {(a.type === 'choice' || a.type === 'multi') && a.options && Object.keys(a.options).length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          {Object.entries(a.options).map(([key, value]) => (
                            <div key={key} style={{ marginBottom: 4 }}>
                              <Text>{key}. {value}</Text>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 结果与解析部分 */}
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
              <div style={{ marginBottom: 8 }}><b>你的答案：</b>{formatAnswer(a.answer)}</div>
              <div style={{ marginBottom: 8 }}><b>正确答案：</b>{formatAnswer(a.correct_answer)}</div>
              <div style={{ marginBottom: 8 }}><b>解析：</b>{a.explanation || '无'}</div>
                      {/* 新增：显示知识点关键词 */}
                      {a.knowledge_points && a.knowledge_points.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="geekblue">知识点：{Array.isArray(a.knowledge_points) ? a.knowledge_points.join('，') : a.knowledge_points}</Tag>
                        </div>
                      )}
              {['short_answer', 'programming'].includes(a.type) && a.is_correct !== null && (
                <div style={{ marginBottom: 8 }}><b>老师评语：</b>{a.comment || '无'}</div>
              )}
            </Card>
          </List.Item>
        )}
      />
      <Divider />
      <Title level={4}>AI总结你的薄弱点</Title>
      <div style={{ minHeight: 60 }}>
        {typeof aiSummary === 'string' && aiSummary.trim()
          ? <MarkdownWithLatex>{aiSummary}</MarkdownWithLatex>
          : 'AI正在分析...'}
      </div>
    </Card>
          </div>
        </Layout.Content>
        <Footer style={{ textAlign: 'center', background: '#f4f6fa', color: '#888', fontWeight: 500, letterSpacing: 1 }}>智能教学助手 ©2025</Footer>
      </Layout>
    </Layout>
  );
} 

// 新增 SocraticAssistant 组件
function SocraticAssistant() {
  const [history, setHistory] = useState([]); // {role: 'ai'|'student', content: string, knowledge_point?: string}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const chatListRef = useRef(null);
  const [lastKnowledgePoint, setLastKnowledgePoint] = useState(null);

  // 首次加载自动请求第一个问题
  useEffect(() => {
    if (history.length === 0) {
      fetchNextQuestion();
    }
    // eslint-disable-next-line
  }, []);

  // 聊天区自动滚动到底部
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [history, aiThinking, loading]);

  // 请求AI下一个问题
  const fetchNextQuestion = async () => {
    setLoading(true);
    setAiThinking(true);
    try {
      const res = await axios.post('http://localhost:8000/student/socratic-assistant', {
        history,
        action: 'next',
        current_knowledge_point: lastKnowledgePoint
      });
      setHistory(h => [...h, { role: 'ai', content: res.data.question, knowledge_point: res.data.knowledge_point }]);
      setLastKnowledgePoint(res.data.knowledge_point);
    } catch (e) {
      setHistory(h => [...h, { role: 'ai', content: 'AI助手暂时无法提问，请稍后重试。' }]);
    }
    setLoading(false);
    setAiThinking(false);
  };

  // 学生提交答案
  const handleSubmit = async () => {
    if (!input.trim()) return;
    setHistory(h => [...h, { role: 'student', content: input }]);
    setInput('');
    setAiThinking(true);
    try {
      const res = await axios.post('http://localhost:8000/student/socratic-assistant', {
        history: [...history, { role: 'student', content: input }],
        action: 'answer',
        answer: input,
        current_knowledge_point: lastKnowledgePoint
      });
      setHistory(h => [...h, { role: 'ai', content: res.data.reply, knowledge_point: res.data.knowledge_point }]);
      setLastKnowledgePoint(res.data.knowledge_point);
    } catch (e) {
      setHistory(h => [...h, { role: 'ai', content: 'AI助手暂时无法回复，请稍后重试。' }]);
    }
    setAiThinking(false);
  };

  // "我不会"请求AI讲解
  const handleExplain = async () => {
    setHistory(h => [...h, { role: 'student', content: '我不会' }]);
    setAiThinking(true);
    try {
      const res = await axios.post('http://localhost:8000/student/socratic-assistant', {
        history: [...history, { role: 'student', content: '我不会' }],
        action: 'explain',
        current_knowledge_point: lastKnowledgePoint
      });
      setHistory(h => [...h, { role: 'ai', content: res.data.explanation, knowledge_point: res.data.knowledge_point }]);
      setLastKnowledgePoint(res.data.knowledge_point);
    } catch (e) {
      setHistory(h => [...h, { role: 'ai', content: 'AI助手暂时无法讲解，请稍后重试。' }]);
    }
    setAiThinking(false);
  };

  return (
    <div
      style={{
        width: '100%',
        height: 'calc(100vh - 64px - 48px)',
        minHeight: 480,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e6f7ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: 0,
        margin: 0,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '32px 0 0 0',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 26, color: '#1677ff', margin: '0 0 18px 32px', letterSpacing: 1, display: 'flex', alignItems: 'center' }}>
          <RobotOutlined style={{ color: '#1677ff', marginRight: 10, fontSize: 30 }} />学习助手
        </div>
        <div
          ref={chatListRef}
          style={{
            flex: 1,
            minHeight: 320,
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: '0 32px 0 32px',
            marginBottom: 16,
            background: 'rgba(246,248,250,0.7)',
            borderRadius: 16,
          }}
        >
          {history.length === 0 && (
            <div style={{ color: '#aaa', textAlign: 'center', marginTop: 40 }}>
              <Spin /> AI正在准备问题...
            </div>
          )}
          {history.map((msg, idx) => (
            <div key={idx} style={{ margin: '8px 0', textAlign: msg.role === 'ai' ? 'left' : 'right' }}>
              {msg.role === 'ai' ? (
                <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12, display: 'inline-block', maxWidth: 700 }}>
                  <MarkdownWithLatex>{msg.content}</MarkdownWithLatex>
              </div>
              ) : (
                <div style={{ background: '#e6f7ff', borderRadius: 8, padding: 12, display: 'inline-block', maxWidth: 700 }}>
                  {msg.content}
                </div>
              )}
            </div>
          ))}
          {aiThinking && (
            <div style={{ color: '#aaa', textAlign: 'left', margin: '8px 0 0 48px' }}>
              <Spin size="small" /> AI正在思考...
            </div>
          )}
        </div>
        <div style={{ width: '100%', maxWidth: 900, padding: '0 32px 32px 32px', background: 'transparent' }}>
          <Input.TextArea
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onPressEnter={e => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="请输入你的回答...(Enter发送, Shift+Enter换行)"
            disabled={loading || aiThinking}
            style={{ marginBottom: 12, borderRadius: 8, fontSize: 16 }}
          />
          <Space>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={aiThinking}
              disabled={!input.trim() || aiThinking}
            >
              提交
            </Button>
            <Button onClick={fetchNextQuestion} disabled={aiThinking || loading}>
              下一题
            </Button>
            <Button onClick={handleExplain} disabled={aiThinking || loading}>
              我不会
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
} 

// 新增管理员PPT导出组件
function AdminPPTExport() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:8000/admin/ppt-files').then(res => {
      setFiles(res.data.files || []);
    }).finally(() => setLoading(false));
  }, []);
  const handleDownload = (filename) => {
    downloadPPT(`http://localhost:8000/admin/ppt-files/download/${filename}`, filename);
  };
  return (
    <Card title="教师PPT导出" style={{ maxWidth: 1200, margin: '0 auto', marginTop: 32, borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
      <List
        loading={loading}
        dataSource={files}
        locale={{ emptyText: '暂无PPT文件' }}
        renderItem={file => (
          <List.Item actions={[<Button type="link" onClick={() => handleDownload(file.filename)}>下载</Button>]}> 
            <div style={{ width: '100%' }}>
              <b>{file.filename}</b>
              <span style={{ marginLeft: 16, color: '#888' }}>教师: {file.teacher}</span>
              <span style={{ marginLeft: 16, color: '#888' }}>创建时间: {file.created_at}</span>
              <span style={{ marginLeft: 16, color: '#888' }}>大小: {(file.size/1024).toFixed(1)} KB</span>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}

// 新增管理员活跃度统计组件
function AdminActivity() {
  const [data, setData] = useState({ teachers: [], students: [] });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:8000/admin/activity').then(res => {
      setData(res.data || { teachers: [], students: [] });
    }).finally(() => setLoading(false));
  }, []);
  // 美化表格样式
  const tableCardStyle = { borderRadius: 16, boxShadow: '0 2px 12px #e6eaf1', marginBottom: 32 };
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', marginTop: 32 }}>
      <Card title={<span style={{ fontWeight: 700, fontSize: 20, color: '#1677ff' }}>教师活跃度</span>} style={tableCardStyle} loading={loading}>
        <Table
          dataSource={data.teachers}
          rowKey="id"
          bordered
          columns={[
            { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
            { title: 'PPT生成数', dataIndex: 'ppt_count', key: 'ppt_count', width: 120, render: v => <Tag color="blue">{v}</Tag> },
            { title: '创建考试数', dataIndex: 'exam_count', key: 'exam_count', width: 120, render: v => <Tag color="purple">{v}</Tag> },
            { title: '登录频率', dataIndex: 'login_count', key: 'login_count', width: 120, render: v => <Tag color="green">{v || 0}</Tag> },
            { title: '最近活跃时间', dataIndex: 'last_active', key: 'last_active', width: 180 },
          ]}
          pagination={false}
          style={{ borderRadius: 12 }}
        />
      </Card>
      <Card title={<span style={{ fontWeight: 700, fontSize: 20, color: '#1677ff' }}>学生活跃度</span>} style={tableCardStyle} loading={loading}>
        <Table
          dataSource={data.students}
          rowKey="id"
          bordered
          columns={[
            { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
            { title: '参与考试数', dataIndex: 'exam_count', key: 'exam_count', width: 120, render: v => <Tag color="purple">{v}</Tag> },
            { title: '知识库问答数', dataIndex: 'qa_count', key: 'qa_count', width: 120, render: v => <Tag color="blue">{v}</Tag> },
            { title: '登录频率', dataIndex: 'login_count', key: 'login_count', width: 120, render: v => <Tag color="green">{v || 0}</Tag> },
            { title: '最近活跃时间', dataIndex: 'last_active', key: 'last_active', width: 180 },
          ]}
          pagination={false}
          style={{ borderRadius: 12 }}
        />
      </Card>
    </div>
  );
}

// 管理员菜单项
const adminMenuItems = [
  { key: 'ppt', icon: <FileTextOutlined />, label: 'PPT导出' },
  { key: 'activity', icon: <BarChartOutlined />, label: '活跃度统计' },
  { key: 'users', icon: <UserOutlined />, label: '用户管理' },
];

function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resetModal, setResetModal] = useState({ visible: false, user: null });
  const [resetPwd, setResetPwd] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get('http://localhost:8000/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data || []);
    } catch (e) {
      setUsers([]);
    }
    setLoading(false);
  };
  useEffect(() => { fetchUsers(); }, []);

  const handleResetPwd = async () => {
    if (!resetPwd) return message.warning('请输入新密码');
    setResetLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:8000/admin/users/reset-password', {
        user_id: resetModal.user.id,
        new_password: resetPwd,
      }, { headers: { Authorization: `Bearer ${token}` } });
      message.success('密码重置成功');
      setResetModal({ visible: false, user: null });
      setResetPwd('');
    } catch (e) {
      message.error('重置失败');
    }
    setResetLoading(false);
  };

  const handleDisable = async (user, disable) => {
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:8000/admin/users/disable', {
        user_id: user.id,
        disable,
      }, { headers: { Authorization: `Bearer ${token}` } });
      message.success(disable ? '已禁用' : '已启用');
      fetchUsers();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (user) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`http://localhost:8000/admin/users/delete/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success('用户已删除');
      fetchUsers();
    } catch (e) {
      message.error('删除失败');
    }
  };

  return (
    <Card title="用户管理" style={{ maxWidth: 1200, margin: '0 auto', marginTop: 32, borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
      <Table
        dataSource={users}
        rowKey="id"
        loading={loading}
        bordered
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '用户名', dataIndex: 'username', width: 120 },
          { title: '角色', dataIndex: 'role', width: 100 },
          { title: '注册时间', dataIndex: 'created_at', width: 160 },
          { title: '状态', dataIndex: 'is_active', width: 80, render: v => v ? <Tag color="green">正常</Tag> : <Tag color="red">禁用</Tag> },
          {
            title: '操作',
            key: 'action',
            width: 260,
            render: (_, user) => (
              <Space>
                <Button size="small" onClick={() => setResetModal({ visible: true, user })}>重置密码</Button>
                <Button size="small" onClick={() => handleDisable(user, user.is_active)}>禁用</Button>
                <Button size="small" onClick={() => handleDisable(user, !user.is_active)}>启用</Button>
                <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(user)} okText="确定" cancelText="取消">
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        pagination={false}
      />
      <Modal
        open={resetModal.visible}
        title={`重置密码 - ${resetModal.user?.username}`}
        onCancel={() => setResetModal({ visible: false, user: null })}
        onOk={handleResetPwd}
        confirmLoading={resetLoading}
      >
        <Input.Password
          placeholder="请输入新密码"
          value={resetPwd}
          onChange={e => setResetPwd(e.target.value)}
        />
      </Modal>
    </Card>
  );
}

// 管理员端主界面 Tab 切换
function AdminPanel() {
  const [activeMenu, setActiveMenu] = useState('ppt');
  return (
    <Layout>
      <Menu
        mode="horizontal"
        selectedKeys={[activeMenu]}
        onClick={e => setActiveMenu(e.key)}
        items={adminMenuItems}
        style={{ marginBottom: 0, borderRadius: 0, fontWeight: 600, fontSize: 16 }}
      />
      <Layout.Content style={{ padding: 24, minHeight: 360, background: '#f8fafc' }}>
        {activeMenu === 'ppt' && <AdminPPTExport />}
        {activeMenu === 'activity' && <AdminActivity />}
        {activeMenu === 'users' && <AdminUserManagement />}
      </Layout.Content>
    </Layout>
  );
}

function TeacherPPTHistory() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  // 让外部可刷新
  window.fetchPptHistory = fetchPptHistory;
  function fetchPptHistory() {
    setLoading(true);
    axios.get('http://localhost:8000/teacher/ppt-history').then(res => {
      setFiles(res.data.files || []);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { fetchPptHistory(); }, []);
  const handleDownload = (filename) => {
    downloadPPT(`http://localhost:8000/teacher/ppt-history/download/${filename}`, filename);
  };
  const handlePreview = (filename) => {
    window.open(`http://localhost:8000/teacher/ppt-history/preview/${filename}`);
  };
  // 让宽度和教学内容栏一致
  return (
    <Card title="PPT历史记录" style={{ maxWidth: 1200, margin: '0 auto', marginBottom: 24, borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }} loading={loading}>
      <List
        dataSource={files}
        locale={{ emptyText: '暂无历史PPT' }}
        renderItem={file => (
          <List.Item actions={[
            <Button type="link" onClick={() => handleDownload(file.filename)}>下载</Button>,
            <Button type="link" danger onClick={() => handleDelete(file.filename)}>删除</Button>
          ]}> 
            <div style={{ width: '100%' }}>
              <b>{file.filename}</b>
              <span style={{ marginLeft: 16, color: '#888' }}>创建时间: {file.created_at}</span>
              <span style={{ marginLeft: 16, color: '#888' }}>大小: {(file.size/1024).toFixed(1)} KB</span>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}

const handleDelete = async (filename) => {
  try {
    const token = localStorage.getItem('token');
    await axios.delete(`http://localhost:8000/teacher/ppt-history/delete/${filename}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    message.success('删除成功');
    if (typeof fetchPptHistory === 'function') fetchPptHistory();
  } catch (err) {
    message.error('删除失败：' + (err.response?.data?.detail || err.message));
  }
};

// 通用PPT下载函数，自动带token，适配不同接口
const downloadPPT = async (url, filename) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(url, {
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    alert('下载失败：' + (err.response?.data?.detail || err.message));
  }
};

// 工具函数：格式化时间字符串，去掉T，只保留到分钟
function formatDateTime(str) {
  if (!str) return '';
  const s = str.replace('T', ' ');
  // 只保留到分钟
  return s.slice(0, 16);
}

// 工具函数：格式化答案显示
function formatAnswer(ans) {
  if (Array.isArray(ans)) return ans.join('、');
  // 新增：处理字符串形式的数组
  if (typeof ans === 'string' && ans.startsWith('[') && ans.endsWith(']')) {
    try {
      const arr = JSON.parse(ans);
      if (Array.isArray(arr)) return arr.join('、');
    } catch {}
  }
  if (typeof ans === 'object' && ans !== null) return JSON.stringify(ans);
  return ans ?? '--';
}

