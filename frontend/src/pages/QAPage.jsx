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

  const parseCitationInner = (inner) => {
    const text = String(inner || '').trim();
    if (!text) return null;

    const mediaMatch = text.match(/^(.*)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (mediaMatch) {
      return {
        type: 'media',
        docName: mediaMatch[1].trim(),
        start: mediaMatch[2],
        end: mediaMatch[3],
      };
    }

    const pageMatch = text.match(/^(.*)\s+p(\d+)$/i);
    if (pageMatch) {
      return {
        type: 'pdf',
        docName: pageMatch[1].trim(),
        page: Number(pageMatch[2]),
      };
    }

    const pageRangeMatch = text.match(/^(.*)\s+(\d+)\s*-\s*(\d+)$/);
    if (pageRangeMatch) {
      return {
        type: 'pdf',
        docName: pageRangeMatch[1].trim(),
        page: Number(pageRangeMatch[2]),
      };
    }

    return null;
  };

  const convertAnswerCitationsToMarkdownLinks = (text) => {
    if (!text) return '';
    return String(text).replace(/\[([^\]]+)\](?!\()/g, (full, inner) => {
      const payload = parseCitationInner(inner);
      if (!payload || !payload.docName) return full;
      const encoded = encodeURIComponent(JSON.stringify(payload));
      return `[${inner}](cite:${encoded})`;
    });
  };

  const normalizeDocName = (name) => String(name || '').trim().toLowerCase();

  const stripFileExtension = (name) => String(name || '').replace(/\.[^./\\]+$/, '');

  const resolveCitationFileName = (citationDocName) => {
    const candidateNames = Array.from(
      new Set(
        (qaSources || [])
          .map(item => (item && typeof item === 'object' ? item?.metadata?.source : null))
          .filter(Boolean)
      )
    );

    const target = normalizeDocName(citationDocName);
    if (!target) return citationDocName;

    const exact = candidateNames.find(name => normalizeDocName(name) === target);
    if (exact) return exact;

    const targetNoExt = normalizeDocName(stripFileExtension(citationDocName));
    const byBaseName = candidateNames.find(name => normalizeDocName(stripFileExtension(name)) === targetNoExt);
    if (byBaseName) return byBaseName;

    return citationDocName;
  };

  const parseTimeToSeconds = (timeText) => {
    const parts = String(timeText || '').trim().split(':').map(Number);
    if (parts.some(Number.isNaN) || parts.length < 2 || parts.length > 3) return null;
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return minutes * 60 + seconds;
    }
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  };

  // 将source按文件名去重分组，仅用于展示文件名
  const groupSourcesByFile = (sources) => {
    const grouped = {};
    sources.forEach(source => {
      if (typeof source === 'string') {
        if (!grouped[source]) {
          grouped[source] = { fileName: source };
        }
      } else if (source && typeof source === 'object') {
        const metadata = source.metadata || {};
        const fileName = metadata.source || '未知来源';
        if (!grouped[fileName]) {
          grouped[fileName] = { fileName };
        }
      }
    });
    return Object.values(grouped);
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

  const handleOpenMediaWithTime = async (fileName, startText, endText) => {
    try {
      message.loading({ content: '正在加载媒体文件...', duration: 0 });
      const response = await http.get(`/download/${encodeURIComponent(fileName)}`, {
        responseType: 'blob'
      });

      message.destroy();

      const mediaBlob = new Blob([response.data], { type: response.headers?.['content-type'] || 'application/octet-stream' });
      const blobUrl = window.URL.createObjectURL(mediaBlob);
      const startSec = parseTimeToSeconds(startText);
      const endSec = parseTimeToSeconds(endText);
      const timeFragment = startSec !== null
        ? `#t=${startSec}${endSec !== null ? `,${endSec}` : ''}`
        : '';

      const newWindow = window.open(`${blobUrl}${timeFragment}`, '_blank');
      if (newWindow) {
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
        }, 30000);
      }
    } catch (error) {
      message.destroy();
      console.error('[媒体预览] 获取文件错误:', error);
      if (error.response?.status === 403) {
        message.error('您没有权限查看此文件');
      } else if (error.response?.status === 404) {
        message.error('文件不存在或已被删除');
      } else if (error.response?.status === 401) {
        message.error('认证已过期，请重新登录');
      } else {
        message.error('加载媒体文件失败');
      }
    }
  };

  const handleCitationClick = async (payload) => {
    if (!payload?.docName) return;
    const fileName = resolveCitationFileName(payload.docName);

    if (payload.type === 'pdf') {
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        message.warning('该引用对应文件不是PDF，无法按页跳转');
        return;
      }
      await handleViewPdf(fileName, payload.page || 1);
      return;
    }

    if (payload.type === 'media') {
      await handleOpenMediaWithTime(fileName, payload.start, payload.end);
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
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  a: ({ href, children }) => {
                    if (typeof href === 'string' && href.startsWith('cite:')) {
                      try {
                        const payload = JSON.parse(decodeURIComponent(href.slice(5)));
                        return (
                          <Button
                            type="link"
                            size="small"
                            style={{ paddingInline: 4 }}
                            onClick={(e) => {
                              e.preventDefault();
                              handleCitationClick(payload);
                            }}
                          >
                            {children}
                          </Button>
                        );
                      } catch {
                        return <span>{children}</span>;
                      }
                    }

                    return (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    );
                  }
                }}
              >
                {convertAnswerCitationsToMarkdownLinks(answer)}
              </ReactMarkdown>
            </div>
          ) : null}
        </Spin>
        <div>
          <h4>参考出处：</h4>
          <List
            size="small"
            dataSource={groupSourcesByFile(qaSources)}
            renderItem={(group, groupIndex) => (
              <List.Item>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="blue">{groupIndex + 1}</Tag>
                    <span style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={group.fileName}>
                      {group.fileName}
                    </span>
                  </div>
                  <Button
                    type="text"
                    icon={<DownloadOutlined />}
                    size="small"
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
              </List.Item>
            )}
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


