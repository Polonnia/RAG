import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Upload, List, Tag, Spin, Space, Divider, Popconfirm, Switch, Typography, message, Modal, Progress } from 'antd';
const { Text } = Typography;
import { UploadOutlined, DeleteOutlined, EyeOutlined, DatabaseOutlined } from '@ant-design/icons';
import axios from 'axios';
import http from '../api/http';
import getApiUrl from '../apiConfig';
import AppLayout from '../components/layout/AppLayout';
import MindMapViewer from '../components/MindMapViewer';

export default function KnowledgeManagement() {
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [mindmapVisible, setMindmapVisible] = useState(false);
  const [mindmapFile, setMindmapFile] = useState(null);
  const [uploadTaskId, setUploadTaskId] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadFileStatuses, setUploadFileStatuses] = useState([]);
  const pollingRef = useRef(null);

  useEffect(() => {
    fetchKnowledgeFiles();
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const mergeAndSortFileStatuses = (incomingStatuses, preferredOrder) => {
    const incomingMap = new Map((incomingStatuses || []).map(item => [item.filename, item]));
    const ordered = [];

    (preferredOrder || []).forEach((name) => {
      if (incomingMap.has(name)) {
        ordered.push(incomingMap.get(name));
        incomingMap.delete(name);
      }
    });

    const leftovers = Array.from(incomingMap.values()).sort((a, b) =>
      String(a.filename || '').localeCompare(String(b.filename || ''), 'zh-CN')
    );

    return [...ordered, ...leftovers];
  };

  const shallowEqualStatuses = (a, b) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const left = a[i] || {};
      const right = b[i] || {};
      if (
        left.filename !== right.filename
        || left.status !== right.status
        || left.step !== right.step
        || Number(left.progress || 0) !== Number(right.progress || 0)
        || (left.message || '') !== (right.message || '')
      ) {
        return false;
      }
    }
    return true;
  };

  const fetchKnowledgeFiles = async () => {
    setFileLoading(true);
    try {
      const response = await http.get('/knowledge-files');
      setKnowledgeFiles(response.data.files);
    } catch (err) {
      console.error('获取文件列表失败:', err);
      message.error('获取知识库文件列表失败');
    }
    setFileLoading(false);
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }
    const formData = new FormData();
    fileList.forEach(file => {
      formData.append('files', file);
    });
    setLoading(true);
    try {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      const response = await http.post('/upload-with-progress', formData, {
        timeout: 120000,
      });

      const taskId = response.data?.task_id;
      if (!taskId) {
        throw new Error('未获取到上传任务ID');
      }

      setUploadTaskId(taskId);
      setUploadProgress(0);
      setUploadStep('任务已创建，等待处理');
      setUploadFileStatuses([]);

      const intervalId = window.setInterval(async () => {
        try {
          const taskRes = await http.get(`/upload-task/${taskId}`);
          const task = taskRes.data || {};
          const orderedStatuses = mergeAndSortFileStatuses(task.files || [], fileList.map(file => file.name).filter(Boolean));

          setUploadProgress((prev) => {
            const next = Number(task.overall_progress || 0);
            return prev === next ? prev : next;
          });

          setUploadStep((prev) => {
            const next = task.current_step || '处理中';
            return prev === next ? prev : next;
          });

          setUploadFileStatuses((prev) => shallowEqualStatuses(prev, orderedStatuses) ? prev : orderedStatuses);

          if (task.status === 'completed') {
            window.clearInterval(intervalId);
            pollingRef.current = null;
            setLoading(false);
            setFileList([]);
            fetchKnowledgeFiles();

            const results = task.results || [];
            const successCount = results.filter(r => r.status === 'success').length;
            const errorCount = results.filter(r => r.status === 'error').length;
            if (errorCount === 0) {
              message.success(`所有文件上传并解析完成（${successCount} 个）`);
            } else if (successCount === 0) {
              message.error('所有文件处理失败');
            } else {
              message.warning(`部分文件处理完成（${successCount} 成功，${errorCount} 失败）`);
            }
          }

          if (task.status === 'failed') {
            window.clearInterval(intervalId);
            pollingRef.current = null;
            setLoading(false);
            message.error(task.error || '上传任务失败');
          }
        } catch (pollErr) {
          console.error('轮询上传进度失败:', pollErr);
          window.clearInterval(intervalId);
          pollingRef.current = null;
          setLoading(false);
          message.error('获取上传进度失败');
        }
      }, 1000);

      pollingRef.current = intervalId;
    } catch (err) {
      console.error('上传错误:', err);
      setLoading(false);
      if (err.response) {
        message.error(`上传失败: ${err.response.data.error || err.response.statusText}`);
      } else if (err.code === 'ECONNABORTED') {
        message.error('上传超时，请稍后重试');
      } else {
        message.error('上传失败，请检查网络连接');
      }
    }
  };

  const handleDeleteFile = async (filename) => {
    try {
      await http.delete(`/delete-file/${encodeURIComponent(filename)}`);
      message.success('文件删除成功');
      fetchKnowledgeFiles();
    } catch (err) {
      console.error('删除失败:', err);
      if (err.response) {
        message.error(`删除失败: ${err.response.data.error || err.response.statusText}`);
      } else {
        message.error('删除失败，请检查网络连接');
      }
    }
  };

  const handleViewMindmap = (file) => {
    setMindmapFile(file);
    setMindmapVisible(true);
  };

  const getFileTypeTag = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
      'pdf': { color: 'red', text: 'PDF' },
      'doc': { color: 'blue', text: 'Word' },
      'docx': { color: 'blue', text: 'Word' },
      'mp3': { color: 'green', text: '音频' },
      'wav': { color: 'green', text: '音频' },
      'm4a': { color: 'green', text: '音频' },
      'aac': { color: 'green', text: '音频' },
      'ogg': { color: 'green', text: '音频' },
      'mp4': { color: 'purple', text: '视频' },
      'avi': { color: 'purple', text: '视频' },
      'mov': { color: 'purple', text: '视频' },
      'mkv': { color: 'purple', text: '视频' },
      'flv': { color: 'purple', text: '视频' },
      'wmv': { color: 'purple', text: '视频' }
    };
    return typeMap[ext] || { color: 'default', text: '文件' };
  };

  const handleFileChange = ({ fileList: newFileList }) => {
    setFileList(newFileList.map(file => file.originFileObj || file));
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card title={<span style={{ fontWeight: 700, fontSize: 22 }}><DatabaseOutlined style={{ color: '#1677ff', marginRight: 8 }} />知识库管理</span>} 
            style={{ marginBottom: 24, borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            支持格式：PDF、Word文档(.doc/.docx)、音频(MP3/WAV/M4A/AAC/OGG)、视频(MP4/AVI/MOV/MKV/FLV/WMV)
          </Text>
        </div>
        <Upload
          beforeUpload={() => false}
          fileList={fileList.map((file, index) => ({
            uid: index,
            name: file.name || `文件${index + 1}`,
            status: 'done',
          }))}
          onChange={handleFileChange}
          multiple={true}
          accept=".pdf,.doc,.docx,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.avi,.mov,.mkv,.flv,.wmv"
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <Button type="primary" onClick={handleUpload} style={{ marginTop: 16 }} loading={loading}>
          上传并入库 ({fileList.length} 个文件)
        </Button>

        {uploadTaskId && (
          <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong>解析进度：</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>{uploadStep || '处理中'}</Text>
            </div>
            <Progress percent={Math.round(uploadProgress)} status={uploadProgress >= 100 ? 'success' : 'active'} />
            {uploadFileStatuses.length > 0 && (
              <div style={{ marginTop: 10, maxHeight: 180, overflow: 'auto' }}>
                {uploadFileStatuses.map((item, index) => (
                  <div key={`${item.filename}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28, marginBottom: 6 }}>
                    <Text style={{ maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.filename}>
                      {item.filename}
                    </Text>
                    <Text type="secondary" style={{ maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }} title={item.step || '处理中'}>
                      {item.step || '处理中'}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Divider />

      <Card title={<span style={{ fontWeight: 700, fontSize: 22 }}><DatabaseOutlined style={{ color: '#1677ff', marginRight: 8 }} />知识库文件列表</span>} 
            style={{ borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
        <div style={{ marginBottom: 16 }}>
          <Button onClick={fetchKnowledgeFiles} loading={fileLoading} icon={<EyeOutlined />}>
            刷新列表
          </Button>
          <Text style={{ marginLeft: 16, color: '#666' }}>
            共 {knowledgeFiles.length} 个文件
          </Text>
        </div>
        {fileLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>加载中...</div>
          </div>
        ) : knowledgeFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无文件，请先上传文档
          </div>
        ) : (
          <List
            dataSource={knowledgeFiles}
            renderItem={(file) => {
              const fileType = getFileTypeTag(file.filename);
              return (
                <List.Item
                  actions={[
                    file.filename.toLowerCase().endsWith('.pdf') && (
                      <Button
                        type="text"
                        icon={<DatabaseOutlined />}
                        onClick={() => handleViewMindmap(file)}
                        size="small"
                        style={{ marginRight: 8 }}
                        title="查看思维导图"
                      >
                        思维导图
                      </Button>
                    ),
                    <Switch
                      checked={file.student_can_download}
                      checkedChildren="可下载"
                      unCheckedChildren="不可下载"
                      onChange={checked => {
                        axios.post(`${getApiUrl()}/set-student-download`, new URLSearchParams({
                          filename: file.filename,
                          can_download: checked
                        })).then(() => {
                          message.success('设置成功');
                          fetchKnowledgeFiles();
                        });
                      }}
                      style={{ marginRight: 16 }}
                    />,
                    <Popconfirm
                      title="确定要删除这个文件吗？"
                      description="删除后将从知识库中移除，无法恢复"
                      onConfirm={() => handleDeleteFile(file.filename)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{file.filename}</span>
                        <Tag color={fileType.color}>{fileType.text}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">上传时间: {file.upload_time}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      <Modal
        title={`思维导图: ${mindmapFile?.filename || ''}`}
        open={mindmapVisible}
        onCancel={() => setMindmapVisible(false)}
        footer={null}
        width="90%"
        style={{ top: 20, maxWidth: 1400 }}
        bodyStyle={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}
      >
        {mindmapFile && (
          <MindMapViewer 
            key={mindmapFile.filename}
            filename={mindmapFile.filename} 
            onClose={() => setMindmapVisible(false)}
          />
        )}
      </Modal>
    </div>
    </AppLayout>
  );
}
