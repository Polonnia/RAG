import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Input, Space, Spin, Select, message, Modal, Form, InputNumber, List, Tag, Progress } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { generateExamStream, saveExamHistory, getExamHistory, deleteExamHistory, listTeacherExams, createExam } from '../services/examTeacherService';
const { TextArea } = Input;

const typeMap = {
  choice: '单选',
  multi: '多选',
  fill_blank: '填空',
  short_answer: '简答',
  programming: '编程'
};

const renderQuestionOptions = (q) => {
  if (!q.type) return null;
  
  // 单选/多选题显示选项
  if ((q.type === 'choice' || q.type === 'multi') && q.options) {
    let options = q.options;
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch { return null; }
    }
    
    if (Array.isArray(options)) {
      return (
        <div style={{ marginTop: 8, paddingLeft: 16, fontSize: 12, color: '#666' }}>
          {options.map((opt, i) => (
            <div key={i}>{String.fromCharCode(65 + i)}. {opt}</div>
          ))}
        </div>
      );
    } else if (typeof options === 'object') {
      return (
        <div style={{ marginTop: 8, paddingLeft: 16, fontSize: 12, color: '#666' }}>
          {Object.entries(options).map(([k, v]) => (
            <div key={k}>{k}. {v}</div>
          ))}
        </div>
      );
    }
  }
  
  // 简答题/编程题显示答案提示
  if ((q.type === 'short_answer' || q.type === 'programming') && q.explanation) {
    return (
      <div style={{ marginTop: 8, paddingLeft: 16, fontSize: 12, color: '#999', maxWidth: 300 }}>
        <strong>参考答案：</strong> {q.explanation.slice(0, 100)}{q.explanation.length > 100 ? '...' : ''}
      </div>
    );
  }
  
  return null;
};

