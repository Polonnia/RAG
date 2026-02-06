import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, List, message, Modal, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listStudentExams, getStudentExam, submitExam, getLatestAnalysis } from '../services/studentExamService';

export default function StudentExams() {
  const [exams, setExams] = useState([]);
  const [current, setCurrent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listStudentExams().then(r => setExams(r.exams || []));
  }, []);

  const start = async (examId) => {
    const data = await getStudentExam(examId);
    setCurrent(data);
    setAnswers({});
    setOpen(true);
  };

  const submit = async () => {
    try {
      const res = await submitExam(current.exam.id, answers);
      message.success(`考试提交成功！得分：${res.score}`);
      const analysis = await getLatestAnalysis(current.exam.id).catch(() => null);
      if (analysis?.ai_summary) message.success('AI薄弱点分析完成！');
      setOpen(false);
      // 刷新考试列表
      listStudentExams().then(r => setExams(r.exams || []));
    } catch (e) {
      message.error('提交失败');
    }
  };

  const viewResult = (examId) => {
    navigate(`/exam-result/${examId}`);
  };

  return (
    <AppLayout>
      <h2 style={{ fontWeight: 700, marginTop: 0 }}>考试系统</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {exams.length === 0 ? (
          <div style={{ color: '#888', fontSize: 16 }}>暂无考试</div>
        ) : (
          exams.map(exam => (
            <Card
              key={exam.id}
              title={<span style={{ fontWeight: 600, fontSize: 16 }}>{exam.title}</span>}
              bordered={false}
              style={{
                width: 320,
                minHeight: 180,
                boxShadow: '0 2px 8px #e6eaf1',
                borderRadius: 12,
                background: '#fff'
              }}
              bodyStyle={{ padding: 16 }}
              extra={
                exam.completed ? (
                  <Tag color="green">已完成</Tag>
                ) : (
                  <Tag color="blue">未完成</Tag>
                )
              }
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#666', fontSize: 14 }}>{exam.description}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: '#aaa', fontSize: 12 }}>时长：{exam.duration}分钟</span>
              </div>
              {exam.completed && (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 16 }}>得分：{exam.score}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {exam.completed ? (
                  <Button type="primary" size="small" onClick={() => viewResult(exam.id)}>
                    查看结果
                  </Button>
                ) : (
                  <Button type="primary" onClick={() => start(exam.id)}>
                    开始考试
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal title={current?.exam?.title} open={open} onCancel={() => setOpen(false)} onOk={submit} width={900} destroyOnClose>
        {current && (
          <div>
            {(current.questions || []).map((q, idx) => (
              <div key={q.id} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>第{idx + 1}题（{q.points}分）</div>
                <div style={{ margin: '6px 0' }}>{q.question}</div>
                {q.options && Object.keys(q.options).length > 0 && (
                  <div>
                    {Object.entries(q.options).map(([k, v]) => (
                      <div key={k} style={{ marginLeft: 10 }}>
                        <label>
                          <input type={q.type === 'multi' ? 'checkbox' : 'radio'}
                            name={`q_${q.id}`}
                            value={k}
                            onChange={(e) => {
                              if (q.type === 'multi') {
                                setAnswers(prev => {
                                  const arr = new Set(prev[q.id] || []);
                                  if (e.target.checked) arr.add(k); else arr.delete(k);
                                  return { ...prev, [q.id]: Array.from(arr) };
                                });
                              } else {
                                setAnswers(prev => ({ ...prev, [q.id]: k }));
                              }
                            }}
                          /> {k}. {v}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                {q.type === 'fill_blank' && (
                  <input style={{ width: '100%' }} onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} />
                )}
                {q.type === 'short_answer' && (
                  <textarea rows={3} style={{ width: '100%' }} onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} />
                )}
                {q.type === 'programming' && (
                  <textarea rows={6} style={{ width: '100%', fontFamily: 'monospace' }} onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}


