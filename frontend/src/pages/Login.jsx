import React, { useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Form, Input, Modal, Select, message } from 'antd';
import { login as doLogin, register as doRegister } from '../services/authService';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loginVisible, setLoginVisible] = useState(true);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [form] = Form.useForm();
  const [regForm] = Form.useForm();

  const onLogin = async (values) => {
    try {
      const data = await doLogin(values.username, values.password);
      message.success('登录成功');
      setLoginVisible(false);
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else {
        const role = data?.user?.role;
        if (role === 'teacher') navigate('/manage');
        else if (role === 'student') navigate('/student');
        else navigate('/knowledge');
      }
    } catch (e) {
      message.error('登录失败');
    }
  };

  const onRegister = async (values) => {
    try {
      await doRegister(values);
      message.success('注册成功，请登录');
      setRegisterVisible(false);
      setLoginVisible(true);
    } catch (e) {
      message.error('注册失败');
    }
  };

  return (
    <AppLayout>
      <h2 style={{ fontWeight: 700, marginTop: 0 }}>登录/注册</h2>
      <Button type="primary" onClick={() => setLoginVisible(true)} style={{ marginRight: 8 }}>登录</Button>
      <Button onClick={() => setRegisterVisible(true)}>注册</Button>

      <Modal title="用户登录" open={loginVisible} onCancel={() => setLoginVisible(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={onLogin}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>登录</Button>
        </Form>
      </Modal>

      <Modal title="用户注册" open={registerVisible} onCancel={() => setRegisterVisible(false)} footer={null}>
        <Form form={regForm} layout="vertical" onFinish={onRegister}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select>
              <Select.Option value="student">学生</Select.Option>
              <Select.Option value="teacher">教师</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>注册</Button>
        </Form>
      </Modal>
    </AppLayout>
  );
}


