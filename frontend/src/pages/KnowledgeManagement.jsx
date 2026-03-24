import React, { useState, useEffect } from 'react';
import { Card, Button, Upload, List, Tag, Spin, Space, Divider, Popconfirm, Switch, Typography, message, Modal } from 'antd';
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

  useEffect(() => {
    fetchKnowledgeFiles();
  }, []);

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
      const response = await http.post('/upload', formData, {
        timeout: 120000,
      });
      
      if (response.data.results) {
        const results = response.data.results;
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        if (errorCount === 0) {
          message.success(response.data.msg);
        } else if (successCount === 0) {
          message.error(response.data.error);
        } else {
          message.warning(response.data.msg);
        }
        
        results.forEach(result => {
          if (result.status === 'success') {
            message.success(`${result.filename}: ${result.msg}`);
          } else {
            message.error(`${result.filename}: ${result.msg}`);
          }
        });
      } else {
        message.success(response.data.msg);
      }
      
      setFileList([]);
      fetchKnowledgeFiles();
    } catch (err) {
      console.error('上传错误:', err);
      if (err.response) {
        message.error(`上传失败: ${err.response.data.error || err.response.statusText}`);
      } else if (err.code === 'ECONNABORTED') {
        message.error('上传超时，请稍后重试');
      } else {
        message.error('上传失败，请检查网络连接');
      }
    }
    setLoading(false);
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
                        <Text type="secondary">文档片段: {file.chunk_count} 个</Text>
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
