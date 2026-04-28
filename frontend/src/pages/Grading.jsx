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
          <Input
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
          title={
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              padding: '12px 0',
              borderBottom: '1px solid #f0f0f0'
            }}>批改试题</div>
          }
          width="95vw"
          style={{ maxWidth: '1400px', top: 20 }}
          styles={{
            body: {
              padding: 24,
              maxHeight: '85vh',
              overflowY: 'auto'
            }
          }}
          destroyOnClose
        >
          {gradingModalQuestion && gradingModalStudentAnswers.length > 0 ? (
            <div style={{ padding: '8px 0' }}>
              {/* 题目区域 */}
              <div style={{
                marginBottom: 28,
                padding: '16px 20px',
                background: '#f7f8fa',
                borderRadius: 10,
                border: '1px solid #e8e8e8'
              }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>题目</div>
                <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {gradingModalQuestion.question}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: '24px' }}>
                  <span style={{ color: '#1677ff', fontWeight: 600 }}>
                    题型：{gradingModalQuestion.type === 'short_answer' ? '简答题' : '编程题'}
                  </span>
                  <span style={{ color: '#1677ff', fontWeight: 600 }}>
                    满分：{gradingModalQuestion.points} 分
                  </span>
                </div>
              </div>

              {/* 选择学生 */}
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 15, fontWeight: 600, marginRight: 12 }}>选择学生</span>
                <Select
                  style={{ width: 240 }}
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

              {/* 学生答案 + 批改 */}
              {gradingModalStudentAnswers.filter(stu => stu.studentId === gradingModalSelectedStudent).map(stu => (
                <div key={stu.key}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>学生答案</div>
                    <Card
                      size="small"
                      style={{
                        background: '#fafafa',
                        borderRadius: 8,
                        maxHeight: 320,
                        overflow: 'auto',
                        padding: 12
                      }}
                    >
                      {stu.answer || '--'}
                    </Card>
                  </div>

                  {/* 给分区域（突出） */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 24,
                    padding: '12px 16px',
                    background: '#e6f4ff',
                    borderRadius: 8
                  }}>
                    <span style={{ fontWeight: 600 }}>评分</span>
                    <InputNumber
                      min={0}
                      max={gradingModalQuestion.points}
                      style={{ width: 140 }}
                      placeholder="请输入分数"
                      value={gradingForm.score}
                      onChange={(value) => setGradingForm((prev) => ({ ...prev, score: Number(value || 0) }))}
                    />
                    <Tag color="blue">满分 {gradingModalQuestion.points}</Tag>
                  </div>

                  {/* 评语 */}
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>批改评语</div>
                    <Input.TextArea
                      rows={4}
                      placeholder="可填写评语、扣分说明等"
                      value={gradingForm.comment}
                      onChange={(e) => setGradingForm((prev) => ({ ...prev, comment: e.target.value }))}
                    />
                  </div>

                  {/* 提交按钮 */}
                  <Button
                    type="primary"
                    size="large"
                    style={{ width: '100%', height: 44, fontSize: 15, fontWeight: 500 }}
                    onClick={() => handleModalGrade(stu.studentExamId, gradingModalQuestion.questionId, gradingForm.score, gradingForm.comment)}
                  >
                    提交批改
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
              暂无待批改学生
            </div>
          )}
        </Modal>
      </Card>
      </div>
    </AppLayout>
  );
}