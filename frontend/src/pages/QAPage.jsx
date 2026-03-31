import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Input, List, message, Modal, Popconfirm, Progress, Space, Spin, Tag, Card, Tabs, Badge } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import http from '../api/http';
import getApiUrl from '../apiConfig';
import { BookOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactPlayer from 'react-player';
import PageHeader from '../components/PageHeader';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const { TextArea } = Input;

const QA_STAGE_CONFIG = [
  { label: '检索文档中', startMs: 0, progress: 20 },
  { label: '筛选章节中', startMs: 3000, progress: 45 },
  { label: '整合答案中', startMs: 9000, progress: 75 },
  { label: '生成最终回答中', startMs: 16000, progress: 90 },
];

const QA_STAGE_INDEX_MAP = QA_STAGE_CONFIG.reduce((acc, item, index) => {
  acc[item.label] = index;
  return acc;
}, {});

export default function QAPage() {
    // 调试：打印qaSources和answer变化
    useEffect(() => {
      // eslint-disable-next-line
      console.log('[QA调试] qaSources:', qaSources);
    }, [qaSources]);

    useEffect(() => {
      // eslint-disable-next-line
      console.log('[QA调试] answer:', answer);
    }, [answer]);

    useEffect(() => {
      // eslint-disable-next-line
      console.log('[QA调试] displaySources:', displaySources);
    }, [displaySources]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(() => localStorage.getItem('qa_answer') || '');
  const [qaSources, setQaSources] = useState(() => {
    const s = localStorage.getItem('qa_sources');
    try { return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [qaLoading, setQaLoading] = useState(false);
  const [qaStageIndex, setQaStageIndex] = useState(0);
  const [qaStageDots, setQaStageDots] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerType, setViewerType] = useState(null);
  const [viewerFileName, setViewerFileName] = useState('');
  const [viewerBlobUrl, setViewerBlobUrl] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [mediaStartSec, setMediaStartSec] = useState(null);
  const [mediaEndSec, setMediaEndSec] = useState(null);
  const [mediaContentType, setMediaContentType] = useState('');
  const [isMediaPlaying, setIsMediaPlaying] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const mediaPlayerRef = useRef(null);
  const qaStageTimerRef = useRef(null);

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

  const handleDeleteHistory = async (historyItem) => {
    try {
      await http.delete(`/qa-history/${historyItem.id}`);
      message.success('历史记录已删除');

      const currentAnswer = localStorage.getItem('qa_answer') || '';
      if (currentAnswer && currentAnswer === (historyItem.answer || '')) {
        setQuestion('');
        setAnswer('');
        setQaSources([]);
        localStorage.removeItem('qa_answer');
        localStorage.removeItem('qa_sources');
      }

      fetchQaHistory();
    } catch (err) {
      console.error('[QA历史] 删除失败:', err);
      message.error('删除历史记录失败');
    }
  };

  useEffect(() => { fetchQaHistory(); }, []);

  useEffect(() => {
    if (!qaLoading) {
      if (qaStageTimerRef.current) {
        window.clearInterval(qaStageTimerRef.current);
        qaStageTimerRef.current = null;
      }
      return;
    }

    qaStageTimerRef.current = window.setInterval(() => {
      setQaStageDots((prev) => '.'.repeat((prev.length + 1) % 4));
    }, 450);

    return () => {
      if (qaStageTimerRef.current) {
        window.clearInterval(qaStageTimerRef.current);
        qaStageTimerRef.current = null;
      }
    };
  }, [qaLoading]);

  const parseCitationInner = (inner) => {
    const text = String(inner || '').trim();
    if (!text) return null;

    const normalizeCitationPayload = (raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null;
      const docName = String(
        raw.docName
        ?? raw.doc_name
        ?? raw.source
        ?? raw.file_name
        ?? metadata?.source
        ?? ''
      ).trim();

      const pageRaw = raw.page ?? metadata?.page;
      const page = Number.isFinite(Number(pageRaw)) ? Number(pageRaw) : null;

      const startRaw = raw.start ?? raw.start_time ?? metadata?.start_time;
      const endRaw = raw.end ?? raw.end_time ?? metadata?.end_time;
      const startText = typeof startRaw === 'number' ? parseSecondsToTimeText(startRaw) : (startRaw ? String(startRaw) : null);
      const endText = typeof endRaw === 'number' ? parseSecondsToTimeText(endRaw) : (endRaw ? String(endRaw) : null);

      if (!docName) return null;

      const type = raw.type
        || (docName.toLowerCase().endsWith('.pdf') ? 'pdf' : null)
        || ((startText || endText) ? 'media' : null)
        || 'pdf';

      if (type === 'media') {
        return {
          type: 'media',
          docName,
          start: startText,
          end: endText,
        };
      }

      return {
        type: 'pdf',
        docName,
        page: page && page > 0 ? page : 1,
      };
    };

    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const payload = normalizeCitationPayload(item);
            if (payload) return payload;
          }
        } else {
          const payload = normalizeCitationPayload(parsed);
          if (payload) return payload;
        }
      } catch {
      }
    }

    const mediaMatch = text.match(/^(.*)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (mediaMatch) {
      return {
        type: 'media',
        docName: mediaMatch[1].trim(),
        start: mediaMatch[2],
        end: mediaMatch[3],
      };
    }

    const pageMatch = text.match(/^(.*)\s+p\s*(\d+)$/i);
    if (pageMatch) {
      return {
        type: 'pdf',
        docName: pageMatch[1].trim(),
        page: Number(pageMatch[2]),
      };
    }

    const pageRangeWithPrefixMatch = text.match(/^(.*)\s+p\s*(\d+)\s*-\s*p?\s*(\d+)$/i);
    if (pageRangeWithPrefixMatch) {
      return {
        type: 'pdf',
        docName: pageRangeWithPrefixMatch[1].trim(),
        page: Number(pageRangeWithPrefixMatch[2]),
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
    const formatCitationLabel = (payload, fallbackLabel) => {
      if (!payload?.docName) return fallbackLabel;
      if (payload.type === 'media') {
        const startText = payload.start || '00:00';
        const endText = payload.end || startText;
        return `${payload.docName} ${startText}-${endText}`;
      }
      if (payload.type === 'pdf') {
        return `${payload.docName} p${payload.page || 1}`;
      }
      return fallbackLabel;
    };

    return String(text).replace(/\[([^\]]+)\](?!\()/g, (full, inner) => {
      const payload = parseCitationInner(inner);
      if (!payload || !payload.docName) return full;
      const encoded = encodeURIComponent(JSON.stringify(payload));
      const label = formatCitationLabel(payload, inner);
      return `[${label}](cite:${encoded})`;
    });
  };

  const normalizeDocName = (name) => String(name || '').trim().toLowerCase();

  const stripFileExtension = (name) => String(name || '').replace(/\.[^./\\]+$/, '');

  // 支持 doc_id -> 文件名映射，优先返回真实文件名
  const resolveCitationFileName = (citationDocName) => {
    // 调试：打印引用解析过程
    if (citationDocName) {
      console.log('[QA调试] resolveCitationFileName 输入:', citationDocName, 'qaSources:', qaSources);
    }
    if (!citationDocName) return '';
    // 1. 先查 doc_id -> 文件名
    const docId = citationDocName.trim();
    // qaSources 结构: [{metadata: {doc_id, source, ...}, ...}]
    let matched = null;
    if (qaSources && qaSources.length > 0) {
      for (const item of qaSources) {
        if (item && item.metadata) {
          // 支持 doc_id、name、source 匹配
          if (
            (item.metadata.doc_id && String(item.metadata.doc_id).toLowerCase() === docId.toLowerCase()) ||
            (item.metadata.name && String(item.metadata.name).toLowerCase() === docId.toLowerCase())
          ) {
            matched = item.metadata.source || item.metadata.name || item.metadata.doc_id;
            break;
          }
        }
      }
    }
    if (matched) {
      console.log('[QA调试] resolveCitationFileName 命中:', matched);
      return matched;
    }
    // 2. fallback: 旧逻辑
    const candidateNames = Array.from(
      new Set(
        (qaSources || [])
          .map(item => (item && typeof item === 'object' ? item?.metadata?.source : null))
          .filter(Boolean)
      )
    );
    const target = normalizeDocName(citationDocName);
    if (!target) {
      console.log('[QA调试] resolveCitationFileName fallback, target为空:', citationDocName);
      return citationDocName;
    }
    const exact = candidateNames.find(name => normalizeDocName(name) === target);
    if (exact) {
      console.log('[QA调试] resolveCitationFileName exact命中:', exact);
      return exact;
    }
    const targetNoExt = normalizeDocName(stripFileExtension(citationDocName));
    const byBaseName = candidateNames.find(name => normalizeDocName(stripFileExtension(name)) === targetNoExt);
    if (byBaseName) {
      console.log('[QA调试] resolveCitationFileName byBaseName命中:', byBaseName);
      return byBaseName;
    }
    console.log('[QA调试] resolveCitationFileName 未命中，返回原始:', citationDocName);
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

  const parseSecondsToTimeText = (seconds) => {
    if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return null;
    const totalSeconds = Math.max(0, Math.floor(Number(seconds)));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainSeconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(remainSeconds).padStart(2, '0')}`;
  };

  const flattenNodeText = (node) => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(flattenNodeText).join('');
    if (node && node.props && node.props.children !== undefined) return flattenNodeText(node.props.children);
    return '';
  };

  const parseCitationFromHref = (href) => {
    const rawHref = String(href || '').trim();
    if (!rawHref) return null;

    if (rawHref.startsWith('cite:')) {
      try {
        return JSON.parse(decodeURIComponent(rawHref.slice(5)));
      } catch {
        return null;
      }
    }

    try {
      const url = new URL(rawHref, window.location.origin);
      const path = decodeURIComponent(url.pathname || '');
      const isDownloadPath = path.includes('/download/');
      const isViewPdfPath = path.includes('/view-pdf/');

      if (!isDownloadPath && !isViewPdfPath) {
        return null;
      }

      const fileName = path.split('/').filter(Boolean).pop();
      if (!fileName) return null;

      const pageFromQuery = Number(url.searchParams.get('page'));
      const pageMatch = (url.hash || '').match(/page=(\d+)/i);
      const pageFromHash = pageMatch ? Number(pageMatch[1]) : NaN;

      const timeMatch = (url.hash || '').match(/t=(\d+)(?:,(\d+))?/i);
      const startSec = timeMatch ? Number(timeMatch[1]) : null;
      const endSec = timeMatch && timeMatch[2] ? Number(timeMatch[2]) : null;

      if (fileName.toLowerCase().endsWith('.pdf') || isViewPdfPath) {
        return {
          type: 'pdf',
          docName: fileName,
          page: Number.isFinite(pageFromQuery) && pageFromQuery > 0
            ? pageFromQuery
            : (Number.isFinite(pageFromHash) && pageFromHash > 0 ? pageFromHash : 1),
        };
      }

      if (isDownloadPath) {
        return {
          type: 'media',
          docName: fileName,
          start: parseSecondsToTimeText(startSec),
          end: parseSecondsToTimeText(endSec),
        };
      }
    } catch {
      return null;
    }

    return null;
  };

  const tryFetchMediaBlob = async (name) => {
    const response = await http.get(`/download/${encodeURIComponent(name)}`, {
      responseType: 'blob'
    });
    const contentType = response.headers?.['content-type'] || response.data?.type || '';
    const isMediaType = String(contentType).startsWith('audio/') || String(contentType).startsWith('video/');
    return {
      fileName: name,
      blob: response.data,
      contentType,
      isMediaType,
    };
  };

  const resolveMediaBlobForPlayback = async (rawFileName) => {
    const fileName = String(rawFileName || '').trim();
    if (!fileName) throw new Error('媒体文件名为空');

    if (!fileName.toLowerCase().endsWith('.json')) {
      const direct = await tryFetchMediaBlob(fileName);
      return { ...direct, fallbackFromJson: false };
    }

    const jsonBase = fileName.replace(/\.json$/i, '');
    const rootBase = jsonBase.replace(/_\d{8}_\d{6}$/i, '');
    const mediaExts = ['mp4', 'webm', 'mov', 'mkv', 'mp3', 'wav', 'm4a', 'ogg'];
    const candidates = Array.from(new Set(mediaExts.flatMap(ext => [`${jsonBase}.${ext}`, `${rootBase}.${ext}`])));

    for (const candidate of candidates) {
      try {
        const res = await tryFetchMediaBlob(candidate);
        if (res.isMediaType) {
          return { ...res, fallbackFromJson: true, sourceJsonName: fileName };
        }
      } catch {
      }
    }

    const fallback = await tryFetchMediaBlob(fileName);
    return { ...fallback, fallbackFromJson: true, sourceJsonName: fileName };
  };

  const inferMediaMimeType = (fileName, contentType) => {
    const normalized = String(contentType || '').toLowerCase();
    if (normalized.startsWith('video/') || normalized.startsWith('audio/')) return normalized;
    const lower = String(fileName || '').toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.mkv')) return 'video/x-matroska';
    if (lower.endsWith('.avi')) return 'video/x-msvideo';
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.m4a')) return 'audio/mp4';
    if (lower.endsWith('.ogg')) return 'audio/ogg';
    return 'application/octet-stream';
  };

  const seekMediaToSeconds = (seconds) => {
    if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return;
    const target = Number(seconds);
    const player = mediaPlayerRef.current;
    if (!player) return;

    if (typeof player.seekTo === 'function') {
      player.seekTo(target, 'seconds');
      return;
    }

    if (typeof player.getInternalPlayer === 'function') {
      const internal = player.getInternalPlayer();
      if (internal && typeof internal.currentTime === 'number') {
        internal.currentTime = target;
        return;
      }
    }

    if (typeof player.currentTime === 'number') {
      player.currentTime = target;
    }
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

  const getLiveSourcesFromAnswer = (text) => {
    const raw = String(text || '');
    if (!raw) return [];
    const regex = /\[([^\]]+)\]/g;
    const seen = new Set();
    const ordered = [];
    let match;

    while ((match = regex.exec(raw)) !== null) {
      const payload = parseCitationInner(match[1]);
      if (!payload?.docName) continue;
      const key = normalizeDocName(payload.docName);
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push({ fileName: payload.docName });
    }

    return ordered;
  };

  const displaySources = useMemo(() => {
    const grouped = groupSourcesByFile(qaSources);
    if (grouped.length > 0) return grouped;
    return getLiveSourcesFromAnswer(answer);
  }, [qaSources, answer]);

  const getCitationRefIndex = (payload) => {
    // 调试：打印引用索引解析
    console.log('[QA调试] getCitationRefIndex payload:', payload);
    if (!payload?.docName) return null;
    const resolvedName = resolveCitationFileName(payload.docName);
    const target = normalizeDocName(resolvedName);
    const targetNoExt = normalizeDocName(stripFileExtension(resolvedName));

    const index = displaySources.findIndex((item) => {
      const fileName = String(item?.fileName || '');
      const normalized = normalizeDocName(fileName);
      const normalizedNoExt = normalizeDocName(stripFileExtension(fileName));
      return normalized === target || normalizedNoExt === targetNoExt;
    });

    if (index >= 0) {
      console.log('[QA调试] getCitationRefIndex 命中:', index + 1, 'payload:', payload);
      return index + 1;
    } else {
      console.log('[QA调试] getCitationRefIndex 未命中:', payload);
      return null;
    }
  };

  const closeViewer = () => {
    if (viewerBlobUrl) {
      window.URL.revokeObjectURL(viewerBlobUrl);
    }
    setViewerOpen(false);
    setViewerType(null);
    setViewerFileName('');
    setViewerBlobUrl('');
    setPdfTotalPages(0);
    setPdfPage(1);
    setMediaStartSec(null);
    setMediaEndSec(null);
    setMediaContentType('');
    setIsMediaPlaying(false);
    setMediaReady(false);
  };

  const handleViewPdf = async (fileName, pageNumber) => {
    try {
      if (!fileName.toLowerCase().endsWith('.pdf')) {
        message.error('仅支持PDF文件在浏览器中预览');
        return;
      }

      message.loading({ content: '正在加载PDF...', duration: 0 });
      setViewerLoading(true);
      
      // 使用axios获取PDF，这样会自动携带Authorization header
      try {
        const response = await http.get(`/view-pdf/${encodeURIComponent(fileName)}`, {
          responseType: 'blob'
        });
        
        message.destroy();
        
        // 创建临时blob URL
        const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(pdfBlob);

        if (viewerBlobUrl) {
          window.URL.revokeObjectURL(viewerBlobUrl);
        }

        setViewerType('pdf');
        setViewerFileName(fileName);
        setViewerBlobUrl(blobUrl);
        setPdfPage(Number(pageNumber) > 0 ? Number(pageNumber) : 1);
        setViewerOpen(true);
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
    } finally {
      setViewerLoading(false);
    }
  };

  const handleOpenMediaWithTime = async (fileName, startText, endText) => {
    try {
      message.loading({ content: '正在加载媒体文件...', duration: 0 });
      setViewerLoading(true);
      const mediaData = await resolveMediaBlobForPlayback(fileName);

      message.destroy();

      const resolvedType = inferMediaMimeType(mediaData.fileName || fileName, mediaData.contentType);
      const mediaBlob = mediaData.blob?.type
        ? mediaData.blob
        : new Blob([mediaData.blob], { type: resolvedType });
      const blobUrl = window.URL.createObjectURL(mediaBlob);
      const startSec = parseTimeToSeconds(startText);
      const endSec = parseTimeToSeconds(endText);

      if (viewerBlobUrl) {
        window.URL.revokeObjectURL(viewerBlobUrl);
      }

      setViewerType('media');
      setViewerFileName(mediaData.fileName || fileName);
      setViewerBlobUrl(blobUrl);
      setMediaStartSec(startSec);
      setMediaEndSec(endSec);
      setMediaContentType(mediaBlob.type || resolvedType);
      setMediaReady(false);
      setIsMediaPlaying(false);
      setViewerOpen(true);

      if (mediaData.fallbackFromJson && mediaData.fileName && mediaData.fileName !== fileName) {
        message.info(`已从引用 ${fileName} 自动匹配媒体文件 ${mediaData.fileName}`);
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
    } finally {
      setViewerLoading(false);
    }
  };

  const handleCitationClick = async (payload) => {
    console.log('[QA调试] handleCitationClick payload:', payload);
    if (!payload?.docName) {
      console.log('[QA调试] handleCitationClick 无docName:', payload);
      return;
    }
    const fileName = resolveCitationFileName(payload.docName);
    console.log('[QA调试] handleCitationClick 解析到 fileName:', fileName);

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
    setQaStageIndex(0);
    setQaStageDots('');
    setAnswer('');
    setQaSources([]);
    setQaLoading(true);
    try {
      const formData = new FormData();
      formData.append('question', question);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiUrl()}/qa-stream`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error(`流式问答请求失败: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finalAnswer = '';
      let finalSources = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let evt;
          try {
            evt = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (evt.type === 'stage') {
            const idx = QA_STAGE_INDEX_MAP[evt.stage];
            if (typeof idx === 'number') {
              setQaStageIndex(idx);
            }
            continue;
          }

          if (evt.type === 'token') {
            const chunk = String(evt.content || '');
            if (!chunk) continue;
            finalAnswer += chunk;
            setAnswer((prev) => prev + chunk);
            continue;
          }

          if (evt.type === 'done') {
            finalAnswer = String(evt.answer || finalAnswer || '');
            finalSources = Array.isArray(evt.sources) ? evt.sources : [];
            setAnswer(finalAnswer);
            setQaSources(finalSources);
            localStorage.setItem('qa_answer', finalAnswer);
            localStorage.setItem('qa_sources', JSON.stringify(finalSources));
            continue;
          }

          if (evt.type === 'error') {
            throw new Error(String(evt.message || '问答失败'));
          }
        }
      }

      if (!finalAnswer) {
        message.warning('问答返回为空，请重试');
        return;
      }

      try {
        const sourceStr = JSON.stringify(finalSources || []);
        await http.post('/qa-history', new URLSearchParams({ question, answer: finalAnswer, sources: sourceStr }));
        fetchQaHistory();
      } catch (historyErr) {
        console.error('[QA] 保存历史失败:', historyErr);
      }
    } catch (err) {
      console.error('[QA] 问答失败:', err);
      message.error('问答失败');
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <AppLayout>
      <style>{`
        .qa-stage-banner {
          position: relative;
          overflow: hidden;
          border: 1px solid #d6eaff;
          background: #f5faff;
          border-radius: 8px;
          padding: 12px;
        }
        .qa-stage-shimmer {
          position: absolute;
          top: 0;
          left: -42%;
          width: 42%;
          height: 100%;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.62) 50%, rgba(255,255,255,0) 100%);
          animation: qaShimmerMove 1.6s linear infinite;
          pointer-events: none;
        }
        @keyframes qaShimmerMove {
          0% { left: -42%; }
          100% { left: 100%; }
        }
      `}</style>
      <div className="page-content-wrap page-enter">
      <PageHeader
        title="知识库问答"
        subtitle="输入问题后系统将分阶段检索并生成可追溯回答"
        icon={<BookOutlined />}
        variant="dashboard"
      />
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card className="fade-in-up" style={{ borderRadius: 14 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <TextArea rows={4} value={question} onChange={e => setQuestion(e.target.value)} placeholder="请输入你的问题..." />
            <Button type="primary" onClick={handleAsk} loading={qaLoading}>问答</Button>
          </Space>
        </Card>
        {qaLoading ? (
          <div className="qa-stage-banner">
            <div className="qa-stage-shimmer" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative', zIndex: 1 }}>
              <span style={{ color: '#1677ff', fontWeight: 500 }}>
                {QA_STAGE_CONFIG[qaStageIndex].label}{qaStageDots}
              </span>
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <Progress percent={QA_STAGE_CONFIG[qaStageIndex].progress} status="active" showInfo={false} />
            </div>
          </div>
        ) : null}
        {answer ? (
          <Card title="回答内容" style={{ borderRadius: 14 }}>
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
              components={{
                  table: ({ children }) => (
                    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th style={{ border: '1px solid #d9d9d9', background: '#fafafa', padding: '8px 10px', textAlign: 'left' }}>
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td style={{ border: '1px solid #f0f0f0', padding: '8px 10px', verticalAlign: 'top' }}>
                      {children}
                    </td>
                  ),
                  a: ({ href, children }) => {
                    const payloadFromHref = parseCitationFromHref(href);
                    const payloadFromText = parseCitationInner(flattenNodeText(children));
                    const payload = payloadFromHref || payloadFromText;

                    if (payload?.docName) {
                      const refIndex = getCitationRefIndex(payload);
                      return (
                        <Button
                          type="link"
                          size="small"
                          style={{
                            paddingInline: 6,
                            paddingBlock: 0,
                            minWidth: 20,
                            height: 18,
                            lineHeight: '16px',
                            verticalAlign: 'super',
                            borderRadius: 10,
                            background: '#e6f4ff',
                            color: '#1677ff'
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            handleCitationClick(payload);
                          }}
                        >
                          {refIndex ?? '?'}
                        </Button>
                      );
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
          </Card>
        ) : null}
        <Card style={{ borderRadius: 14 }}>
          <Tabs
            items={[
              {
                key: 'sources',
                label: <span>参考出处 <Badge count={displaySources.length} color="#1677ff" /></span>,
                children: (
                  <List
                    dataSource={displaySources}
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
                )
              },
              {
                key: 'history',
                label: <span>问答历史 <Badge count={qaHistory.length} color="#52c41a" /></span>,
                children: (
                  <List
                    dataSource={qaHistory}
                    renderItem={(h) => (
                      <List.Item
                        onClick={() => handleHistoryClick(h)}
                        style={{ cursor: 'pointer' }}
                        actions={[
                          <Popconfirm
                            key={`delete-${h.id}`}
                            title="确定删除这条问答历史吗？"
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              handleDeleteHistory(h);
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                            okText="删除"
                            cancelText="取消"
                          >
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              size="small"
                              onClick={(e) => e.stopPropagation()}
                            >
                              删除
                            </Button>
                          </Popconfirm>
                        ]}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{h.question}</div>
                          <div style={{ color: '#888' }}>{h.answer?.slice(0, 100)}...</div>
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

      <Modal
        title={viewerType === 'pdf' ? `PDF预览 - ${viewerFileName}` : `媒体预览 - ${viewerFileName}`}
        open={viewerOpen}
        onCancel={closeViewer}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <Spin spinning={viewerLoading}>
          {viewerType === 'pdf' && viewerBlobUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Space>
                <Button onClick={() => setPdfPage(prev => Math.max(prev - 1, 1))} disabled={pdfPage <= 1}>上一页</Button>
                <span>第 {pdfPage} / {pdfTotalPages || '-'} 页</span>
                <Button onClick={() => setPdfPage(prev => Math.min(prev + 1, pdfTotalPages || 1))} disabled={pdfTotalPages ? pdfPage >= pdfTotalPages : true}>下一页</Button>
              </Space>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 8, maxHeight: '70vh', overflow: 'auto' }}>
                <Document
                  file={viewerBlobUrl}
                  loading="正在解析PDF..."
                  onLoadSuccess={({ numPages }) => {
                    setPdfTotalPages(numPages);
                    setPdfPage(prev => Math.min(Math.max(prev, 1), numPages));
                  }}
                >
                  <Page pageNumber={pdfPage} width={920} />
                </Document>
              </div>
            </div>
          ) : null}

          {viewerType === 'media' && viewerBlobUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(mediaStartSec !== null || mediaEndSec !== null) ? (
                <div style={{ color: '#666' }}>
                  播放区间：
                  {mediaStartSec !== null ? parseSecondsToTimeText(mediaStartSec) : '起点'}
                  {' - '}
                  {mediaEndSec !== null ? parseSecondsToTimeText(mediaEndSec) : '结尾'}
                </div>
              ) : null}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
                <ReactPlayer
                  key={`media-${viewerBlobUrl}`}
                  ref={mediaPlayerRef}
                  src={viewerBlobUrl}
                  controls
                  width="100%"
                  height="70vh"
                  playing={mediaReady && isMediaPlaying}
                  config={{
                    file: {
                      forceVideo: String(mediaContentType).startsWith('video/'),
                      forceAudio: String(mediaContentType).startsWith('audio/'),
                      attributes: { preload: 'metadata', playsInline: true }
                    }
                  }}
                  onReady={() => {
                    setMediaReady(true);
                    if (mediaStartSec !== null) {
                      seekMediaToSeconds(mediaStartSec);
                    }
                    setTimeout(() => {
                      setIsMediaPlaying(true);
                    }, 80);
                  }}
                  onError={(error) => {
                    console.error('[媒体预览] 播放失败:', error, { viewerFileName, mediaContentType });
                    message.error(`媒体无法播放：${viewerFileName}`);
                  }}
                  onProgress={({ playedSeconds }) => {
                    if (isMediaPlaying && mediaEndSec !== null && playedSeconds >= mediaEndSec) {
                      setIsMediaPlaying(false);
                    }
                  }}
                />
              </div>
            </div>
          ) : null}
        </Spin>
      </Modal>
    </AppLayout>
  );
}


