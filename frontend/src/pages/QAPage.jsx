import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Input, List, message, Space, Spin, Tag } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ask as askService } from '../services/knowledgeService';
import http from '../api/http';
import { DownloadOutlined } from '@ant-design/icons';
const { TextArea } = Input;

export default function QAPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(() => localStorage.getItem('qa_answer') || '');
  const [qaSources, setQaSources] = useState(() => {
    const s = localStorage.getItem('qa_sources');
    try { return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [qaLoading, setQaLoading] = useState(false);
  const [qaHistory, setQaHistory] = useState([]);

  const fetchQaHistory = async () => {
    try {
      const res = await http.get('/qa-history');
      setQaHistory(res.data);
    } catch {}
  };

  const handleHistoryClick = (h) => {
    // 直接使用历史记录中的数据，不需要额外调用接口
    setQuestion(h.question);
    setAnswer(h.answer);
    setQaSources(h.sources || []);
    localStorage.setItem('qa_answer', h.answer);
    localStorage.setItem('qa_sources', JSON.stringify(h.sources || []));
  };

  useEffect(() => { fetchQaHistory(); }, []);

  // 时间戳格式转换函数
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return null;
    const sec = Math.round(seconds);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  };

  const formatSource = (source, index) => {
    if (typeof source === 'string') {
      return { title: source, preview: '', timeInfo: null };
    }

    if (source && typeof source === 'object') {
      const metadata = source.metadata || {};
      const sourceName = metadata.source || '未知来源';
      const page = metadata.page ?? '?';
      const preview = source.content ? String(source.content).slice(0, 120) : '';
      
      // 检测是否为音视频文件
      const mediaExtensions = ['.mp3', '.mp4', '.wav', '.m4a', '.flac', '.mov', '.avi', '.mkv', '.webm', '.ogg'];
      const isMedia = mediaExtensions.some(ext => sourceName.toLowerCase().endsWith(ext));
      
      // 获取时间戳数据
      const startTime = metadata.start_time;
      const endTime = metadata.end_time;
      
      // 调试信息
      console.log(`[QA来源${index+1}] 源=${sourceName}, 是否音视频=${isMedia}, startTime=${startTime}, endTime=${endTime}`);
      
      // 生成时间信息
      let timeInfo = null;
      if (startTime !== null || endTime !== null) {
        const start = startTime !== null ? formatTime(startTime) : '?';
        const end = endTime !== null ? formatTime(endTime) : '?';
        timeInfo = { start, end, isMedia: true };
      }
      
      return {
        title: isMedia ? sourceName : `${sourceName} 第${page}页`,
        preview,
        timeInfo,
      };
    }

    return { title: `参考片段 ${index + 1}`, preview: '', timeInfo: null };
  };

  const handleAsk = async () => {
    if (!question) { message.warning('请输入问题'); return; }
    setQaLoading(true);
    try {
      const formData = new FormData();
      formData.append('question', question);
      const res = await askService(formData);
      setAnswer(res.answer);
      setQaSources(res.sources || []);
      localStorage.setItem('qa_answer', res.answer);
      localStorage.setItem('qa_sources', JSON.stringify(res.sources || []));
      // 保存历史记录时同时传递sources
      const sourceStr = JSON.stringify(res.sources || []);
      await http.post('/qa-history', new URLSearchParams({ question, answer: res.answer, sources: sourceStr }));
      fetchQaHistory();
    } catch (err) {
      message.error('问答失败');
    }
    setQaLoading(false);
  };

  return (
    <AppLayout>
      <h2 style={{ fontWeight: 700, marginTop: 0 }}>知识库问答</h2>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <TextArea rows={4} value={question} onChange={e => setQuestion(e.target.value)} placeholder="请输入你的问题..." />
        <Button type="primary" onClick={handleAsk} loading={qaLoading}>问答</Button>
        <Spin spinning={qaLoading}>
          {answer ? (
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{answer}</ReactMarkdown>
            </div>
          ) : null}
        </Spin>
        <div>
          <h4>参考出处：</h4>
          <List
            size="small"
            dataSource={qaSources}
            renderItem={(s, i) => {
              const formatted = formatSource(s, i);
              return (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <div>
                      <Tag color="blue">{i + 1}</Tag>
                      <span>{formatted.title}</span>
                      <Button
                        type="text"
                        icon={<DownloadOutlined />}
                        size="small"
                        style={{ marginLeft: 8 }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            // 从标题中提取文件名（移除"第x页"部分）
                            const fileName = formatted.title.split(' 第')[0];
                            const token = localStorage.getItem('token');
                            const response = await fetch(`/download/${encodeURIComponent(fileName)}?from_qa=true`, {
                              headers: {
                                'Authorization': `Bearer ${token}`
                              }
                            });

                            if (response.ok) {
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);
                              message.success('文件下载成功');
                            } else {
                              message.error('文件下载失败');
                            }
                          } catch (error) {
                            console.error('下载错误:', error);
                            message.error('文件下载失败');
                          }
                        }}
                      >
                        下载
                      </Button>
                    </div>
                    {formatted.preview ? (
                      <div style={{ color: '#666', fontSize: 12 }}>{formatted.preview}...</div>
                    ) : null}
                    {formatted.timeInfo && (
                      <div style={{ 
                        color: '#ff7a45', 
                        fontSize: 12, 
                        fontWeight: 500,
                        padding: '4px 8px',
                        backgroundColor: '#fff7e6',
                        borderRadius: 4,
                        marginTop: 4,
                        display: 'inline-block'
                      }}>
                        🎬 时间戳: {formatted.timeInfo.start} ~ {formatted.timeInfo.end}
                      </div>
                    )}
                  </Space>
                </List.Item>
              );
            }}
          />
        </div>
        <div>
          <h3>问答历史</h3>
          <List
            dataSource={qaHistory}
            renderItem={(h) => (
              <List.Item onClick={() => handleHistoryClick(h)} style={{ cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{h.question}</div>
                  <div style={{ color: '#888' }}>{h.answer?.slice(0, 100)}...</div>
                </div>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </AppLayout>
  );
}


