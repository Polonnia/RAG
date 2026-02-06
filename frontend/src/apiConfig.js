// API配置 - 使用相对路径避免跨域问题
const getApiUrl = () => {
  // 在生产环境（通过FastAPI提供静态文件）中，使用相对路径
  // 在开发环境中，使用localhost
  if (process.env.NODE_ENV === 'production') {
    return ''; // 空字符串表示使用相对路径
  } else {
    return 'http://localhost:8000'; // 开发环境
  }
};

export default getApiUrl;