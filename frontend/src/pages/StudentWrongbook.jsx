import React, { useState, useEffect } from 'react';
import { Card, List, Empty, Spin, Button, Input, Modal, Radio, Space, Progress, Result, Tag, Checkbox, Row, Col, Divider } from 'antd';
import { BookOutlined, CloseOutlined } from '@ant-design/icons';
import http from '../api/http';
import getApiUrl from '../apiConfig';
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
  const [practiceGenerateProgress, setPracticeGenerateProgress] = useState(0);
  const [practiceHistory, setPracticeHistory] = useState([]);
  
  // 重做功能相关状态
  const [retakingQuestionId, setRetakingQuestionId] = useState(null);
  const [retakingAnswer, setRetakingAnswer] = useState('');
  const [retakingResult, setRetakingResult] = useState(null);
  const [retakingLoading, setRetakingLoading] = useState(false);
  const [hoveredRetakingOption, setHoveredRetakingOption] = useState('');
  const [hoveredPracticeOption, setHoveredPracticeOption] = useState(null);

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

  const handleRetakeSubmit = async () => {
    if (!retakingQuestionId) return;
    setRetakingLoading(true);
    try {
      const res = await http.post('/student/wrongbook/submit',
        new URLSearchParams({ wrong_id: retakingQuestionId, answer: retakingAnswer })
      );
      setRetakingResult(res.data);
    } catch (e) {
      message.error('提交失败');
    }
    setRetakingLoading(false);
  };

  const handleGeneratePractice = async () => {
    if (!selectedKeyword) return;
    setPracticeLoading(true);
    setPracticeGenerateProgress(0);
    setPracticeQuestions([]);
    setPracticeResult(null);
    setPracticeAnswers({});
    try {
      console.log('[巩固练习] 开始生成习题，知识点:', selectedKeyword, '数量:', practiceCount);
      
      // 使用流式API获取进度信息
      const apiUrl = getApiUrl();
      const fullUrl = `${apiUrl}/student/generate-practice-stream`;
      console.log('[巩固练习] 调用URL:', fullUrl, 'API基础URL:', apiUrl);
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ 
          keyword: selectedKeyword, 
          count: String(practiceCount),
          difficulty: '中等' 
        })
      });
      
      console.log('[巩固练习] 响应状态:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let allQuestions = [];
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }
        
        // 处理缓冲区中的所有完整行
        const lines = buffer.split('\n');
        
        // 如果流结束，处理最后一行；否则保留最后一个不完整的行
        buffer = done ? '' : (lines.pop() || '');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            console.log('[巩固练习] 流式数据:', data);
            
            if (data.type === 'progress') {
              // 更新进度条
              setPracticeGenerateProgress(data.progress);
              console.log('[巩固练习] 进度更新:', data.progress);
            } else if (data.type === 'done') {
              // 完成
              allQuestions = data.questions || [];
              console.log('[巩固练习] 收到done消息，题目数:', allQuestions.length);
            } else if (data.type === 'error') {
              console.error('[巩固练习] 后端返回错误:', data.message);
            }
          } catch (e) {
            console.error('[巩固练习] 解析流式数据失败:', e, '行内容:', line);
          }
        }
        
        if (done) break;
      }
      
      console.log('[巩固练习] 生成习题完成，最终数量:', allQuestions.length);
      setPracticeQuestions(allQuestions);
      setPracticeGenerateProgress(100);
      
      if (allQuestions.length === 0) {
        message.warning('生成的习题为空');
      } else {
        message.success(`成功生成 ${allQuestions.length} 道习题`);
      }
    } catch (e) {
      console.error('[巩固练习] 生成习题失败:', e);
      console.error('[巩固练习] 错误详情:', e.message);
      message.error('生成习题失败: ' + e.message);
    }
    setPracticeLoading(false);
    setTimeout(() => setPracticeGenerateProgress(0), 1000);
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
            {/* 分割框 */}
            <div style={{
              margin: '16px 0',
              padding: '12px 16px',
              background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.06) 0%, rgba(24, 144, 255, 0.02) 100%)',
              border: '1px solid rgba(24, 144, 255, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <Space wrap style={{ flex: 1 }}>
                <Tag color="processing" style={{ marginRight: 4, fontSize: 15, padding: '6px 12px' }}>错题列表：{selectedKeyword}</Tag>
                <Tag color={currentAccuracy < 60 ? 'error' : currentAccuracy < 80 ? 'warning' : 'success'} style={{ fontSize: 15, padding: '6px 12px' }}>
                  正确率：{accuracyMap[selectedKeyword] !== undefined ? accuracyMap[selectedKeyword] + '%' : '--'}
                </Tag>
              </Space>
              <Button size="small" type="primary" ghost onClick={() => setPracticeModal(true)} style={{ borderRadius: 16, fontWeight: 600 }}>
                巩固练习
              </Button>
            </div>
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
                  const isRetaking = retakingQuestionId === q.id;
                  
                  return (
                  <List.Item style={{ padding: '16px 0', border: 'none', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{q.question}</span>
                        {!isRetaking && <Tag color="error" style={{ marginLeft: 12 }}>错题</Tag>}
                      </div>
                      
                      {!isRetaking ? (
                        <div>
                          {displayOptions && Object.keys(displayOptions).length > 0 && (
                            <div style={{ 
                              paddingLeft: 16,
                              borderLeft: '3px solid #d9d9d9',
                              background: '#fafafa',
                              borderRadius: 8,
                              paddingTop: 8,
                              paddingBottom: 8,
                              marginBottom: 16
                            }}>
                              {Object.entries(displayOptions).map(([k, v]) => (
                                <div 
                                  key={k}
                                  style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'default',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    marginBottom: 8,
                                    border: '1px solid #e8e8e8',
                                    background: '#fff',
                                    color: '#666'
                                  }}
                                >
                                  <span style={{ marginRight: 8, color: '#999' }}>○</span>
                                  <span>{k}. {v}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <Button 
                            type="primary" 
                            onClick={() => {
                              setRetakingQuestionId(q.id);
                              setRetakingAnswer('');
                              setRetakingResult(null);
                            }} 
                            style={{ marginTop: 8, borderRadius: 12, fontWeight: 600 }}
                          >
                            重做
                          </Button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 12, padding: '16px', background: '#f8fafb', border: '1px solid #e6f7ff', borderRadius: 12 }}>
                          <div style={{ 
                            fontWeight: 600, 
                            fontSize: 15,
                            color: '#1f1f1f',
                            marginBottom: 12
                          }}>
                            重做本题
                          </div>
                          
                          {/* 根据题目类型显示对应的输入界面 */}
                          {q.type === 'choice' ? (
                            // 单选题 - 与考试页面样式保持一致
                            <div style={{ 
                              paddingLeft: 16,
                              borderLeft: '3px solid #1890ff',
                              background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
                              borderRadius: 8,
                              paddingTop: 8,
                              paddingBottom: 8,
                              marginBottom: 16
                            }}>
                              {displayOptions && Object.entries(displayOptions).map(([k, v]) => {
                                const optionKey = `retaking_${k}`;
                                const isSelected = retakingAnswer === k;
                                const isHovered = hoveredRetakingOption === optionKey;
                                return (
                                  <label 
                                    key={k}
                                    style={{ 
                                      display: 'flex',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      padding: '10px 12px',
                                      borderRadius: 8,
                                      marginBottom: 8,
                                      transition: 'all 0.2s ease',
                                      border: isSelected ? '1px solid #69b1ff' : (isHovered ? '1px solid #91caff' : '1px solid transparent'),
                                      background: isSelected ? '#e6f4ff' : (isHovered ? '#f0f7ff' : 'transparent'),
                                      boxShadow: isHovered ? '0 2px 8px rgba(22,119,255,0.12)' : 'none'
                                    }}
                                    onMouseEnter={() => setHoveredRetakingOption(optionKey)}
                                    onMouseLeave={() => setHoveredRetakingOption('')}
                                  >
                                    <input 
                                      type="radio"
                                      name="retaking_choice"
                                      value={k}
                                      checked={isSelected}
                                      onChange={(e) => setRetakingAnswer(e.target.value)}
                                      style={{ marginRight: 8, cursor: 'pointer' }}
                                    />
                                    <span>{k}. {v}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : q.type === 'multi' ? (
                            // 多选题 - 与考试页面样式保持一致
                            <div style={{ 
                              paddingLeft: 16,
                              borderLeft: '3px solid #1890ff',
                              background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
                              borderRadius: 8,
                              paddingTop: 8,
                              paddingBottom: 8,
                              marginBottom: 16
                            }}>
                              {displayOptions && Object.entries(displayOptions).map(([k, v]) => {
                                const optionKey = `retaking_${k}`;
                                const selectedArray = retakingAnswer ? retakingAnswer.split(',') : [];
                                const isSelected = selectedArray.includes(k);
                                const isHovered = hoveredRetakingOption === optionKey;
                                return (
                                  <label 
                                    key={k}
                                    style={{ 
                                      display: 'flex',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      padding: '10px 12px',
                                      borderRadius: 8,
                                      marginBottom: 8,
                                      transition: 'all 0.2s ease',
                                      border: isSelected ? '1px solid #69b1ff' : (isHovered ? '1px solid #91caff' : '1px solid transparent'),
                                      background: isSelected ? '#e6f4ff' : (isHovered ? '#f0f7ff' : 'transparent'),
                                      boxShadow: isHovered ? '0 2px 8px rgba(22,119,255,0.12)' : 'none'
                                    }}
                                    onMouseEnter={() => setHoveredRetakingOption(optionKey)}
                                    onMouseLeave={() => setHoveredRetakingOption('')}
                                  >
                                    <input 
                                      type="checkbox"
                                      value={k}
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const newSelected = e.target.checked
                                          ? [...selectedArray, k]
                                          : selectedArray.filter(item => item !== k);
                                        setRetakingAnswer(newSelected.join(','));
                                      }}
                                      style={{ marginRight: 8, cursor: 'pointer' }}
                                    />
                                    <span>{k}. {v}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : q.type === 'fill_blank' ? (
                            // 填空题
                            <Input
                              value={retakingAnswer}
                              onChange={e => setRetakingAnswer(e.target.value)}
                              placeholder="请输入答案，多个空用空格分隔"
                              style={{ width: '100%', marginBottom: 16, fontSize: 14, borderRadius: 8 }}
                            />
                          ) : q.type === 'short_answer' || q.type === 'essay' ? (
                            // 简答题/问答题
                            <TextArea
                              value={retakingAnswer}
                              onChange={e => setRetakingAnswer(e.target.value)}
                              placeholder="请输入答案"
                              rows={4}
                              style={{ marginBottom: 16, fontSize: 14, borderRadius: 8 }}
                            />
                          ) : q.type === 'programming' ? (
                            // 编程题
                            <TextArea
                              value={retakingAnswer}
                              onChange={e => setRetakingAnswer(e.target.value)}
                              placeholder="请输入代码"
                              rows={6}
                              style={{ marginBottom: 16, fontSize: 14, borderRadius: 8, fontFamily: 'monospace' }}
                            />
                          ) : (
                            // 默认：文本输入
                            <Input
                              value={retakingAnswer}
                              onChange={e => setRetakingAnswer(e.target.value)}
                              placeholder="请输入答案"
                              style={{ width: '100%', marginBottom: 16, fontSize: 14, borderRadius: 8 }}
                            />
                          )}
                          
                          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                            <Button 
                              type="primary" 
                              onClick={handleRetakeSubmit} 
                              loading={retakingLoading}
                              style={{ borderRadius: 8, fontWeight: 600, flex: 1 }}
                            >
                              提交答案
                            </Button>
                            <Button 
                              onClick={() => {
                                setRetakingQuestionId(null);
                                setRetakingAnswer('');
                                setRetakingResult(null);
                                setHoveredRetakingOption('');
                              }}
                              style={{ borderRadius: 8, fontWeight: 600 }}
                            >
                              取消
                            </Button>
                          </div>
                          
                          {retakingResult && (
                            <Result
                              status={retakingResult.is_correct ? 'success' : 'error'}
                              title={retakingResult.is_correct ? '回答正确' : '回答错误'}
                              subTitle={
                                <div style={{ marginTop: 8, textAlign: 'left' }}>
                                  <div>你的答案：<span style={{ color: retakingResult.is_correct ? '#52c41a' : '#d4380d', fontWeight: 600 }}>{retakingResult.your_answer}</span></div>
                                  <div>正确答案：<span style={{ color: '#52c41a', fontWeight: 600 }}>{retakingResult.correct_answer}</span></div>
                                  <div style={{ marginTop: 12 }}>解析：<span style={{ color: '#666' }}>{retakingResult.explanation}</span></div>
                                </div>
                              }
                              style={{ margin: 0 }}
                            />
                          )}
                        </div>
                      )}
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
          open={false}
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
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontWeight: 800, fontSize: 20, color: '#1f3f75' }}>巩固练习 - {selectedKeyword}</span>
              <Button 
                type="text" 
                onClick={() => { setPracticeModal(false); setPracticeQuestions([]); setPracticeResult(null); setPracticeAnswers({}); }}
                style={{ color: '#1f3f75', fontSize: 16, fontWeight: 600 }}
              >
                返回
              </Button>
            </div>
          }
          width="100vw"
          style={{ top: 0, maxWidth: '100vw', paddingBottom: 0 }}
          styles={{
            content: { height: '100vh', borderRadius: 0, paddingBottom: 0, display: 'flex', flexDirection: 'column' },
            body: { padding: 0, background: '#f7fbff', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
            header: { borderRadius: 0, padding: '16px 24px' }
          }}
        >
          {/* 顶部生成区域 */}
          <div style={{
            margin: 20,
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid #d6e4ff',
            background: 'linear-gradient(90deg, #f8fbff 0%, #eef7ff 100%)',
            flexShrink: 0
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
              {practiceQuestions.length > 0 && (
                <Tag color="blue" style={{ borderRadius: 999 }}>共 {practiceQuestions.length} 题</Tag>
              )}
            </Space>
            
            {/* 生成进度条 */}
            {practiceLoading && (
              <div style={{ width: '100%', maxWidth: 400, marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#59708f', marginBottom: 4, textAlign: 'center' }}>生成进度：{practiceGenerateProgress}%</div>
                <Progress percent={practiceGenerateProgress} size="small" status={practiceGenerateProgress === 100 ? 'success' : 'active'} />
              </div>
            )}
          </div>

          {/* 中间题目区域 - 可滚动 */}
          <div style={{ flex: 1, overflowY: 'auto', paddingLeft: 20, paddingRight: 20, paddingTop: 0, paddingBottom: 20 }}>
            {practiceQuestions.length === 0 ? (
              <Empty description="暂无巩固练习题目" />
            ) : (
              <div>
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
                          style={{ marginBottom: 8, width: '100%' }}
                        >
                          <Space direction="vertical" style={{ width: '100%' }}>
                            {displayOptions && Object.entries(displayOptions).map(([k, v]) => (
                              <div
                                key={k}
                                onMouseEnter={() => setHoveredPracticeOption(`${idx}-${k}`)}
                                onMouseLeave={() => setHoveredPracticeOption(null)}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: 8,
                                  background: hoveredPracticeOption === `${idx}-${k}` ? '#e6f7ff' : 'transparent',
                                  border: hoveredPracticeOption === `${idx}-${k}` ? '1px solid #91d5ff' : '1px solid transparent',
                                  transition: 'all 0.3s ease',
                                  cursor: 'pointer',
                                  width: '100%'
                                }}
                              >
                                <Radio value={k} style={{ width: '100%' }}>{k}. {v}</Radio>
                              </div>
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
          </div>

          {/* 底部提交按钮区域 - 固定位置 */}
          <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid #e6eeff', background: '#f7fbff', flexShrink: 0 }}>
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
          </div>
        </Modal>
      </Card>
      </div>
    </AppLayout>
  );
}
