/**
 * Ant Design 5.x 主题配置
 * 教育科技风格 - 蓝色系主题
 */

const primaryColor = '#1677ff';
const primaryColorLight = '#5b8def';
const primaryColorDark = '#0d47a1';

export const theme = {
  token: {
    // 色彩系统
    colorPrimary: primaryColor,
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',
    colorText: '#1a1a1a',
    colorTextSecondary: '#595959',
    colorBgBase: '#ffffff',
    colorBgContainer: '#f5f7fb',
    colorBgElevated: '#fafbfc',
    
    // 圆角
    borderRadius: 10,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    
    // 字体
    fontSize: 14,
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 18,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    fontWeightStrong: 700,
    fontFamily: `
      'Sora', 
      'Noto Sans SC', 
      'Microsoft YaHei', 
      'PingFang SC', 
      'HarmonyOS Sans',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      sans-serif
    `,
    
    // 阴影
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    boxShadowSecondary: '0 4px 12px rgba(0, 0, 0, 0.08)',
    
    // 控制尺寸
    controlHeight: 38,
    controlHeightLG: 46,
    controlHeightSM: 32,
    
    // 间距
    margin: 16,
    marginXS: 8,
    marginSM: 12,
    marginMD: 16,
    marginLG: 24,
    marginXL: 32,
    
    // 过渡
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0.4, 0, 1, 1)',
    motionEaseIn: 'cubic-bezier(0, 0, 0.2, 1)',
    motionEaseInCirc: 'cubic-bezier(0.6, 0.04, 0.98, 0.33)',
    motionEaseOutCirc: 'cubic-bezier(0.04, 0.93, 0.82, 0.96)',
    motionUnit: 0.1,
  },
  components: {
    Button: {
      colorPrimary: primaryColor,
      fontWeight: 600,
      borderRadius: 10,
      controlHeight: 38,
      primaryColor,
    },
    Card: {
      borderRadius: 16,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      colorBgContainer: '#ffffff',
    },
    Input: {
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 500,
      controlHeight: 38,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 38,
      fontSize: 14,
    },
    Layout: {
      colorBgHeader: '#1677ff',
      colorBgBody: '#f5f7fb',
    },
    Menu: {
      colorItemBg: 'transparent',
      borderRadius: 10,
    },
    Table: {
      borderRadius: 12,
      colorBgContainer: '#ffffff',
    },
    Modal: {
      borderRadius: 16,
      boxShadowSecondary: '0 8px 24px rgba(0, 0, 0, 0.12)',
    },
    Tabs: {
      borderRadius: 8,
    },
    Tag: {
      borderRadius: 8,
      fontWeight: 500,
    },
    Message: {
      borderRadius: 10,
    },
    Notification: {
      borderRadius: 10,
    },
  },
};

export const darkTheme = {
  token: {
    colorBgBase: '#141414',
    colorBgContainer: '#1f1f1f',
    colorBgElevated: '#262626',
    colorText: '#e8e8e8',
    colorTextSecondary: '#b1bac4',
    colorBorder: '#434343',
    colorPrimary: primaryColor,
  },
  components: {
    Layout: {
      colorBgHeader: '#1677ff',
      colorBgBody: '#141414',
    },
  },
};

export default theme;
