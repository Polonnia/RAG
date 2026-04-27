import React, { useState, useEffect } from 'react';
import { Card, List, Empty, Spin, Button, Input, Modal, Radio, Space, Progress, Result, Tag, Checkbox, Row, Col } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import http from '../api/http';
import AppLayout from '../components/layout/AppLayout';
import { message } from 'antd';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';

const { TextArea } = Input;

export default function StudentWrongbook() {
  const [keywords, setKeywords] = useState([]);
  const [accuracyMap, setAccuracyMap] = useState({});
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [questions, setQuestions] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [practiceModal, setPracticeModal] = useState(false);
  const [practiceCount, setPracticeCount] = useState(5);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [practiceResult, setPracticeResult] = useState(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState([]);

  useEffect(() => {
    // 自动修复错题本数据（为多知识点的错题补充缺失记录）
    http.post('/student/fix-wrongbook')
      .catch(err => console.log('修复错题本:', err.message));
    
    http.get('/student/keyword-accuracy').then(res => {
      // 使用 keyword-accuracy 作为知识点列表，确保与学情分析保持一致
      const keywords = (res.data.keyword_accuracy || []).map(item => ({
        keyword: item.keyword,
        count: item.total_count
      }));
      setKeywords(keywords);
      const map = {};
      (res.data.keyword_accuracy || []).forEach(item => {
        map[item.keyword] = item.accuracy;
      });
      setAccuracyMap(map);
    });

    // 监听来自学情分析页面的知识点选择事件
    const handleSelectKeyword = (event) => {
      const keyword = event.detail;
      if (keyword) {
        // 查找匹配的知识点，支持两种格式（带特殊字符或清理后）
        const matchedKeyword = keywords.find(kw => {
          const cleanedKw = kw.keyword.replace(/[\[\]"']/g, '').trim();
          return cleanedKw === keyword || kw.keyword === keyword;
        })?.keyword;
        
        if (matchedKeyword) {
          setSelectedKeyword(matchedKeyword);
        } else {
          // 如果没有精确匹配，尝试直接使用清理后的关键字
          setSelectedKeyword(keyword);
        }
        setResult(null);
        setActiveQuestion(null);
      }
    };

    window.addEventListener('selectKeyword', handleSelectKeyword);
    return () => {
      window.removeEventListener('selectKeyword', handleSelectKeyword);
    };
  }, []);

  useEffect(() => {
    if (selectedKeyword) {
      setLoading(true);
      http.get('/student/wrongbook/questions', { params: { keyword: selectedKeyword } })
        .then(res => setQuestions(res.data || []))
        .finally(() => setLoading(false));
      http.get('/student/practice-records', { params: { keyword: selectedKeyword } })
        .then(res => setPracticeHistory(res.data || []));
    }
  }, [selectedKeyword]);

  const handleSelectKeyword = (keyword) => {
    if (selectedKeyword === keyword) {
      setSelectedKeyword('');
      setQuestions([]);
      setPracticeHistory([]);
    } else {
      setSelectedKeyword(keyword);
      setResult(null);
      setActiveQuestion(null);
    }
  };

  const handleSubmit = async () => {
    if (!activeQuestion) return;
    setLoading(true);
    try {
      const res = await http.post('/student/wrongbook/submit',
        new URLSearchParams({ wrong_id: activeQuestion.id, answer })
      );
      setResult(res.data);
    } catch (e) {
      message.error('提交失败');
    }
    setLoading(false);
  };

  const handleGeneratePractice = async () => {
    if (!selectedKeyword) return;
    setPracticeLoading(true);
    setPracticeQuestions([]);
    setPracticeResult(null);
    setPracticeAnswers({});
    try {
      console.log('[巩固练习] 开始生成习题，知识点:', selectedKeyword, '数量:', practiceCount);
      const res = await http.post('/student/generate-practice',
        new URLSearchParams({ keyword: selectedKeyword, count: practiceCount, difficulty: '中等' }),
        { timeout: 180000 }
      );
      console.log('[巩固练习] 生成习题响应:', res);
      const questionsData = res.data?.questions || res.data || [];
      console.log('[巩固练习] 设置习题数据，数量:', questionsData.length);
      setPracticeQuestions(questionsData);
      if (questionsData.length === 0) {
        message.warning('生成的习题为空');
      } else {
        message.success(`成功生成 ${questionsData.length} 道习题`);
      }
    } catch (e) {
      console.error('[巩固练习] 生成习题失败:', e);
      console.error('[巩固练习] 错误详情:', e.response?.data || e.message);
      message.error('生成习题失败: ' + (e.response?.data?.detail || e.message));
    }
    setPracticeLoading(false);
  };

  const handleSubmitPractice = async () => {
    setPracticeLoading(true);
    try {
      console.log('[巩固练习] 开始提交练习，题数:', practiceQuestions.length);
      const answers = practiceQuestions.map((q, idx) => ({
        question: q.question,
        answer: practiceAnswers[idx] || '',
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        knowledge_points: q.knowledge_points,
        options: q.options
      }));
      console.log('[巩固练习] 提交数据:', answers);
      const res = await http.post('/student/submit-practice',
        new URLSearchParams({ answers_data: JSON.stringify(answers), keyword: selectedKeyword })
      );
      console.log('[巩固练习] 提交响应:', res);
      setPracticeResult(res.data);
      message.success(`练习得分: ${res.data.score} 分`);
      
      // 更新知识点正确率
      const accRes = await http.get('/student/keyword-accuracy');
      const map = {};
      (accRes.data.keyword_accuracy || []).forEach(item => {
        map[item.keyword] = item.accuracy;
      });
      setAccuracyMap(map);
      
      // 更新练习历史
      const historyRes = await http.get('/student/practice-records', { params: { keyword: selectedKeyword } });
      setPracticeHistory(historyRes.data || []);
    } catch (e) {
      console.error('[巩固练习] 提交失败:', e);
      console.error('[巩固练习] 错误详情:', e.response?.data || e.message);
      message.error('提交失败: ' + (e.response?.data?.detail || e.message));
    }
    setPracticeLoading(false);
  };

  const practiceProgress = practiceQuestions.length > 0 ? Math.round(Object.keys(practiceAnswers).length / practiceQuestions.length * 100) : 0;
  const currentAccuracy = selectedKeyword && accuracyMap[selectedKeyword] !== undefined ? accuracyMap[selectedKeyword] : 0;

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter">
      <PageHeader
        title="错题本"
        subtitle="按知识点复盘错题并进入巩固练习"
        icon={<BookOutlined />}
        variant="dashboard"
      />

      <Row gutter={[16, 16]} className="page-section">
        <Col xs={24} sm={12} md={8}>
          <StatCard title="知识点数量" value={keywords.length} color="#1677ff" />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard title="当前知识点错题" value={questions.length} color="#fa8c16" />
        </Col>
        <Col xs={24} sm={24} md={8}>
          <StatCard title="当前知识点正确率" value={currentAccuracy} suffix="%" color="#52c41a" />
        </Col>
      </Row>

      <Card className="page-section fade-in-up" title="知识点与错题列表" 
            style={{ borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1', marginBottom: 24 }}>
        <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          <b style={{ marginRight: 12 }}>知识点标签：</b>
          {keywords.length === 0 ? <Empty description="暂无错题" /> :
            keywords.map((k, idx) => (
              <Tag.CheckableTag
                key={`${k.keyword}-${idx}`}
                checked={selectedKeyword === k.keyword}
                onChange={() => handleSelectKeyword(k.keyword)}
                style={{
                  fontSize: 16,
                  margin: 6,
                  padding: '8px 16px',
                  background: selectedKeyword === k.keyword ? '#e6f7ff' : '#f5f5f5',
                  border: selectedKeyword === k.keyword ? '2px solid #1890ff' : '1px solid #eee',
                  color: accuracyMap[k.keyword] < 60 ? '#f5222d' : accuracyMap[k.keyword] < 80 ? '#faad14' : '#52c41a',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: selectedKeyword === k.keyword ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: selectedKeyword === k.keyword ? '0 4px 16px rgba(24, 144, 255, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontWeight: selectedKeyword === k.keyword ? 600 : 500,
                  letterSpacing: selectedKeyword === k.keyword ? '0.5px' : '0px'
                }}
                title={`正确率：${accuracyMap[k.keyword] !== undefined ? accuracyMap[k.keyword] + '%' : '--'}`}
              >
                {k.keyword}
                <span style={{ color: '#bbb', fontSize: 12, marginLeft: 4 }}>正确率：{accuracyMap[k.keyword] !== undefined ? accuracyMap[k.keyword] + '%' : '--'}</span>
              </Tag.CheckableTag>
            ))}
        </div>

        {selectedKeyword && (
          <div>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Space wrap>
                <Tag color="processing">已选择：{selectedKeyword}</Tag>
                <Tag color={currentAccuracy < 60 ? 'error' : currentAccuracy < 80 ? 'warning' : 'success'}>
                  正确率：{accuracyMap[selectedKeyword] !== undefined ? accuracyMap[selectedKeyword] + '%' : '--'}
                </Tag>
              </Space>
              <Button size="small" type="primary" ghost onClick={() => setPracticeModal(true)} style={{ borderRadius: 16, fontWeight: 600 }}>
                巩固练习
              </Button>
            </div>
            <b style={{ fontSize: 18 }}>错题列表{selectedKeyword ? `（${selectedKeyword}）` : ''}：</b>
            {loading ? <Spin style={{ marginLeft: 16 }} /> : (
              <List
                dataSource={questions}
                locale={{ emptyText: <Empty description="该知识点暂无错题" /> }}
                renderItem={q => {
                  // 防御性处理 options - 如果是字符串则尝试解析
                  let displayOptions = q.options;
                  if (typeof displayOptions === 'string') {
                    try {
                      displayOptions = JSON.parse(displayOptions);
                    } catch {
                      displayOptions = {};
                    }
                  }
                  return (
                  <List.Item style={{ padding: '16px 0', border: 'none', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{q.question}</div>
                      {displayOptions && Object.keys(displayOptions).length > 0 && (
                        <div style={{ margin: '8px 0' }}>
                          {Object.entries(displayOptions).map(([k, v]) => (
                            <div key={k}>{k}. {v}</div>
                          ))}
                        </div>
                      )}
                      <Button type="primary" ghost onClick={() => {
                        setActiveQuestion(q);
                        setAnswer('');
                        setResult(null);
                      }} style={{ marginTop: 8, borderRadius: 12, fontWeight: 600 }}>重做</Button>
                    </div>
                  </List.Item>
                  );
                }}
              />
            )}

            <div style={{ marginTop: 32 }}>
              <b style={{ fontSize: 16 }}>巩固练习历史：</b>
              {practiceHistory.length === 0 ? (
                <div style={{ color: '#aaa', margin: '12px 0' }}><Empty description="暂无巩固练习记录" /></div>
              ) : (
                <List
                  dataSource={practiceHistory}
                  renderItem={h => {
                    // 防御性处理 options - 如果是字符串则尝试解析
                    let displayOptions = h.options;
                    if (typeof displayOptions === 'string') {
                      try {
                        displayOptions = JSON.parse(displayOptions);
                      } catch {
                        displayOptions = {};
                      }
                    }
                    return (
                    <List.Item style={{ padding: '16px 0', border: 'none', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{h.question}</div>
                        {displayOptions && Object.keys(displayOptions).length > 0 && (
                          <div style={{ margin: '8px 0' }}>
                            {Object.entries(displayOptions).map(([k, v]) => (
                              <div key={k}>{k}. {v}</div>
                            ))}
                          </div>
                        )}
                        <div style={{ margin: '8px 0' }}>你的答案：{h.student_answer}</div>
                        <div style={{ margin: '8px 0' }}>正确答案：{h.correct_answer}</div>
                        <div style={{ margin: '8px 0' }}>解析：{h.explanation}</div>
                        <div style={{ color: '#888', fontSize: 12 }}>{h.time}</div>
                      </div>
                    </List.Item>
                    );
                  }}
                />
              )}
            </div>
          </div>
        )}

        <Modal
          open={!!activeQuestion}
          onCancel={() => { setActiveQuestion(null); setResult(null); setAnswer(''); }}
          footer={null}
          title={<span style={{ fontWeight: 700, fontSize: 20 }}>错题重做</span>}
          bodyStyle={{ padding: 24 }}
        >
          {activeQuestion && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 16 }}>{activeQuestion.question}</div>
              {/* 根据题目类型显示对应的输入界面 */}
              {activeQuestion.type === 'choice' ? (
                // 单选题
                <Radio.Group
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  style={{ marginBottom: 16 }}
                >
                  <Space direction="vertical">
                    {activeQuestion.options && Object.entries(activeQuestion.options).map(([k, v]) => (
                      <Radio key={k} value={k}>{k}. {v}</Radio>
                    ))}
                  </Space>
                </Radio.Group>
              ) : activeQuestion.type === 'multi' ? (
                // 多选题
                <Checkbox.Group
                  value={answer ? answer.split(',') : []}
                  onChange={checkedValues => setAnswer(checkedValues.join(','))}
                  style={{ marginBottom: 16 }}
                >
                  <Space direction="vertical">
                    {activeQuestion.options && Object.entries(activeQuestion.options).map(([k, v]) => (
                      <Checkbox key={k} value={k}>{k}. {v}</Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
              ) : activeQuestion.type === 'fill_blank' ? (
                // 填空题
                <Input
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="请输入答案，多个空用空格分隔"
                  style={{ width: '100%', marginBottom: 16, fontSize: 16, padding: 8, borderRadius: 8 }}
                />
              ) : activeQuestion.type === 'short_answer' ? (
                // 简答题
                <TextArea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="请输入答案"
                  rows={4}
                  style={{ marginBottom: 16, fontSize: 16, padding: 8, borderRadius: 8 }}
                />
              ) : activeQuestion.type === 'programming' ? (
                // 编程题
                <TextArea
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="请输入代码"
                  rows={6}
                  style={{ marginBottom: 16, fontSize: 16, padding: 8, borderRadius: 8, fontFamily: 'monospace' }}
                />
              ) : (
                // 默认：文本输入
                <Input
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="请输入答案"
                  style={{ width: '100%', marginBottom: 16, fontSize: 16, padding: 8, borderRadius: 8 }}
                />
              )}
              <Button type="primary" onClick={handleSubmit} loading={loading} style={{ marginTop: 8, width: '100%', borderRadius: 12, fontWeight: 600 }}>
                提交
              </Button>
              {result && (
                <Result
                  status={result.is_correct ? 'success' : 'error'}
                  title={result.is_correct ? '回答正确' : '回答错误'}
                  subTitle={
                    <div style={{ marginTop: 8 }}>
                      <div>你的答案：<span style={{ color: result.is_correct ? '#52c41a' : '#d4380d' }}>{result.your_answer}</span></div>
                      <div>正确答案：<span style={{ color: '#52c41a' }}>{result.correct_answer}</span></div>
                      <div>解析：{result.explanation}</div>
                    </div>
                  }
                />
              )}
            </div>
          )}
        </Modal>

        <Modal
          open={practiceModal}
          onCancel={() => { setPracticeModal(false); setPracticeQuestions([]); setPracticeResult(null); setPracticeAnswers({}); }}
          footer={null}
          title={<span style={{ fontWeight: 800, fontSize: 20, color: '#1f3f75' }}>巩固练习 - {selectedKeyword}</span>}
          bodyStyle={{ padding: 20, background: '#f7fbff' }}
          width={860}
          centered
        >
          <div style={{
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid #d6e4ff',
            background: 'linear-gradient(90deg, #f8fbff 0%, #eef7ff 100%)'
          }}>
            <Space wrap>
              <Button
                type="primary"
                onClick={handleGeneratePractice}
                loading={practiceLoading}
                disabled={practiceLoading || !selectedKeyword}
                style={{ borderRadius: 10, fontWeight: 700, boxShadow: '0 8px 16px rgba(22,119,255,0.18)' }}
              >
                {practiceLoading ? '生成中...' : '生成巩固练习'}
              </Button>
              <Tag color="processing" style={{ borderRadius: 999 }}>知识点：{selectedKeyword || '--'}</Tag>
              {practiceQuestions.length > 0 && (
                <Tag color="blue" style={{ borderRadius: 999 }}>共 {practiceQuestions.length} 题</Tag>
              )}
            </Space>
            {practiceQuestions.length > 0 && (
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 12, color: '#59708f', marginBottom: 4 }}>完成进度</div>
                <Progress percent={practiceProgress} size="small" />
              </div>
            )}
          </div>
          {practiceQuestions.length === 0 ? (
            <Empty description="暂无巩固练习题目" />
          ) : (
            <div style={{ maxHeight: '56vh', overflowY: 'auto', paddingRight: 4 }}>
              {practiceQuestions.map((q, idx) => {
                // 防御性处理 options - 如果是字符串则尝试解析
                let displayOptions = q.options;
                if (typeof displayOptions === 'string') {
                  try {
                    displayOptions = JSON.parse(displayOptions);
                  } catch {
                    displayOptions = {};
                  }
                }
                return (
                <Card
                  key={`practice-q-${idx}`}
                  size="small"
                  style={{
                    marginBottom: 12,
                    borderRadius: 12,
                    border: '1px solid #e6eeff',
                    background: '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                  title={<span style={{ fontWeight: 700, color: '#1f3f75' }}>题目 {idx + 1}</span>}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, lineHeight: 1.7 }}>{q.question}</div>
                    {/* 根据题目类型显示对应的输入界面 */}
                    {q.type === 'choice' ? (
                      // 单选题
                      <Radio.Group
                        value={practiceAnswers[idx]}
                        onChange={e => setPracticeAnswers({ ...practiceAnswers, [idx]: e.target.value })}
                        style={{ marginBottom: 8 }}
                      >
                        <Space direction="vertical">
                          {displayOptions && Object.entries(displayOptions).map(([k, v]) => (
                            <Radio key={k} value={k}>{k}. {v}</Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    ) : q.type === 'multi' ? (
                      // 多选题
                      <Checkbox.Group
                        value={practiceAnswers[idx] ? practiceAnswers[idx].split(',') : []}
                        onChange={checkedValues => setPracticeAnswers({ ...practiceAnswers, [idx]: checkedValues.join(',') })}
                        style={{ marginBottom: 8 }}
                      >
                        <Space direction="vertical">
                          {displayOptions && Object.entries(displayOptions).map(([k, v]) => (
                            <Checkbox key={k} value={k}>{k}. {v}</Checkbox>
                          ))}
                        </Space>
                      </Checkbox.Group>
                    ) : q.type === 'fill_blank' ? (
                      // 填空题
                      <Input
                        value={practiceAnswers[idx] || ''}
                        onChange={e => setPracticeAnswers({ ...practiceAnswers, [idx]: e.target.value })}
                        placeholder="请输入答案，多个空用空格分隔"
                        style={{ width: '100%', marginBottom: 8, fontSize: 16, padding: 8, borderRadius: 8 }}
                      />
                    ) : q.type === 'short_answer' ? (
                      // 简答题
                      <TextArea
                        value={practiceAnswers[idx] || ''}
                        onChange={e => setPracticeAnswers({ ...practiceAnswers, [idx]: e.target.value })}
                        placeholder="请输入答案"
                        rows={3}
                        style={{ marginBottom: 8, fontSize: 16, padding: 8, borderRadius: 8 }}
                      />
                    ) : q.type === 'programming' ? (
                      // 编程题
                      <TextArea
                        value={practiceAnswers[idx] || ''}
                        onChange={e => setPracticeAnswers({ ...practiceAnswers, [idx]: e.target.value })}
                        placeholder="请输入代码"
                        rows={5}
                        style={{ marginBottom: 8, fontSize: 16, padding: 8, borderRadius: 8, fontFamily: 'monospace' }}
                      />
                    ) : (
                      // 默认：文本输入
                      <Input
                        value={practiceAnswers[idx] || ''}
                        onChange={e => setPracticeAnswers({ ...practiceAnswers, [idx]: e.target.value })}
                        placeholder="请输入答案"
                        style={{ width: '100%', marginBottom: 8, fontSize: 16, padding: 8, borderRadius: 8 }}
                      />
                    )}
                  </div>
                </Card>
                );
              })}
            </div>
          )}
          {practiceQuestions.length > 0 && !practiceResult && (
            <Button type="primary" onClick={handleSubmitPractice} loading={practiceLoading} style={{ marginTop: 16, width: '100%', borderRadius: 12, fontWeight: 700, height: 42 }}>
              提交练习
            </Button>
          )}
          {practiceResult && (
            <Card title={<span>练习得分：<span style={{ color: '#52c41a', fontWeight: 800 }}>{practiceResult.score}</span></span>} style={{ marginTop: 16, borderRadius: 12, border: '1px solid #d9f7be', background: '#fcfff5' }}>
              <List
                dataSource={practiceResult.results}
                renderItem={(r, idx) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div><b>题目{idx + 1}：</b>{r.question}</div>
                      <div>你的答案：<span style={{ color: r.is_correct ? '#52c41a' : '#d4380d' }}>{r.answer}</span></div>
                      <div>正确答案：<span style={{ color: '#52c41a' }}>{r.correct_answer}</span></div>
                      <div>解析：{r.explanation}</div>
                      <div>知识点：{Array.isArray(r.knowledge_points) ? r.knowledge_points.join('，') : r.knowledge_points}</div>
                      <div>判定：{r.is_correct ? <Tag color="green">正确</Tag> : <Tag color="red">错误</Tag>}</div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Modal>
      </Card>
      </div>
    </AppLayout>
  );
}
