import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, Table, Select, InputNumber, Input, Button, Space, Tag, message, Typography } from 'antd';
import { EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import http from '../api/http';
import PageHeader from '../components/PageHeader';
import { useNavigate, useParams } from 'react-router-dom';

const { Title } = Typography;

// 批改详情页面
export function GradingQuestionPage() {
  const navigate = useNavigate();
  const { examId, questionId } = useParams();

  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState(null);
  const [studentAnswers, setStudentAnswers] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [form, setForm] = useState({ score: 0, comment: '' });
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('开始加载批改数据，examId:', examId, 'questionId:', questionId);

      // 添加错误处理和超时
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('请求超时，请重试')), 15000)
      );

      const examsPromise = http.get('/teacher/exams');
      const exams = await Promise.race([examsPromise, timeoutPromise]);

      console.log('考试列表响应:', exams);

      // 灵活处理数据格式
      let examsList;
      if (exams && typeof exams === 'object') {
        examsList = exams.data?.exams || exams.exams || exams.data || exams;
      } else {
        examsList = exams || [];
      }

      if (!Array.isArray(examsList)) {
        throw new Error('考试数据格式错误');
      }

      console.log('考试列表:', examsList);

      const targetExam = examsList.find(e => e && e.id == examId);
      if (!targetExam) {
        throw new Error(`找不到考试 ID: ${examId}`);
      }

      console.log('找到目标考试:', targetExam);

      const ansRes = await http.get(`/teacher/exam/${examId}/answers`);
      console.log('答案响应:', ansRes);

      let students;
      if (ansRes && typeof ansRes === 'object') {
        students = ansRes.data?.students || ansRes.students || ansRes.data || ansRes;
      } else {
        students = ansRes || [];
      }

      if (!Array.isArray(students)) {
        throw new Error('学生数据格式错误');
      }

      console.log('学生列表:', students);

      let q = null;
      let answers = [];

      for (const stu of students) {
        if (!stu || !Array.isArray(stu.answers)) continue;

        for (const ans of stu.answers) {
          if (ans && ans.question_id == questionId && ans.is_correct === null) {
            if (!q) {
              q = {
                examId: targetExam.id,
                examTitle: targetExam.title,
                questionId: ans.question_id,
                question: ans.question || '',
                type: ans.type || '',
                points: ans.points || 0,
              };
            }
            answers.push({
              studentId: stu.student_id,
              studentName: stu.student_name || '',
              studentExamId: stu.student_exam_id || stu.id,
              answer: ans.student_answer || '',
              comment: ans.comment || '',
              key: `${stu.student_exam_id || stu.id}_${ans.question_id}`,
            });
          }
        }
      }

      console.log('处理后的题目:', q);
      console.log('处理后的答案:', answers);

      setQuestion(q);
      setStudentAnswers(answers);
      if (answers.length > 0) {
        setSelectedStudentId(answers[0].studentId);
        setForm({ score: 0, comment: answers[0].comment || '' });
      }
    } catch (e) {
      console.error('加载批改数据失败:', e);
      setError(e.message || '加载失败');
      message.error('加载失败: ' + (e.message || '未知错误'));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (examId && questionId) {
      loadData();
    }
  }, [examId, questionId]);

  const handleSubmit = async (stu) => {
    try {
      await http.post('/teacher/grade-answer', {
        student_exam_id: stu.studentExamId,
        question_id: questionId,
        points_earned: form.score,
        comment: form.comment,
      });
      message.success('批改成功');
      navigate('/grading');
    } catch (e) {
      message.error('批改失败: ' + (e.message || '未知错误'));
    }
  };

  const selectedStu = studentAnswers.find(s => s.studentId === selectedStudentId);

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter" style={{ padding: '0 12px' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/grading')}
          type="primary"
          style={{ marginBottom: 16 }}
        >
          返回批改中心
        </Button>

        <PageHeader
          title="试题批改"
          subtitle="对学生作答进行评分与评语"
          icon={<EditOutlined />}
        />

        {error ? (
          <Card style={{ textAlign: 'center', padding: '60px 0', color: 'red' }}>
            <div>加载失败: {error}</div>
            <Button
              type="primary"
              style={{ marginTop: 16 }}
              onClick={loadData}
            >
              重试
            </Button>
          </Card>
        ) : loading ? (
          <Card loading style={{ minHeight: 400 }} />
        ) : question && selectedStu ? (
          <Card style={{ maxWidth: 1400, margin: '0 auto' }}>
            {/* 题目 */}
            <Card
              size="small"
              style={{
                background: '#f7f8fa',
                borderRadius: 10,
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>题目</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{question.question}</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 24 }}>
                <Tag color="blue">
                  {question.type === 'short_answer' ? '简答题' : '编程题'}
                </Tag>
                <Tag color="blue">满分 {question.points} 分</Tag>
              </div>
            </Card>

            {/* 选择学生 */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600 }}>批改学生：</span>
              <Select
                style={{ width: 240 }}
                value={selectedStudentId}
                onChange={sid => {
                  const stu = studentAnswers.find(s => s.studentId === sid);
                  setSelectedStudentId(sid);
                  setForm({ score: 0, comment: stu?.comment || '' });
                }}
              >
                {studentAnswers.map(stu => (
                  <Select.Option key={stu.studentId} value={stu.studentId}>
                    {stu.studentName}
                  </Select.Option>
                ))}
              </Select>
            </div>

            {/* 学生答案 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>学生答案</div>
              <Card
                size="small"
                style={{
                  maxHeight: 360,
                  overflow: 'auto',
                  background: '#fafafa',
                }}
              >
                {selectedStu.answer || '无作答'}
              </Card>
            </div>

            {/* 评分 */}
            <div
              style={{
                padding: '12px 16px',
                background: '#e6f4ff',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 24,
              }}
            >
              <span style={{ fontWeight: 600 }}>评分</span>
              <InputNumber
                min={0}
                max={question.points}
                value={form.score}
                onChange={v => setForm({ ...form, score: Number(v || 0) })}
                style={{ width: 140 }}
              />
              <Tag color="blue">满分 {question.points}</Tag>
            </div>

            {/* 评语 */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>批改评语</div>
              <Input.TextArea
                rows={4}
                value={form.comment}
                onChange={e => setForm({ ...form, comment: e.target.value })}
                placeholder="请输入评语、扣分点等"
              />
            </div>

            <Button
              type="primary"
              size="large"
              block
              onClick={() => handleSubmit(selectedStu)}
            >
              提交批改
            </Button>
          </Card>
        ) : (
          <Card style={{ textAlign: 'center', padding: '60px 0' }}>
            暂无待批改数据
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// 原批改列表页面
export default function Grading() {
  const navigate = useNavigate();
  const [gradingList, setGradingList] = useState([]);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchGradingList = async () => {
    setGradingLoading(true);
    try {
      const examsRes = await http.get('/teacher/exams');
      const exams = examsRes.data.exams || [];
      let questionMap = {};
      for (const exam of exams) {
        const ansRes = await http.get(`/teacher/exam/${exam.id}/answers`);
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
                key: `${stu.student_exam_id || stu.id}_${ans.question_id}`,
              });
            }
          }
        }
      }
      const list = Object.values(questionMap).map(q => ({
        ...q,
        waitCount: q.waitStudents.length,
        key: `${q.examId}_${q.questionId}`,
      }));
      setGradingList(list);
    } catch (e) {
      setGradingList([]);
    }
    setGradingLoading(false);
  };

  useEffect(() => {
    fetchGradingList();
  }, []);

  const gradingQuestionColumns = [
    { title: '考试', dataIndex: 'examTitle', key: 'examTitle', align: 'center', width: 120 },
    {
      title: '题型',
      dataIndex: 'type',
      key: 'type',
      align: 'center',
      width: 100,
      render: t => (t === 'short_answer' ? '简答题' : '编程题'),
    },
    {
      title: '题目',
      dataIndex: 'question',
      key: 'question',
      width: 350,
      render: text => (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</div>
      ),
    },
    { title: '待批改人数', dataIndex: 'waitCount', key: 'waitCount', align: 'center', width: 100 },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 120,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          onClick={() => navigate(`/grading/question/${record.examId}/${record.questionId}`)}
        >
          进入批改
        </Button>
      ),
    },
  ];

  const filtered = gradingList.filter(item => {
    const matchType = typeFilter === 'all' || item.type === typeFilter;
    const matchText =
      !searchText.trim() ||
      `${item.examTitle} ${item.question}`.toLowerCase().includes(searchText.trim().toLowerCase());
    return matchType && matchText;
  });

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter">
        <PageHeader
          title="批改中心"
          subtitle="集中处理简答题和编程题待批改作答"
          icon={<EditOutlined />}
          variant="dashboard"
        />

        <Card style={{ marginBottom: 16, borderRadius: 14 }}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Input
              placeholder="按考试名或题目内容搜索"
              allowClear
              style={{ width: 320 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <Space>
              <span style={{ color: '#666' }}>题型</span>
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 160 }}
                options={[
                  { value: 'all', label: '全部题型' },
                  { value: 'short_answer', label: '简答题' },
                  { value: 'programming', label: '编程题' },
                ]}
              />
              <Tag color="processing">共 {filtered.length} 题待批改</Tag>
            </Space>
          </Space>
        </Card>

        <Card
          title={<span style={{ fontWeight: 600, fontSize: 18 }}>待批改简答题/编程题</span>}
          style={{ width: '100%', maxWidth: 1600, margin: '0 auto' }}
        >
          <Table
            columns={gradingQuestionColumns}
            dataSource={filtered}
            loading={gradingLoading}
            pagination={{ pageSize: 8 }}
            bordered
            rowClassName={(_, idx) => (idx % 2 === 0 ? 'table-row-light' : 'table-row-dark')}
          />
        </Card>
      </div>
    </AppLayout>
  );
}