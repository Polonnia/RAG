import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, message, Modal, Card, Tag, Row, Col, Divider, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listStudentExams, getStudentExam, submitExam, getLatestAnalysis, saveExamDraft } from '../services/studentExamService';
import { CheckCircleOutlined, ClockCircleOutlined, FormOutlined, FileTextOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useResponsive } from '../utils/responsive';

export default function StudentExams() {
  const [exams, setExams] = useState([]);
  const [current, setCurrent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [open, setOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [hoveredOption, setHoveredOption] = useState('');
  const { isMobile } = useResponsive();
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
    setRemainingSeconds(Math.max((data?.exam?.duration || 0) * 60, 0));
    setHoveredOption('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open || !current?.exam?.id || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          message.warning('考试时间已到，请尽快提交试卷');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, current?.exam?.id, remainingSeconds]);

  const formatRemainTime = (seconds) => {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
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
      <div className="page-content-wrap page-enter">
        <PageHeader
          title="考试系统"
          subtitle="查看待进行考试、续作草稿并追踪历史成绩"
          icon={<FormOutlined />}
          variant="dashboard"
          decorative
        />

        <Row gutter={[16, 16]} className="page-section">
          <Col xs={24} sm={12} md={8}>
            <StatCard title="总考试数" value={exams.length} icon={<FileTextOutlined />} color="#1677ff" />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <StatCard title="已完成" value={exams.filter(e => e.completed).length} icon={<CheckCircleOutlined />} color="#52c41a" />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <StatCard title="待进行" value={exams.filter(e => !e.completed).length} icon={<ClockCircleOutlined />} color="#faad14" />
          </Col>
        </Row>

      {/* 未完成的考试 */}
      {exams.filter(e => !e.completed).length > 0 && (
        <div className="page-section fade-in-up" style={{ marginBottom: 32 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1f1f1f', marginBottom: 16 }}>
            <ClockCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />
            待进行的考试
          </h3>
          <Row gutter={[16, 16]}>
            {exams.filter(e => !e.completed).map(exam => (
              <Col xs={24} sm={12} lg={8} key={exam.id}>
                <Card
                  hoverable
                  className="hover-lift"
                  style={{
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: '1px solid #d9d9d9',
                    background: '#fff'
                  }}
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
        <div className="page-section fade-in-up">
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1f1f1f', marginBottom: 16 }}>
            <CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />
            已完成的考试
          </h3>
          <Row gutter={[16, 16]}>
            {exams.filter(e => e.completed).map(exam => (
              <Col xs={24} sm={12} lg={8} key={exam.id}>
                <Card
                  hoverable
                  className="hover-lift"
                  style={{
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: '1px solid #d9d9d9',
                    background: '#fff'
                  }}
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
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: isMobile ? '8px 14px' : '10px 18px',
                borderRadius: 999,
                border: '1px solid #91caff',
                background: '#e6f4ff',
                color: '#0958d9',
                fontSize: isMobile ? 15 : 18,
                fontWeight: 600,
                maxWidth: isMobile ? '58vw' : '70vw',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {current?.exam?.title || '未命名考试'}
            </div>
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid #ffd666',
                background: remainingSeconds <= 60 ? '#fff1f0' : '#fffbe6',
                color: remainingSeconds <= 60 ? '#cf1322' : '#ad6800',
                fontWeight: 700,
                fontSize: 14,
                minWidth: 110,
                textAlign: 'center'
              }}
            >
              剩余 {formatRemainTime(remainingSeconds)}
            </div>
          </div>
        }
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
        width="100vw"
        style={{ top: 0, maxWidth: '100vw', paddingBottom: 0 }}
        styles={{
          content: { height: '100vh', borderRadius: 0, paddingBottom: 0, display: 'flex', flexDirection: 'column' },
          header: { borderRadius: 0 },
          body: { flex: 1, overflowY: 'auto', padding: isMobile ? 12 : 20, paddingBottom: isMobile ? 96 : 120 },
          footer: { margin: 0, borderTop: '1px solid #f0f0f0', padding: isMobile ? '12px 16px' : '16px 24px', background: '#fff' }
        }}
        destroyOnClose
        okText="提交考试"
        cancelText="保存并返回"
        okButtonProps={{ size: 'large' }}
        cancelButtonProps={{ size: 'large' }}
      >
        {current && (
          <div>
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
                      borderLeft: '3px solid #1890ff',
                      background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
                      borderRadius: 8,
                      paddingTop: 8,
                      paddingBottom: 8
                    }}>
                      {Object.entries(q.options).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          {(() => {
                            const optionKey = `${q.id}_${k}`;
                            const isSelected = q.type === 'multi'
                              ? (Array.isArray(answers[q.id]) && answers[q.id].includes(k))
                              : (answers[q.id] === k);
                            const isHovered = hoveredOption === optionKey;
                            return (
                          <label style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '10px 12px',
                            borderRadius: 8,
                            transition: 'all 0.2s ease',
                            border: isSelected ? '1px solid #69b1ff' : (isHovered ? '1px solid #91caff' : '1px solid transparent'),
                            background: isSelected ? '#e6f4ff' : (isHovered ? '#f0f7ff' : 'transparent'),
                            boxShadow: isHovered ? '0 2px 8px rgba(22,119,255,0.12)' : 'none'
                          }}
                          onMouseEnter={() => setHoveredOption(optionKey)}
                          onMouseLeave={() => setHoveredOption('')}
                          >
                            <input 
                              type={q.type === 'multi' ? 'checkbox' : 'radio'}
                              name={`q_${q.id}`}
                              value={k}
                              checked={isSelected}
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
                              style={{ marginRight: 10, cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: 14, color: isSelected ? '#0958d9' : '#262626', fontWeight: isSelected ? 600 : 500 }}>{k}. {v}</span>
                          </label>
                            );
                          })()}
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
      </div>
    </AppLayout>
  );
}


