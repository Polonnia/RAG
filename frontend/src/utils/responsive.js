import { useEffect, useState } from 'react';

/**
 * 响应式设计工具和钩子
 */

// 断点定义
export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
};

export const breakpointNames = {
  xs: '小屏手机',
  sm: '手机',
  md: '平板',
  lg: '桌面',
  xl: '大屏桌面',
  xxl: '超大屏'
};

/**
 * 响应式钩子 - 获取当前屏幕尺寸
 */
export function useResponsive() {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    breakpoint: 'lg'
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let breakpoint = 'xs';
      if (width >= breakpoints.xxl) breakpoint = 'xxl';
      else if (width >= breakpoints.xl) breakpoint = 'xl';
      else if (width >= breakpoints.lg) breakpoint = 'lg';
      else if (width >= breakpoints.md) breakpoint = 'md';
      else if (width >= breakpoints.sm) breakpoint = 'sm';
      
      setScreenSize({ width, height, breakpoint });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    ...screenSize,
    isMobile: screenSize.width < breakpoints.md,
    isTablet: screenSize.width >= breakpoints.md && screenSize.width < breakpoints.lg,
    isDesktop: screenSize.width >= breakpoints.lg,
    isSmall: screenSize.width < breakpoints.sm,
    isMedium: screenSize.width >= breakpoints.md && screenSize.width < breakpoints.lg,
    isLarge: screenSize.width >= breakpoints.lg,
    breakpointName: breakpointNames[screenSize.breakpoint]
  };
}

/**
 * 响应式栅格配置
 */
export const responsiveGridConfig = {
  xs: { gutter: [8, 8], span: 24 },      // 1 列
  sm: { gutter: [12, 12], span: 12 },    // 2 列
  md: { gutter: [16, 16], span: 8 },     // 3 列
  lg: { gutter: [20, 20], span: 6 },     // 4 列
  xl: { gutter: [24, 24], span: 4.8 },   // 5 列
  xxl: { gutter: [24, 24], span: 4 },    // 6 列
};

/**
 * 获取响应式栅格配置
 */
export function getResponsiveGridConfig(screenBreakpoint = 'lg') {
  return responsiveGridConfig[screenBreakpoint] || responsiveGridConfig.lg;
}

/**
 * 响应式间距工具
 */
export const responsivePadding = {
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  xxl: '32px',
};

export const responsiveMargin = {
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  xxl: '32px',
};

/**
 * 获取响应式字体大小
 */
export function getResponsiveFontSize(baseSize = 14, screenBreakpoint = 'lg') {
  const sizes = {
    xs: baseSize - 2,
    sm: baseSize - 1,
    md: baseSize,
    lg: baseSize,
    xl: baseSize + 1,
    xxl: baseSize + 2,
  };
  return sizes[screenBreakpoint] || baseSize;
}

/**
 * 响应式高度配置
 */
export function getResponsiveHeight(screenBreakpoint = 'lg') {
  const heights = {
    xs: 'auto',
    sm: 'calc(100vh - 300px)',
    md: 'calc(100vh - 200px)',
    lg: 'calc(100vh - 200px)',
    xl: 'calc(100vh - 200px)',
    xxl: 'calc(100vh - 200px)',
  };
  return heights[screenBreakpoint] || 'auto';
}

/**
 * 响应式容器宽度
 */
export function getResponsiveContainerWidth(screenBreakpoint = 'lg') {
  const widths = {
    xs: '100%',
    sm: '100%',
    md: 'calc(100% - 32px)',
    lg: 'calc(100% - 48px)',
    xl: '1140px',
    xxl: '1320px',
  };
  return widths[screenBreakpoint] || 'auto';
}

/**
 * 响应式网格布局
 */
export function getResponsiveColSpan(screenBreakpoint = 'lg', totalCols = 4) {
  const spans = {
    xs: { 1: 24, 2: 24, 3: 24, 4: 24, 6: 24 },
    sm: { 1: 24, 2: 12, 3: 8, 4: 6, 6: 4 },
    md: { 1: 24, 2: 12, 3: 8, 4: 6, 6: 4 },
    lg: { 1: 24, 2: 12, 3: 8, 4: 6, 6: 4 },
    xl: { 1: 24, 2: 12, 3: 8, 4: 6, 6: 4 },
    xxl: { 1: 24, 2: 12, 3: 8, 4: 6, 6: 4 },
  };
  
  return spans[screenBreakpoint]?.[totalCols] || 24;
}

/**
 * 使用响应式列配置的钩子
 */
export function useResponsiveColumns() {
  const { breakpoint } = useResponsive();
  
  return {
    // 常用配置
    full: 24,
    half: breakpoint === 'xs' || breakpoint === 'sm' ? 24 : 12,
    third: breakpoint === 'xs' || breakpoint === 'sm' ? 24 : 8,
    quarter: breakpoint === 'xs' || breakpoint === 'sm' ? 24 : breakpoint === 'md' ? 12 : 6,
    sixth: breakpoint === 'xs' || breakpoint === 'sm' ? 24 : breakpoint === 'md' ? 12 : 4,
  };
}

export default {
  breakpoints,
  breakpointNames,
  useResponsive,
  responsiveGridConfig,
  getResponsiveGridConfig,
  responsivePadding,
  responsiveMargin,
  getResponsiveFontSize,
  getResponsiveHeight,
  getResponsiveContainerWidth,
  getResponsiveColSpan,
  useResponsiveColumns
};
