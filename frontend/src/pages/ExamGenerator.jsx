import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Input, Space, Spin, Select, message, Modal, Form, InputNumber, List, Tag, Progress, Card, Tabs } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { generateExamStream, saveExamHistory, getExamHistory, deleteExamHistory, listTeacherExams, createExam } from '../services/examTeacherService';
import PageHeader from '../components/PageHeader';
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
        <div style={{ marginTop: 8, paddingLeft: 16, fontSize: 13, color: '#666' }}>
          {options.map((opt, i) => (
            <div key={i}>{String.fromCharCode(65 + i)}. {opt}</div>
          ))}
        </div>
      );
    } else if (typeof options === 'object') {
      return (
        <div style={{ marginTop: 8, paddingLeft: 16, fontSize: 13, color: '#666' }}>
          {Object.entries(options).map(([k, v]) => (
            <div key={k}>{k}. {v}</div>
          ))}
        </div>
      );
    }
  }


  return null;
};

// 渲染：正确答案 + 题目解析
// 格式化解析文本，处理选项解析的换行
const FormatExplanation = ({ explanation }) => {
  if (!explanation) return null;

  // 检查是否已经是新格式（包含换行符和"选项A"、"选项B"等）
  if (explanation.includes('\n') && explanation.includes('选项A') && explanation.includes('选项B')) {
    // 已经是新格式，直接显示
    return explanation.split('\n').map((line, index) => (
      <div key={index} style={{ marginBottom: index > 0 ? 4 : 0 }}>
        {line}
      </div>
    ));
  }

  // 检查是否是老格式的选项解析（包含"选项A"、"选项B"但没有换行）
  if (explanation.includes('选项A') && explanation.includes('选项B')) {
    // 在老格式的"选项X"前添加换行
    let formatted = explanation
      .replace(/选项B/g, '\n选项B')
      .replace(/选项C/g, '\n选项C')
      .replace(/选项D/g, '\n选项D')
      .replace(/选项E/g, '\n选项E')
      .replace(/选项F/g, '\n选项F');

    return formatted.split('\n').map((line, index) => (
      <div key={index} style={{ marginBottom: index > 0 ? 4 : 0 }}>
        {line}
      </div>
    ));
  }

  // 不包含选项解析，直接返回原文本
  return explanation;
};

