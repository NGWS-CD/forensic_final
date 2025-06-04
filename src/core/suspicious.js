// 의심 요소 감지 모듈 (src/core/suspicious.js)

class SuspiciousTracker {
  constructor(options = {}) {
    this.options = {
      suspiciousThreshold: options.suspiciousThreshold || 0.8,
      logLevel: options.logLevel || 'warn',
      allowedDomains: options.allowedDomains || [],
      ...options
    };
    
    this.records = [];
    this.accessedValues = new Set();
    this.lastClick = null;
  }

  // 기록 저장
  record(event) {
    const timestamp = Date.now();
    const record = {
      ...event,
      timestamp,
      url: window.location.href,
      severity: this.calculateSeverity(event)
    };

    this.records.push(record);
    
    if (record.severity >= this.options.suspiciousThreshold) {
      console.warn(`[SUSPICIOUS] ${JSON.stringify(record)}`);
    } else {
      console.log(`[ACTIVITY] ${JSON.stringify(record)}`);
    }
    
    // 서버로 전송 또는 로컬 저장
    this.saveRecord(record);
  }

  // 의심도 계산
  calculateSeverity(event) {
    let score = 0;
    
    switch (event.type) {
      case 'value-access':
        score = 0.6;
        break;
      case 'encoding-attempt':
        score = 0.8;
        break;
      case 'external-script':
        score = 0.9;
        break;
      case 'domain-mismatch':
        score = 1.0;
        break;
      case 'hidden-click':
        score = 0.7;
        break;
      case 'iframe-click':
        score = 0.8;
        break;
      case 'element-disabling':
        score = 0.6;
        break;
      case 'sensitive-network':
        score = 0.9;
        break;
    }
    
    return score;
  }

  // 기록 저장 구현
  async saveRecord(record) {
    try {
      // 로컬 스토리지에 저장
      const storageKey = `suspicious_${record.timestamp}`;
      localStorage.setItem(storageKey, JSON.stringify(record));

      // 서버로 전송 (API 엔드포인트가 있는 경우)
      if (this.options.apiEndpoint) {
        const response = await fetch(this.options.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record)
        });

        if (!response.ok) {
          console.warn('[SuspiciousTracker] 서버 저장 실패:', await response.text());
        }
      }

