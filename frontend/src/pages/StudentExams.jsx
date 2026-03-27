import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, List, message, Modal, Card, Tag, Row, Col, Statistic, Divider, Empty, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listStudentExams, getStudentExam, submitExam, getLatestAnalysis, saveExamDraft } from '../services/studentExamService';
import { CheckCircleOutlined, ClockCircleOutlined, FormOutlined } from '@ant-design/icons';

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
    // 加载已保存的答题
    const savedAnswers = data.saved_answers || {};
    setAnswers(savedAnswers);
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
      {/* 页面顶部标题和统计 */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, marginTop: 0, marginBottom: 24, color: '#1f1f1f' }}>
          <FormOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          考试系统
        </h1>
        
        {/* 统计卡片 */}
        <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #d9d9d9', background: '#fff' }}>
          <Row gutter={32}>
            <Col xs={24} sm={12} md={8}>
              <Statistic
                title={<span style={{ color: '#666', fontSize: 14 }}>总考试数</span>}
                value={exams.length}
                valueStyle={{ color: '#1f1f1f', fontSize: 28, fontWeight: 'bold' }}
                prefix={<FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Statistic
                title={<span style={{ color: '#666', fontSize: 14 }}>已完成</span>}
                value={exams.filter(e => e.completed).length}
                valueStyle={{ color: '#52c41a', fontSize: 28, fontWeight: 'bold' }}
                prefix={<CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Statistic
                title={<span style={{ color: '#666', fontSize: 14 }}>待进行</span>}
                value={exams.filter(e => !e.completed).length}
                valueStyle={{ color: '#faad14', fontSize: 28, fontWeight: 'bold' }}
                prefix={<ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />}
              />
            </Col>
          </Row>
        </Card>
      </div>

      {/* 未完成的考试 */}
      {exams.filter(e => !e.completed).length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1f1f1f', marginBottom: 16 }}>
            <ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />
            待进行的考试
          </h3>
          <Row gutter={[16, 16]}>
            {exams.filter(e => !e.completed).map(exam => (
              <Col xs={24} sm={12} lg={8} key={exam.id}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: '1px solid #d9d9d9',
                    transition: 'all 0.3s ease',
                    background: '#fff'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
                >
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontWeight: 600, fontSize: 16, color: '#1f1f1f', margin: 0 }}>{exam.title}</h4>
                    <Tag color="blue">{exam.has_draft ? '进行中' : '未完成'}</Tag>
                  </div>
                  <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px 0', lineHeight: 1.6 }}>{exam.description}</p>
                  <div style={{ color: '#aaa', fontSize: 12, marginBottom: 12 }}>⏱ 时长：{exam.duration}分钟</div>
                  <Divider style={{ margin: '12px 0' }} />
                  <Button 
                    type="primary" 
                    block
                    size="large"
                    onClick={() => start(exam.id)}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    {exam.has_draft ? '继续考试' : '开始考试'}
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 已完成的考试 */}
      {exams.filter(e => e.completed).length > 0 && (
        <div>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1f1f1f', marginBottom: 16 }}>
            <CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            已完成的考试
          </h3>
          <Row gutter={[16, 16]}>
            {exams.filter(e => e.completed).map(exam => (
              <Col xs={24} sm={12} lg={8} key={exam.id}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: '1px solid #d9d9d9',
                    transition: 'all 0.3s ease',
                    background: '#fff'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
                >
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontWeight: 600, fontSize: 16, color: '#1f1f1f', margin: 0 }}>{exam.title}</h4>
                    <Tag color="green">已完成</Tag>
                  </div>
                  <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px 0', lineHeight: 1.6 }}>{exam.description}</p>
                  <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>得分：{exam.score}</div>
                  <Divider style={{ margin: '12px 0' }} />
                  <Button 
                    type="primary" 
                    block
                    size="large"
                    onClick={() => viewResult(exam.id)}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    查看详细
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 空状态 */}
      {exams.length === 0 && (
        <Card style={{ textAlign: 'center', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Empty
            description="暂无考试"
            style={{ paddingTop: 40, paddingBottom: 40 }}
          />
        </Card>
      )}

      <Modal 
        title={<span style={{ fontSize: 16, fontWeight: 600 }}>{current?.exam?.title}</span>}
        open={open} 
        onCancel={async () => {
          if (current && Object.keys(answers).length > 0) {
            try {
              await saveExamDraft(current.exam.id, answers);
              message.success('答题已保存，可继续完成');
            } catch (e) {
              console.error('保存草稿失败:', e);
            }
          }
          setOpen(false);
        }}
        onOk={submit} 
        width={900} 
        destroyOnClose
        okText="提交考试"
        cancelText="取消"
        okButtonProps={{ size: 'large' }}
        cancelButtonProps={{ size: 'large' }}
      >
        {current && (
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {(current.questions || []).map((q, idx) => (
              <Card
                key={q.id}
                style={{ 
                  marginBottom: 16,
                  borderRadius: 8,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: 16,
                    color: '#1f1f1f',
                    marginBottom: 8
                  }}>
                    第 {idx + 1} 题 <span style={{ color: '#faad14' }}>（{q.points}分）</span>
                  </div>
                  <div style={{ 
                    fontSize: 14,
                    color: '#333',
                    lineHeight: 1.8,
                    marginBottom: 12
                  }}>
                    {q.question}
                  </div>
                  
                  {q.options && Object.keys(q.options).length > 0 && (
                    <div style={{ 
                      paddingLeft: 16,
                      borderLeft: '3px solid #1890ff'
                    }}>
                      {Object.entries(q.options).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <label style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '4px',
                            transition: 'background 0.2s'
                          }}>
                            <input 
                              type={q.type === 'multi' ? 'checkbox' : 'radio'}
                              name={`q_${q.id}`}
                              value={k}
                              checked={q.type === 'multi' ? (Array.isArray(answers[q.id]) && answers[q.id].includes(k)) : (answers[q.id] === k)}
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
                              style={{ marginRight: 8, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 14 }}>{k}. {v}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'fill_blank' && (
                    <input 
                      placeholder="请填空..." 
                      value={answers[q.id] || ''}
                      style={{ 
                        width: '100%', 
                        padding: '8px 12px',
                        fontSize: 14,
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        transition: 'border 0.2s'
                      }} 
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} 
                    />
                  )}
                  
                  {q.type === 'short_answer' && (
                    <textarea 
                      rows={3} 
                      placeholder="请作答..."
                      value={answers[q.id] || ''}
                      style={{ 
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: 14,
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        transition: 'border 0.2s'
                      }} 
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} 
                    />
                  )}
                  
                  {q.type === 'programming' && (
                    <textarea 
                      rows={6} 
                      placeholder="请输入代码..."
                      value={answers[q.id] || ''}
                      style={{ 
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: 13,
                        fontFamily: 'Monaco, Menlo, Consolas, monospace',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                        resize: 'vertical',
                        transition: 'border 0.2s'
                      }} 
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} 
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}


