/**
 * 动画和过渡效果辅助类
 * 提供常用的 CSS 类名和样式对象
 */

export const animationClasses = {
  // 进入动画
  fadeIn: 'fade-enter',
  fadeInUp: 'fade-in-up',
  fadeInDown: 'fade-in-down',
  slideInLeft: 'slide-in-left',
  slideInRight: 'slide-in-right',
  scaleIn: 'scale-in',
  
  // 出退动画
  fadeOut: 'fade-out',
  slideOutLeft: 'slide-out-left',
  slideOutRight: 'slide-out-right',
  scaleOut: 'scale-out',
};

export const transitionStyles = {
  // 过渡样式对象
  smooth: {
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  smoothFast: {
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  smoothSlow: {
    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  bounce: {
    transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  },
  elastic: {
    transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
  }
};

// 悬停效果工具函数
export const hoverEffects = {
  // 上浮效果
  liftUp: (element, distance = 4) => {
    element.style.transform = `translateY(-${distance}px)`;
    element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
  },
  
  resetLiftUp: (element) => {
    element.style.transform = 'translateY(0)';
    element.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
  },
  
  // 缩放效果
  scaleUp: (element, scale = 1.02) => {
    element.style.transform = `scale(${scale})`;
  },
  
  resetScaleUp: (element) => {
    element.style.transform = 'scale(1)';
  },
  
  // 颜色变亮
  brighten: (element, amount = 1.05) => {
    element.style.filter = `brightness(${amount})`;
  },
  
  resetBrighten: (element) => {
    element.style.filter = 'brightness(1)';
  }
};

// 页面加载动画辅助
export const pageAnimation = {
  enter: 'animation: fadeInUp 0.5s ease-out',
  exit: 'animation: fadeOutDown 0.3s ease-in'
};

// 获取动画类名
export function getAnimationClassName(animationType, duration = 'normal') {
  const durations = {
    fast: 'fast',
    normal: 'normal',
    slow: 'slow'
  };
  return `${animationType} ${durations[duration] || 'normal'}`;
}

// 应用悬停效果到元素
export function applyHoverEffect(elementRef, effectType = 'liftUp') {
  if (!elementRef.current) return;
  
  const element = elementRef.current;
  
  element.addEventListener('mouseenter', () => {
    switch(effectType) {
      case 'liftUp':
        hoverEffects.liftUp(element);
        break;
      case 'scaleUp':
        hoverEffects.scaleUp(element);
        break;
      case 'brighten':
        hoverEffects.brighten(element);
        break;
      default:
        hoverEffects.liftUp(element);
    }
  });
  
  element.addEventListener('mouseleave', () => {
    switch(effectType) {
      case 'liftUp':
        hoverEffects.resetLiftUp(element);
        break;
      case 'scaleUp':
        hoverEffects.resetScaleUp(element);
        break;
      case 'brighten':
        hoverEffects.resetBrighten(element);
        break;
      default:
        hoverEffects.resetLiftUp(element);
    }
  });
}

// 延迟动画工具
export function staggerAnimation(elements, delay = 50) {
  Array.from(elements).forEach((element, index) => {
    element.style.animationDelay = `${index * delay}ms`;
  });
}

// 脉冲动画
export const pulseAnimation = {
  apply: (element) => {
    element.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
  },
  remove: (element) => {
    element.style.animation = 'none';
  }
};

export default {
  animationClasses,
  transitionStyles,
  hoverEffects,
  pageAnimation,
  getAnimationClassName,
  applyHoverEffect,
  staggerAnimation,
  pulseAnimation
};
