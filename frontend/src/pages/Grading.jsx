import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, Table, Modal, Select, InputNumber, Input, Button, message, Space, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import http from '../api/http';
import PageHeader from '../components/PageHeader';

export default function Grading() {
  const [gradingList, setGradingList] = useState([]);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingModalVisible, setGradingModalVisible] = useState(false);
  const [gradingModalQuestion, setGradingModalQuestion] = useState(null);
  const [gradingModalStudentAnswers, setGradingModalStudentAnswers] = useState([]);
  const [gradingModalSelectedStudent, setGradingModalSelectedStudent] = useState(null);
  const [gradingForm, setGradingForm] = useState({ score: 0, comment: '' });
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // 获取待批改试题列表
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

  // 页面加载时获取待批改列表
  useEffect(() => {
    fetchGradingList();
  }, []);

  // 批改弹窗提交
  const handleModalGrade = async (studentExamId, questionId, score, comment) => {
    try {
      await http.post('/teacher/grade-answer', {
        student_exam_id: studentExamId,
        question_id: questionId,
        points_earned: score,
        comment
      });
      message.success('批改成功');
      setGradingModalVisible(false);
      fetchGradingList();
    } catch (e) {
      message.error('批改失败');
    }
  };

  // 表格列配置
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
          const firstStudent = record.waitStudents[0] || null;
          setGradingModalQuestion(record);
          setGradingModalStudentAnswers(record.waitStudents);
          setGradingModalSelectedStudent(firstStudent?.studentId || null);
          setGradingForm({
            score: 0,
            comment: firstStudent?.comment || ''
          });
          setGradingModalVisible(true);
        }}>进入批改</Button>
      )
    }
  ];

  const filteredGradingList = gradingList.filter((item) => {
    const matchType = typeFilter === 'all' ? true : item.type === typeFilter;
    const key = searchText.trim().toLowerCase();
    const matchText = !key
      ? true
      : `${item.examTitle || ''} ${item.question || ''}`.toLowerCase().includes(key);
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
          <Input.Search
            placeholder="按考试名或题目内容搜索"
            allowClear
            style={{ width: 320 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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
                { value: 'programming', label: '编程题' }
              ]}
            />
            <Tag color="processing">共 {filteredGradingList.length} 题待批改</Tag>
          </Space>
        </Space>
      </Card>
      <Card title={<span style={{ fontWeight: 600, fontSize: 18 }}>待批改简答题/编程题</span>} style={{ width: '100%', maxWidth: 1600, margin: '0 auto' }}>
        <Table
          columns={gradingQuestionColumns}
          dataSource={filteredGradingList}
          loading={gradingLoading}
          pagination={{ pageSize: 8 }}
          bordered
          rowClassName={(_, idx) => idx % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
        />
        
        {/* 批改弹窗 */}
        <Modal
          open={gradingModalVisible}
          onCancel={() => {
            setGradingModalVisible(false);
            setGradingForm({ score: 0, comment: '' });
          }}
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
                  onChange={sid => {
                    setGradingModalSelectedStudent(sid);
                    const selected = gradingModalStudentAnswers.find(stu => stu.studentId === sid);
                    setGradingForm({
                      score: 0,
                      comment: selected?.comment || ''
                    });
                  }}
                >
                  {gradingModalStudentAnswers.map(stu => (
                    <Select.Option key={stu.studentId} value={stu.studentId}>{stu.studentName}</Select.Option>
                  ))}
                </Select>
              </div>
              {gradingModalStudentAnswers.filter(stu => stu.studentId === gradingModalSelectedStudent).map(stu => (
                <div key={stu.studentId} style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}><b>学生：</b>{stu.studentName}</div>
                  <div style={{ marginBottom: 8 }}>
                    <b>学生答案：</b>
                    <Card size="small" style={{ marginTop: 8, background: '#fafafa', borderRadius: 8 }}>{stu.answer || '--'}</Card>
                  </div>
                  <Space align="center" style={{ marginBottom: 8 }}>
                    <Tag color="blue">满分 {gradingModalQuestion.points}</Tag>
                    <InputNumber
                      min={0}
                      max={gradingModalQuestion.points}
                      style={{ width: 120 }}
                      placeholder="分数"
                      value={gradingForm.score}
                      onChange={(value) => setGradingForm((prev) => ({ ...prev, score: Number(value || 0) }))}
                    />
                  </Space>
                  <div style={{ marginBottom: 8 }}>
                    <Input.TextArea
                      rows={3}
                      style={{ minWidth: 100 }}
                      placeholder="可填写评语"
                      value={gradingForm.comment}
                      onChange={(e) => setGradingForm((prev) => ({ ...prev, comment: e.target.value }))}
                    />
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleModalGrade(stu.studentExamId, gradingModalQuestion.questionId, gradingForm.score, gradingForm.comment)}
                  >
                    提交批改
                  </Button>
                </div>
              ))}
            </div>
          ) : <div>暂无待批改学生</div>}
        </Modal>
      </Card>
      </div>
    </AppLayout>
  );
}