      // 로그 레벨에 따른 콘솔 출력
      if (this.options.logLevel === 'debug') {
        console.debug('[SuspiciousTracker] 기록 저장:', record);
      } else if (this.options.logLevel === 'warn' && record.severity >= this.options.suspiciousThreshold) {
        console.warn('[SuspiciousTracker] 의심스러운 활동 감지:', record);
      }
    } catch (error) {
      console.error('[SuspiciousTracker] 기록 저장 중 오류:', error);
    }
  }

  // 입력 값 접근 감지
  trackValueAccess() {
    const originalDesc = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, 
      'value'
    );

    Object.defineProperty(HTMLInputElement.prototype, 'value', {
      get() {
        const value = originalDesc.get.call(this);
        this.accessedValues.add(value);
        
        SuspiciousTracker.instance.record({
          type: 'value-access',
          element: this.tagName,
          name: this.name || '',
          selector: this.getSelector()
        });
        
        return value;
      },
      set(value) {
        return originalDesc.set.call(this, value);
      }
    });
  }

  // 인코딩/변환 시도 감지
  trackEncodingAttempts() {
    // atob 감지
    window.atob = (original => function(str) {
      SuspiciousTracker.instance.record({
        type: 'encoding-attempt',
        method: 'atob',
        input: str
      });
      return original.call(this, str);
    })(window.atob);

    // JSON.parse 감지
    JSON.parse = (original => function(str) {
      SuspiciousTracker.instance.record({
        type: 'encoding-attempt',
        method: 'JSON.parse',
        input: str
      });
      return original.call(this, str);
    })(JSON.parse);
  }

  // 외부 스크립트 로드 감지
  trackExternalScripts() {
    new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'SCRIPT' && node.src) {
            const scriptUrl = new URL(node.src, window.location.href);
            if (!this.options.allowedDomains.some(domain => 
              scriptUrl.hostname.endsWith(domain))) {
              SuspiciousTracker.instance.record({
                type: 'external-script',
                url: node.src,
                hostname: scriptUrl.hostname
              });
            }
          }
        });
      });
    }).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // 도메인 불일치 감지
  trackDomainMismatch() {
    const currentHost = window.location.hostname;
    if (!this.options.allowedDomains.some(domain => 
      currentHost.endsWith(domain))) {
      SuspiciousTracker.instance.record({
        type: 'domain-mismatch',
        hostname: currentHost,
        allowedDomains: this.options.allowedDomains
      });
    }
  }

  // 숨겨진 요소 클릭 감지
  trackHiddenClicks() {
    document.addEventListener('click', event => {
      const el = event.target;
      const style = window.getComputedStyle(el);
      
      this.lastClick = {
        timestamp: Date.now(),
        element: el
      };

      if (style.opacity === '0' || 
          style.visibility === 'hidden' || 
          parseInt(style.zIndex) > 1000) {
        SuspiciousTracker.instance.record({
          type: 'hidden-click',
          element: el.tagName,
          selector: this.getSelector(el),
          style: {
            opacity: style.opacity,
            visibility: style.visibility,
            zIndex: style.zIndex
          }
        });
      }

      if (el.tagName === 'IFRAME' || el.closest('iframe')) {
        SuspiciousTracker.instance.record({
          type: 'iframe-click',
          element: el.tagName,
          selector: this.getSelector(el)
        });
      }
    });
  }

  // 요소 비활성화 감지
  trackElementDisabling() {
    new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && 
            ['style', 'disabled'].includes(mutation.attributeName)) {
          const el = mutation.target;
          const style = window.getComputedStyle(el);
          
          if (style.display === 'none' || el.disabled) {
            SuspiciousTracker.instance.record({
              type: 'element-disabling',
              element: el.tagName,
              selector: this.getSelector(el),
              attribute: mutation.attributeName,
              value: el.getAttribute(mutation.attributeName)
            });
          }
        }
      });
    }).observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'disabled']
    });
  }

  // 민감 정보 네트워크 전송 감지
  trackSensitiveNetwork() {
    const originalFetch = window.fetch;
    window.fetch = async (resource, init = {}) => {
      const url = resource.url || resource;
      const method = init.method || 'GET';
      const body = init.body;
      
      if (method === 'POST' && body) {
        const hasSensitiveData = Array.from(this.accessedValues)
          .some(value => body.includes(value));
          
        if (hasSensitiveData) {
          SuspiciousTracker.instance.record({
            type: 'sensitive-network',
            url,
            method,
            triggeredByClick: this.lastClick && 
              (Date.now() - this.lastClick.timestamp < 1000)
          });
        }
      }
      
      return originalFetch.call(window, resource, init);
    };
  }

  // 요소의 고유 선택자 생성
  getSelector(element) {
    if (!element || element === document.documentElement) {
      return 'html';
    }

    let selector = element.tagName.toLowerCase();
    
    if (element.id) {
      selector += `#${element.id}`;
    } else if (element.className) {
      selector += `.${element.className.split(' ')
        .filter(c => c)
        .join('.')}`;
    }

    return selector;
  }

  // 모든 감지 시작
  start() {
    SuspiciousTracker.instance = this;
    
    this.trackValueAccess();
    this.trackEncodingAttempts();
    this.trackExternalScripts();
    this.trackDomainMismatch();
    this.trackHiddenClicks();
    this.trackElementDisabling();
    this.trackSensitiveNetwork();
  }

  // 기록 조회
  getRecords() {
    return this.records;
  }

  // 의심도가 높은 기록만 조회
  getSuspiciousRecords() {
    return this.records.filter(record => 
      record.severity >= this.options.suspiciousThreshold
    );
  }
}

export default SuspiciousTracker; 
