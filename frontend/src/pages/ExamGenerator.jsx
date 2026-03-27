import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Input, Space, Spin, Select, message, Modal, Form, InputNumber, List, Tag } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { generateExam, saveExamHistory, getExamHistory, deleteExamHistory, listTeacherExams, createExam } from '../services/examTeacherService';
const { TextArea } = Input;

export default function ExamGenerator() {
  const [outline, setOutline] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionConfig, setQuestionConfig] = useState({ choice: 5, multi: 3, fill_blank: 3, short_answer: 2, programming: 1 });
  const [loading, setLoading] = useState(false);
  const [examContent, setExamContent] = useState(null);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
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
    try {
      const data = await generateExam({ courseOutline: outline, questionConfig, difficulty });
      setExamContent(data.exam_content);
      setSelectedQuestions([]);
      await saveExamHistory(outline, data.exam_content);
      refreshHistory();
      message.success('考核内容生成完成');
    } catch (e) {
      message.error('生成失败');
    }
    setLoading(false);
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
                    <div>
                      <Tag color={selectedQuestions.includes(idx) ? "green" : "blue"}>
                        {selectedQuestions.includes(idx) ? "✓ " : ""}{q.type}
                      </Tag> {q.question}
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