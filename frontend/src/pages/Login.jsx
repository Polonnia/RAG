import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select, message, Card } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, UserAddOutlined } from '@ant-design/icons';

// 添加Google字体
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;1,300&family=Noto+Sans+SC:wght@400;700;900&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);
import { login as doLogin, register as doRegister } from '../services/authService';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loginVisible, setLoginVisible] = useState(false);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [form] = Form.useForm();
  const [regForm] = Form.useForm();

  const roleOptions = [
    { value: 'student', label: '学生' },
    { value: 'teacher', label: '教师' },
    { value: 'admin', label: '管理员' },
  ];

  const onLogin = async (values) => {
    setLoading(true);
    try {
      const data = await doLogin(values.username, values.password);
      message.success('登录成功');
      setLoginVisible(false);
      form.resetFields();
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else {
        const role = data?.user?.role;
        if (role === 'teacher') navigate('/knowledge');
        else if (role === 'student') navigate('/student');
        else navigate('/knowledge');
      }
    } catch (e) {
      message.error('登录失败：用户名或密码错误');
    }
    setLoading(false);
  };

  const onRegister = async (values) => {
    setRegLoading(true);
    try {
      await doRegister(values);
      message.success('注册成功，请登录');
      setRegisterVisible(false);
      regForm.resetFields();
      setLoginVisible(true);
    } catch (e) {
      message.error('注册失败：用户名已存在');
    }
    setRegLoading(false);
  };

  const handleMouseMove = (e) => {
    const ripple = document.createElement('div');
    const container = document.getElementById('ripple-container');

    if (container) {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ripple.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.25) 40%, transparent 70%);
        transform: translate(-50%, -50%);
        animation: ripple-effect 1.5s ease-out forwards;
        pointer-events: none;
        z-index: 4;
        border: 1px solid rgba(255, 255, 255, 0.2);
      `;

      container.appendChild(ripple);

      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 1500);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `
          radial-gradient(circle at 15% 25%, rgba(187, 222, 251, 0.9) 0%, transparent 60%),
          radial-gradient(circle at 85% 15%, rgba(129, 212, 250, 0.7) 0%, transparent 55%),
          radial-gradient(circle at 35% 75%, rgba(179, 229, 252, 0.8) 0%, transparent 65%),
          radial-gradient(circle at 95% 85%, rgba(225, 245, 254, 0.6) 0%, transparent 50%),
          radial-gradient(circle at 60% 10%, rgba(144, 202, 249, 0.5) 0%, transparent 45%),
          radial-gradient(circle at 10% 90%, rgba(187, 222, 251, 0.4) 0%, transparent 55%),
          linear-gradient(135deg, #bbdefb 0%, #e1f5fe 50%, #f0f8ff 100%)
        `,
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        backgroundBlendMode: 'multiply',
        fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif'
      }}
      onMouseMove={handleMouseMove}
    >

      {/* Paper Plane 装饰图片 - Trace文字T字母上方 + 浮动动画 */}
      <img
        src="/images/paper plane.png"
        alt="Paper Plane"
        style={{
          position: 'absolute',
          top: '22%',
          left: '0.1%',
          width: '180px',
          height: '180px',
          opacity: 0.8,
          animation: 'paperPlaneFloat 4s ease-in-out infinite',
          zIndex: 2,
          pointerEvents: 'none'
        }}
      />

      {/* Learn 装饰图片 - 顶部拉宽 + 浮动动画 */}
      <img
        src="/images/learn.png"
        alt="Learn"
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          maxWidth: '1000px',
          height: 'auto',
          opacity: 0.7,
          animation: 'cloudFloat 5s ease-in-out infinite',
          zIndex: 1,
          pointerEvents: 'none'
        }}
      />

      {/* 水波纹效果容器 - 在标题和卡片之间 */}
      <div
        id="ripple-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 3
        }}
      ></div>

      {/* Trace Learn 标题 */}
      <div style={{
        position: 'absolute',
        top: '35%',
        left: 0,
        right: 0,
        fontSize: 'clamp(72px, 24vw, 144px)',
        fontWeight: '700',
        color: '#ffffff',
        zIndex: 5,
        opacity: 0.95,
        letterSpacing: '6px',
        textShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 2%',
        alignItems: 'center',
        fontFamily: '"Playfair Display", serif',
        fontStyle: 'italic',
        transition: 'all 0.3s ease',
        cursor: 'default'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.textShadow = '0 0 30px rgba(255, 255, 255, 0.9), 0 6px 20px rgba(0, 0, 0, 0.4)';
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
        e.currentTarget.style.opacity = '0.95';
        e.currentTarget.style.transform = 'scale(1)';
      }}
      >
          <span style={{ 
            marginRight: '40px', 
            transform: 'translateX(30px)' 
          }}>T r a c e</span>
          <span style={{ 
            marginLeft: '40px', 
            transform: 'translateX(-30px)' 
          }}>L e a r n</span>
      </div>

      <Card
        className="login-card"
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          zIndex: 10
        }}
        bodyStyle={{ padding: '48px 32px' }}
      >
        <div style={{
          textAlign: 'center',
          position: 'relative',
          width: '100%'
        }}>
          <h1 style={{
            fontSize: 'clamp(44px, 9vw, 60px)',
            fontWeight: '900',
            color: '#262626',
            margin: '0 0 8px',
            background: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 45%, #42a5f5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
            letterSpacing: '4px',
            lineHeight: '1.1',
            textShadow: '0 3px 12px rgba(13, 71, 161, 0.25)',
            position: 'relative'
          }}>
            溯 知
          </h1>
          <p style={{ color: '#8c8c8c', fontSize: '16px', margin: '0 0 40px' }}>
            一站式教学智能体平台
          </p>
        </div>

        {/* 按钮区域 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <Button
            type="primary"
            icon={<LoginOutlined />}
            onClick={() => setLoginVisible(true)}
            style={{
              height: '52px',
              borderRadius: '26px',
              fontSize: '18px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)',
              border: 'none',
              boxShadow: '0 4px 16px rgba(66, 165, 245, 0.3)'
            }}
          >
            登录
          </Button>

          <Button
            icon={<UserAddOutlined />}
            onClick={() => setRegisterVisible(true)}
            style={{
              height: '52px',
              borderRadius: '26px',
              fontSize: '18px',
              fontWeight: '600',
              background: '#ffffff',
              border: '2px solid #e0e0e0',
              color: '#424242',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            注册
          </Button>
        </div>
      </Card>

      {/* 登录模态框 */}
      <Modal
        title="用户登录"
        open={loginVisible}
        onCancel={() => setLoginVisible(false)}
        footer={null}
        centered
        width={400}
        style={{ borderRadius: '20px' }}
        className="login-modal"
      >
        <Form form={form} layout="vertical" onFinish={onLogin} size="large">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#757575' }} />}
              placeholder="请输入用户名"
              style={{
                borderRadius: '10px',
                border: '2px solid #d9d9d9',
                fontSize: '16px',
                background: '#ffffff',
                padding: '0 8px 0 38px',
                lineHeight: '32px'
              }}
              className="custom-login-input"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#757575' }} />}
              placeholder="请输入密码"
              style={{
                borderRadius: '10px',
                border: '2px solid #d9d9d9',
                fontSize: '16px',
                background: '#ffffff',
                padding: '0 8px 0 38px'
              }}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{
              height: '48px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              marginTop: '8px',
              background: 'linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)',
              border: 'none'
            }}
          >
            登录
          </Button>
        </Form>
      </Modal>

      {/* 注册模态框 */}
      <Modal
        title="用户注册"
        open={registerVisible}
        onCancel={() => setRegisterVisible(false)}
        footer={null}
        destroyOnClose
        centered
        width={400}
        style={{ borderRadius: '20px' }}
        className="login-modal"
      >
        <Form form={regForm} layout="vertical" onFinish={onRegister} size="large">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#757575' }} />}
              placeholder="请输入用户名"
              style={{
                borderRadius: '10px',
                border: '2px solid #d9d9d9',
                fontSize: '16px',
                background: '#ffffff',
                padding: '0 8px 0 38px'
              }}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#757575' }} />}
              placeholder="请输入密码"
              style={{
                borderRadius: '10px',
                border: '2px solid #d9d9d9',
                fontSize: '16px',
                background: '#ffffff',
                padding: '0 8px 0 38px'
              }}
            />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              placeholder="请选择角色"
              options={roleOptions}
              getPopupContainer={(triggerNode) => triggerNode.parentElement}
              style={{
                height: '48px',
                borderRadius: '10px',
                border: '2px solid #d9d9d9',
                background: '#ffffff'
              }}
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={regLoading}
            style={{
              height: '48px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              marginTop: '8px',
              background: 'linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)',
              border: 'none'
            }}
          >
            注册
          </Button>
        </Form>
      </Modal>
    </div>
  );
}