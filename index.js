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

  // DOM 변경 기록 조회
  getDOMRecords() {
    return this.domTracker.getRecords();
  }

  // 네트워크 요청 기록 조회
  getNetworkRecords() {
    return this.networkTracker.getRecords();
  }

  // 의심 활동 기록 조회
  getSuspiciousRecords() {
    return this.suspiciousTracker.getSuspiciousRecords();
  }

  // 모든 기록 조회
  getAllRecords() {
    return {
      dom: this.getDOMRecords(),
      network: this.getNetworkRecords(),
      suspicious: this.getSuspiciousRecords()
    };
  }

  // Puppeteer 페이지에 감지 설정
  async setupPuppeteer(page) {
    await this.networkTracker.setupPuppeteerInterception(page);
    console.log('[WebForensic] Puppeteer 감지 설정 완료');
  }
}

// 전역 객체로 노출
window.WebForensic = WebForensic;

export default WebForensic; 