export default function ExamGenerator() {
  const [outline, setOutline] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionConfig, setQuestionConfig] = useState({ choice: 5, multi: 3, fill_blank: 3, short_answer: 2, programming: 1 });
  const [loading, setLoading] = useState(false);
  const [examContent, setExamContent] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [streamStage, setStreamStage] = useState('');
  const [streamProgress, setStreamProgress] = useState(0);
  const [createVisible, setCreateVisible] = useState(false);
  const [examHistory, setExamHistory] = useState([]);
  const [teacherExams, setTeacherExams] = useState([]);
  const [form] = Form.useForm();

  const allQuestions = useMemo(() => {
    if (!examContent) return [];
    return [
      ...(examContent.concept_questions || []).map(q => ({ ...q, type: 'choice' })),
      ...(examContent.multi_questions || []).map(q => ({ ...q, type: 'multi' })),
      ...(examContent.fill_blank_questions || []).map(q => ({ ...q, type: 'fill_blank' })),
      ...(examContent.short_answer_questions || []).map(q => ({ ...q, type: 'short_answer' })),
      ...(examContent.programming_questions || []).map(q => ({ ...q, type: 'programming' })),
    ];
  }, [examContent]);

  async function refreshHistory() {
    try { setExamHistory(await getExamHistory()); } catch {}
  }
  async function refreshTeacherExams() {
    try { const r = await listTeacherExams(); setTeacherExams(r.exams || []); } catch {}
  }
  useEffect(() => { refreshHistory(); refreshTeacherExams(); }, []);

  const handleGenerate = async () => {
    if (!outline.trim()) { message.warning('请输入课程大纲'); return; }

    setLoading(true);
    setExamContent(null);
    setSelectedQuestions([]);
    setStreamStage('准备生成...');
    setStreamProgress(0);

    let finalContent = null;

    try {
      await generateExamStream({
        courseOutline: outline,
        questionConfig,
        difficulty,
        onEvent: (event) => {
          if (typeof event.progress === 'number') {
            setStreamProgress(Math.max(0, Math.min(100, event.progress)));
          }

          if (event.type === 'stage') {
            setStreamStage(event.stage || '生成中...');
            return;
          }

          if (event.type === 'partial' && event.exam_content) {
            setStreamStage(event.stage || '生成中...');
            setExamContent({ ...event.exam_content });
            return;
          }

          if (event.type === 'done' && event.exam_content) {
            finalContent = event.exam_content;
            setStreamStage('生成完成');
            setExamContent({ ...event.exam_content });
            return;
          }

          if (event.type === 'error') {
            throw new Error(event.message || '生成失败');
          }
        },
      });

      if (!finalContent) {
        throw new Error('生成未返回最终结果');
      }

      await saveExamHistory(outline, finalContent);
      refreshHistory();
      message.success('考核内容生成完成');
    } catch (e) {
      message.error(e?.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async () => {
    const values = await form.validateFields();
    try {
      const selected = selectedQuestions.map(idx => allQuestions[idx]);
      await createExam({ title: values.title, description: values.description, duration: values.duration, questions: selected });
      message.success('考试创建成功');
      setCreateVisible(false);
      form.resetFields();
      refreshTeacherExams();
    } catch {
      message.error('创建考试失败');
    }
  };

  return (
    <AppLayout>
      <h2 style={{ fontWeight: 700, marginTop: 0 }}>
        <FormOutlined style={{ marginRight: 8, color: '#1677ff' }} />
        考试内容生成
      </h2>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <TextArea rows={4} value={outline} onChange={e => setOutline(e.target.value)} placeholder="请输入课程大纲..." />
        <Space align="center">
          <span>难度：</span>
          <Select value={difficulty} onChange={setDifficulty} style={{ width: 140 }}
                  options={[{ value: 'easy', label: '简单' }, { value: 'medium', label: '中等' }, { value: 'hard', label: '困难' }]} />
          <span>题量配置：</span>
          <Space>
            <InputNumber min={0} value={questionConfig.choice} onChange={(v) => setQuestionConfig(s => ({ ...s, choice: v }))} /> 单选
            <InputNumber min={0} value={questionConfig.multi} onChange={(v) => setQuestionConfig(s => ({ ...s, multi: v }))} /> 多选
            <InputNumber min={0} value={questionConfig.fill_blank} onChange={(v) => setQuestionConfig(s => ({ ...s, fill_blank: v }))} /> 填空
            <InputNumber min={0} value={questionConfig.short_answer} onChange={(v) => setQuestionConfig(s => ({ ...s, short_answer: v }))} /> 简答
            <InputNumber min={0} value={questionConfig.programming} onChange={(v) => setQuestionConfig(s => ({ ...s, programming: v }))} /> 编程
          </Space>
        </Space>
        <Button type="primary" onClick={handleGenerate} loading={loading}>生成考核内容</Button>
        {loading && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ marginBottom: 8, color: '#666' }}>{streamStage || '生成中...'}</div>
            <Progress percent={streamProgress} status="active" />
          </div>
        )}
        <Spin spinning={loading}>
          {allQuestions.length > 0 && (
            <div>
              <h3>题目预览（点击选择/取消）</h3>
              <List
                bordered
                dataSource={allQuestions}
                renderItem={(q, idx) => (
                  <List.Item onClick={() => setSelectedQuestions(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                             style={{
                               cursor: 'pointer',
                               background: selectedQuestions.includes(idx) ? '#e6f4ff' : undefined,
                               border: selectedQuestions.includes(idx) ? '2px solid #1890ff' : '1px solid #d9d9d9',
                               borderRadius: '6px',
                               marginBottom: '8px'
                             }}
                  >
                    <div style={{ width: '100%' }}>
                      <div>
                        <Tag color={selectedQuestions.includes(idx) ? "green" : "blue"}>
                          {selectedQuestions.includes(idx) ? "✓ " : ""}{typeMap[q.type] || q.type}
                        </Tag> {q.question}
                      </div>
                      {renderQuestionOptions(q)}
                    </div>
                  </List.Item>
                )}
              />
              <Button type="primary" style={{ marginTop: 12 }} onClick={() => setCreateVisible(true)} disabled={selectedQuestions.length === 0}>创建考试</Button>
            </div>
          )}
        </Spin>

        <div>
          <h3>我的考试</h3>
          <List
            dataSource={teacherExams}
            renderItem={(e) => (
              <List.Item>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ color: '#888' }}>{e.description}</div>
                </div>
              </List.Item>
            )}
          />
        </div>

        <div>
          <h3>考核生成历史</h3>
          <List
            dataSource={examHistory}
            renderItem={(h) => (
              <List.Item actions={[<a onClick={() => deleteExamHistory(h.id).then(refreshHistory)} key="del">删除</a>]}>
                <div>
                  <div style={{ fontWeight: 600 }}>{h.outline?.slice(0, 50)}...</div>
                </div>
              </List.Item>
            )}
          />
        </div>
      </Space>

      <Modal open={createVisible} title="创建考试" onCancel={() => setCreateVisible(false)} onOk={handleCreateExam} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="考试标题" rules={[{ required: true, message: '请输入考试标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="考试描述">
            <Input />
          </Form.Item>
          <Form.Item name="duration" label="时长（分钟）" rules={[{ required: true, message: '请输入时长' }]}>
            <InputNumber min={1} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}