const renderAnswerAndExplanation = (q) => {
  // 只有 单选/多选/填空 显示正确答案
  const showAnswer = ['choice', 'multi', 'fill_blank'].includes(q.type);
  const hasAnswer = showAnswer && q.correct_answer != null && q.correct_answer !== '';
  const hasExplain = q.explanation != null && q.explanation !== '';

  if (!hasAnswer && !hasExplain) return null;

  return (
    <div style={{ marginTop: 10, padding: '10px 14px', background: '#f9fbff', borderRadius: 6, border: '1px solid #e6efff' }}>
      {/* 正确答案：只在单选、多选、填空显示 */}
      {hasAnswer && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1677ff', marginBottom: 6 }}>
          正确答案：{q.correct_answer}
        </div>
      )}

      {/* 解析：所有题型都显示 */}
      {hasExplain && (
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600 }}>题目解析：</span>
          <FormatExplanation explanation={q.explanation} />
        </div>
      )}
    </div>
  );
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

  const questionPresetMap = {
    balanced: { choice: 5, multi: 3, fill_blank: 3, short_answer: 2, programming: 1 },
    objective: { choice: 8, multi: 5, fill_blank: 4, short_answer: 1, programming: 0 },
    advanced: { choice: 3, multi: 3, fill_blank: 2, short_answer: 4, programming: 2 },
  miniTest: { choice: 3, multi: 2, fill_blank: 2, short_answer: 1, programming: 0 },
  objective: { choice: 10, multi: 6, fill_blank: 4, short_answer: 0, programming: 0 },
  subjective: { choice: 0, multi: 0, fill_blank: 0, short_answer: 5, programming: 3 },
  };

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

  const normalizeHistoryExamContent = (historyItem) => {
    const raw = historyItem?.examContent ?? historyItem?.exam_content ?? null;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (typeof raw === 'object') return raw;
    return null;
  };

  const handleHistoryPreview = (historyItem) => {
    const parsedContent = normalizeHistoryExamContent(historyItem);
    if (!parsedContent) {
      message.warning('该历史记录没有可渲染的题目内容');
      return;
    }

    setOutline(historyItem?.outline || outline);
    setExamContent({ ...parsedContent });
    setSelectedQuestions([]);
    setStreamStage(loading ? '已切换为历史记录预览（当前生成仍在后台进行）' : '已加载历史记录');
  };

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

  const applyQuestionPreset = (presetKey) => {
    const next = questionPresetMap[presetKey];
    if (!next) return;
    setQuestionConfig(next);
  };

  const updateQuestionCount = (key, value) => {
    const safeValue = Number(value || 0);
    setQuestionConfig((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(20, safeValue)),
    }));
  };

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter">
        <style>{`
          .exam-generator-panel {
            border: 1px solid #e6f0ff;
            background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          }
          .exam-outline-input {
            border-radius: 10px !important;
            border: 1px solid #d6e4ff !important;
            transition: all 0.2s ease !important;
          }
          .exam-outline-input:hover {
            border-color: #69b1ff !important;
          }
          .exam-outline-input:focus,
          .exam-outline-input:focus-within {
            border-color: #1677ff !important;
            box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12) !important;
          }
          .config-chip {
            border-radius: 999px;
            border: 1px solid #d6e4ff;
            background: #f7fbff;
            color: #1f3f75;
          }
          .config-chip:hover {
            border-color: #69b1ff;
            background: #eef6ff;
          }
          .exam-control-group {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .exam-label {
            min-width: 68px;
            font-size: 13px;
            color: #44556f;
            font-weight: 600;
          }
          .exam-primary-action {
            border-radius: 10px;
            height: 40px;
            font-weight: 700;
            padding: 0 18px;
            box-shadow: 0 8px 16px rgba(22, 119, 255, 0.18);
          }
          .count-item {
            min-width: 110px;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid #e6eeff;
            background: #fff;
          }
          .count-label {
            font-size: 12px;
            color: #59708f;
            margin-bottom: 6px;
          }
        `}</style>
        <PageHeader
          title="考试内容生成"
          subtitle="配置题型和难度，流式生成并筛选题目后创建考试"
          icon={<FormOutlined />}
          variant="dashboard"
        />

        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card className="page-section exam-generator-panel" style={{ borderRadius: 14 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <TextArea
                className="exam-outline-input"
                rows={5}
                value={outline}
                onChange={e => setOutline(e.target.value)}
                placeholder="请输入课程大纲，建议包含章节结构、重点知识点、能力目标..."
                showCount
                maxLength={3000}
              />

              <div className="exam-control-group">
                <span className="exam-label">难度设置</span>
                <Select value={difficulty} onChange={setDifficulty} style={{ width: 140 }}
                        options={[{ value: 'easy', label: '简单' }, { value: 'medium', label: '中等' }, { value: 'hard', label: '困难' }]} />
                <Space size={6}>
                  <Button size="small" className="config-chip" onClick={() => setDifficulty('easy')}>简单</Button>
                  <Button size="small" className="config-chip" onClick={() => setDifficulty('medium')}>中等</Button>
                  <Button size="small" className="config-chip" onClick={() => setDifficulty('hard')}>困难</Button>
                </Space>
              </div>

              <div className="exam-control-group">
                <span className="exam-label">快速配置</span>
                <Button size="small" className="config-chip" onClick={() => applyQuestionPreset('balanced')}>均衡题组</Button>
                <Button size="small" className="config-chip" onClick={() => applyQuestionPreset('objective')}>客观题优先</Button>
                <Button size="small" className="config-chip" onClick={() => applyQuestionPreset('advanced')}>高阶能力</Button>
                <Button size="small" className="config-chip" onClick={() => applyQuestionPreset('miniTest')}>随堂小测</Button>
                <Button size="small" className="config-chip" onClick={() => applyQuestionPreset('objective')}>纯客观题</Button>
                <Button size="small" className="config-chip" onClick={() => applyQuestionPreset('subjective')}>纯主观题</Button>
              </div>

              <div className="exam-control-group" style={{ alignItems: 'flex-start' }}>
                <span className="exam-label" style={{ marginTop: 6 }}>题量配置</span>
                <Space wrap>
                  <div className="count-item">
                    <div className="count-label">单选题</div>
                    <InputNumber min={0} max={20} value={questionConfig.choice} onChange={(v) => updateQuestionCount('choice', v)} style={{ width: '100%' }} />
                  </div>
                  <div className="count-item">
                    <div className="count-label">多选题</div>
                    <InputNumber min={0} max={20} value={questionConfig.multi} onChange={(v) => updateQuestionCount('multi', v)} style={{ width: '100%' }} />
                  </div>
                  <div className="count-item">
                    <div className="count-label">填空题</div>
                    <InputNumber min={0} max={20} value={questionConfig.fill_blank} onChange={(v) => updateQuestionCount('fill_blank', v)} style={{ width: '100%' }} />
                  </div>
                  <div className="count-item">
                    <div className="count-label">简答题</div>
                    <InputNumber min={0} max={20} value={questionConfig.short_answer} onChange={(v) => updateQuestionCount('short_answer', v)} style={{ width: '100%' }} />
                  </div>
                  <div className="count-item">
                    <div className="count-label">编程题</div>
                    <InputNumber min={0} max={20} value={questionConfig.programming} onChange={(v) => updateQuestionCount('programming', v)} style={{ width: '100%' }} />
                  </div>
                </Space>
              </div>
              <div className="exam-control-group" style={{ justifyContent: 'space-between' }}>
                <span style={{ color: '#73819a', fontSize: 12 }}>建议先使用“均衡题组”，再微调题量后生成。</span>
                <Button className="exam-primary-action" type="primary" onClick={handleGenerate} loading={loading}>生成考核内容</Button>
              </div>
              {loading && (
                <div style={{ maxWidth: 560 }}>
                  <div style={{ marginBottom: 8, color: '#666' }}>{streamStage || '生成中...'}</div>
                  <Progress percent={streamProgress} status="active" />
                </div>
              )}
            </Space>
          </Card>

          <Spin spinning={loading}>
            {allQuestions.length > 0 && (
              <Card className="page-section fade-in-up" title="题目预览（点击选择/取消）" style={{ borderRadius: 14 }}>
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
                          <Tag color={selectedQuestions.includes(idx) ? 'green' : 'blue'}>
                            {selectedQuestions.includes(idx) ? '✓ ' : ''}{typeMap[q.type] || q.type}
                          </Tag> {q.question}
                        </div>
                        {renderQuestionOptions(q)}
                        {renderAnswerAndExplanation(q)}
                      </div>
                    </List.Item>
                  )}
                />
                <Button type="primary" style={{ marginTop: 12 }} onClick={() => setCreateVisible(true)} disabled={selectedQuestions.length === 0}>创建考试</Button>
              </Card>
            )}
          </Spin>

          <Card className="page-section" style={{ borderRadius: 14 }}>
            <Tabs
              items={[
                {
                  key: 'teacherExams',
                  label: '我的考试',
                  children: (
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
                  )
                },
                {
                  key: 'history',
                  label: '生成历史',
                  children: (
                    <List
                      dataSource={examHistory}
                      renderItem={(h) => (
                        <List.Item
                          onClick={() => handleHistoryPreview(h)}
                          style={{ cursor: 'pointer' }}
                          actions={[
                            <a
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteExamHistory(h.id).then(refreshHistory);
                              }}
                              key="del"
                            >
                              删除
                            </a>
                          ]}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{h.outline?.slice(0, 50)}...</div>
                          </div>
                        </List.Item>
                      )}
                    />
                  )
                }
              ]}
            />
          </Card>
        </Space>
      </div>

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