// 웹 포렌식 도구 메인 진입점 (src/index.js)

import DOMTracker from './core/dom';
import NetworkTracker from './core/network';
import SuspiciousTracker from './core/suspicious';

class WebForensic {
  constructor(options = {}) {
    this.options = {
      maskPatterns: options.maskPatterns || ['card', 'password'],
      suspiciousThreshold: options.suspiciousThreshold || 0.8,
      allowedDomains: options.allowedDomains || [],
      logLevel: options.logLevel || 'info',
      ...options
    };

    this.domTracker = new DOMTracker(this.options);
    this.networkTracker = new NetworkTracker(this.options);
    this.suspiciousTracker = new SuspiciousTracker(this.options);
  }

  // 모든 감지 시작
  start() {
    this.domTracker.start();
    this.networkTracker.start();
    this.suspiciousTracker.start();
    
    console.log('[WebForensic] 감지 시작');
  }

  // 모든 감지 중지
  stop() {
    this.domTracker.stop();
    this.networkTracker.stop();
    
    console.log('[WebForensic] 감지 중지');
  }
}

// 전역 객체로 노출
window.WebForensic = WebForensic;

export default WebForensic; 
