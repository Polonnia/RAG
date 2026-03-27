import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Card, Table, Modal, Select, InputNumber, Input, Button, message } from 'antd';
import http from '../api/http';

export default function Grading() {
  const [gradingList, setGradingList] = useState([]);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingModalVisible, setGradingModalVisible] = useState(false);
  const [gradingModalQuestion, setGradingModalQuestion] = useState(null);
  const [gradingModalStudentAnswers, setGradingModalStudentAnswers] = useState([]);
  const [gradingModalSelectedStudent, setGradingModalSelectedStudent] = useState(null);

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
          setGradingModalQuestion(record);
          setGradingModalStudentAnswers(record.waitStudents);
          setGradingModalSelectedStudent(record.waitStudents[0]?.studentId || null);
          setGradingModalVisible(true);
        }}>进入批改</Button>
      )
    }
  ];

  return (
    <AppLayout>
      <Card title={<span style={{ fontWeight: 600, fontSize: 18 }}>待批改简答题/编程题</span>} style={{ width: '100%', maxWidth: 1600, margin: '0 auto' }}>
        <Table
          columns={gradingQuestionColumns}
          dataSource={gradingList}
          loading={gradingLoading}
          pagination={{ pageSize: 8 }}
          bordered
          rowClassName={(_, idx) => idx % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
        />
        
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
    </AppLayout>
  );
}