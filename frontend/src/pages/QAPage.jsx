import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Input, List, message, Space, Spin, Tag } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ask as askService } from '../services/knowledgeService';
import http from '../api/http';
import { BookOutlined, DownloadOutlined } from '@ant-design/icons';
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

  // 将source按文件名分组
  const groupSourcesByFile = (sources) => {
    const grouped = {};
    sources.forEach(source => {
      if (typeof source === 'string') {
        if (!grouped[source]) {
          grouped[source] = { fileName: source, details: [] };
        }
      } else if (source && typeof source === 'object') {
        const metadata = source.metadata || {};
        const fileName = metadata.source || '未知来源';
        if (!grouped[fileName]) {
          grouped[fileName] = { fileName, details: [], fileType: 'document' };
        }
        
        // 检测是否为音视频文件
        const mediaExtensions = ['.mp3', '.mp4', '.wav', '.m4a', '.flac', '.mov', '.avi', '.mkv', '.webm', '.ogg', '.flv', '.wmv', '.aac', '.ogg'];
        const isMedia = mediaExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
        
        grouped[fileName].fileType = isMedia ? 'media' : 'document';
        grouped[fileName].details.push({
          content: source.content ? String(source.content).slice(0, 120) : '',
          page: metadata.page ?? '?',
          startTime: metadata.start_time,
          endTime: metadata.end_time,
        });
      }
    });
    return Object.values(grouped);
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
      const mediaExtensions = ['.mp3', '.mp4', '.wav', '.m4a', '.flac', '.mov', '.avi', '.mkv', '.webm', '.ogg', '.flv', '.wmv', '.aac', '.ogg'];
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

  const handleViewPdf = async (fileName, pageNumber) => {
    try {
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        message.error('仅支持PDF文件在浏览器中预览');
        return;
      }

      message.loading({ content: '正在加载PDF...', duration: 0 });
      
      // 使用axios获取PDF，这样会自动携带Authorization header
      try {
        const response = await http.get(`/view-pdf/${encodeURIComponent(fileName)}`, {
          responseType: 'blob'
        });
        
        message.destroy();
        
        // 创建临时blob URL
        const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(pdfBlob);
        
        // 在新标签页打开PDF，使用#page参数定位到指定页码
        const urlWithPage = `${blobUrl}#page=${pageNumber}`;
        const newWindow = window.open(urlWithPage, '_blank');
        
        // 在新窗口加载完成后，保留blob URL（浏览器需要持续访问它）
        // 不要立即撤销，而是在一段时间后撤销
        if (newWindow) {
          setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
          }, 30000); // 30秒后释放
        }
      } catch (error) {
        message.destroy();
        console.error('[PDF预览] 获取文件错误:', error);
        
        if (error.response?.status === 403) {
          message.error('您没有权限查看此文件');
        } else if (error.response?.status === 404) {
          message.error('文件不存在或已被删除');
        } else if (error.response?.status === 401) {
          message.error('认证已过期，请重新登录');
        } else {
          message.error('加载PDF文件失败');
        }
      }
    } catch (error) {
      console.error('[PDF预览] 处理错误:', error);
      message.error('打开PDF文件失败');
    }
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
      <h2 style={{ fontWeight: 700, fontSize: 22, marginTop: 0 }}>
        <BookOutlined style={{ color: '#1677ff', marginRight: 8 }} />
        知识库问答
      </h2>
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
            dataSource={groupSourcesByFile(qaSources)}
            renderItem={(group, groupIndex) => {
              // 对详情按照时间排序
              const sortedDetails = group.details.sort((a, b) => {
                const aStart = a.startTime || 0;
                const bStart = b.startTime || 0;
                return aStart - bStart;
              });

              return (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <div>
                      <Tag color="blue">{groupIndex + 1}</Tag>
                      <span>{group.fileType === 'media' ? group.fileName : `${group.fileName}`}</span>
                      <Button
                        type="text"
                        icon={<DownloadOutlined />}
                        size="small"
                        style={{ marginLeft: 8 }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const token = localStorage.getItem('token');
                            const response = await fetch(`/download/${encodeURIComponent(group.fileName)}?from_qa=true`, {
                              headers: {
                                'Authorization': `Bearer ${token}`
                              }
                            });

                            if (response.ok) {
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = group.fileName;
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
                    
                    {/* 音视频：显示时间戳段落 */}
                    {group.fileType === 'media' && (
                      <div>
                        {sortedDetails.map((detail, detailIndex) => (
                          <div key={detailIndex} style={{ 
                            marginBottom: 8,
                            paddingBottom: 8,
                            borderBottom: detailIndex < sortedDetails.length - 1 ? '1px solid #f0f0f0' : 'none'
                          }}>
                            <div style={{ 
                              color: '#ff7a45', 
                              fontSize: 12, 
                              fontWeight: 500,
                              padding: '4px 8px',
                              backgroundColor: '#fff7e6',
                              borderRadius: 4,
                              marginBottom: 4,
                              display: 'inline-block'
                            }}>
                              🎬 {detailIndex + 1}. 时间戳: {detail.startTime !== null ? formatTime(detail.startTime) : '?'} ~ {detail.endTime !== null ? formatTime(detail.endTime) : '?'}
                            </div>
                            {detail.content && (
                              <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                                "{detail.content}..."
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 文档：显示页码信息 */}
                    {group.fileType === 'document' && sortedDetails.map((detail, detailIndex) => (
                      <div key={detailIndex} style={{ 
                        marginBottom: 4,
                        paddingBottom: 4,
                        borderBottom: detailIndex < sortedDetails.length - 1 ? '1px solid #f0f0f0' : 'none'
                      }}>
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (group.fileName.toLowerCase().endsWith('.pdf') && detail.page !== '?') {
                              handleViewPdf(group.fileName, detail.page);
                            }
                          }}
                          style={{ 
                            color: group.fileName.toLowerCase().endsWith('.pdf') ? '#1677ff' : '#888', 
                            fontSize: 12, 
                            fontWeight: 500,
                            padding: '2px 6px',
                            backgroundColor: group.fileName.toLowerCase().endsWith('.pdf') ? '#e6f7ff' : '#f0f0f0',
                            borderRadius: 4,
                            marginBottom: 2,
                            display: 'inline-block',
                            cursor: group.fileName.toLowerCase().endsWith('.pdf') ? 'pointer' : 'default',
                            transition: 'all 0.3s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (group.fileName.toLowerCase().endsWith('.pdf') && detail.page !== '?') {
                              e.target.style.backgroundColor = '#bae7ff';
                              e.target.style.textDecoration = 'underline';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (group.fileName.toLowerCase().endsWith('.pdf')) {
                              e.target.style.backgroundColor = '#e6f7ff';
                              e.target.style.textDecoration = 'none';
                            }
                          }}
                          title={group.fileName.toLowerCase().endsWith('.pdf') && detail.page !== '?' ? '点击在浏览器中查看PDF' : ''}
                        >
                          📄 {detailIndex + 1}. 第 {detail.page} 页
                        </div>
                        {detail.content && (
                          <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                            "{detail.content}..."
                          </div>
                        )}
                      </div>
                    ))}
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


