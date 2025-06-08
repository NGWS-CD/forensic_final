// DOM 변경 감지 모듈 (src/core/dom.js)

class DOMTracker {
  constructor(options = {}) {
    this.options = {
      maskPatterns: options.maskPatterns || ['card', 'password'],
      logLevel: options.logLevel || 'info',
      ...options
    };
    
    this.observers = new Map();
    this.records = [];
  }

  // 민감 정보 마스킹
  maskSensitiveData(value, type) {
    if (!value) return value;
    
    if (this.options.maskPatterns.some(pattern => 
      type.toLowerCase().includes(pattern))) {
      return value.replace(/.(?=.{4})/g, '•');
    }
    return value;
  }

  // 기록 저장
  record(event) {
    const timestamp = Date.now();
    const record = {
      ...event,
      timestamp,
      url: window.location.href
    };

    this.records.push(record);
    console.log(`[DOM RECORD] ${JSON.stringify(record)}`);
    
    // alert로 감지 내용 표시
    const alertMessage = `[DOM 변경 감지]\n유형: ${record.type}\n요소: ${record.element || 'N/A'}\n선택자: ${record.selector || 'N/A'}\n시간: ${new Date(timestamp).toLocaleString()}`;
    alert(alertMessage);
    
    // 서버로 전송 또는 로컬 저장
    this.saveRecord(record);
  }

  // 기록 저장 구현 (서버 전송 또는 로컬 스토리지)
  async saveRecord(record) {
    try {
      // 민감한 데이터 마스킹
      const maskedRecord = {
        ...record,
        value: this.maskSensitiveData(record.value, 'text/plain')
      };

      // 로컬 스토리지에 저장
      const storageKey = `dom_${record.timestamp}`;
      localStorage.setItem(storageKey, JSON.stringify(maskedRecord));

      // 서버로 전송 (API 엔드포인트가 있는 경우)
      if (this.options.apiEndpoint) {
        const response = await fetch(this.options.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(maskedRecord)
        });

        if (!response.ok) {
          console.warn('[DOMTracker] 서버 저장 실패:', await response.text());
        }
      }

      // 로그 레벨에 따른 콘솔 출력
      if (this.options.logLevel === 'debug') {
        console.debug('[DOMTracker] 기록 저장:', maskedRecord);
      } else if (this.options.logLevel === 'info') {
        console.info('[DOMTracker] 변경 감지:', {
          type: maskedRecord.type,
          element: maskedRecord.element,
          selector: maskedRecord.selector,
          timestamp: maskedRecord.timestamp
        });
      }
    } catch (error) {
      console.error('[DOMTracker] 기록 저장 중 오류:', error);
    }
  }

  // 입력 값 변경 감지
  trackInputChanges() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'value') {
          const el = mutation.target;
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            this.record({
              type: 'input-change',
              element: el.tagName,
              name: el.name || '',
              value: this.maskSensitiveData(el.value, el.name),
              selector: this.getElementSelector(el)
            });
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['value']
    });

    this.observers.set('input', observer);
  }

  // 텍스트 노드 변경 감지
  trackTextChanges() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'characterData') {
          this.record({
            type: 'text-change',
            before: mutation.oldValue,
            after: mutation.target.data,
            selector: this.getElementSelector(mutation.target.parentElement)
          });
        }
      });
    });

    observer.observe(document.documentElement, {
      characterData: true,
      characterDataOldValue: true,
      subtree: true
    });

    this.observers.set('text', observer);
  }

  // DOM 노드 추가/삭제 감지
  trackNodeChanges() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.record({
                type: 'node-added',
                tag: node.tagName,
                selector: this.getElementSelector(node)
              });
            }
          });

          mutation.removedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.record({
                type: 'node-removed',
                tag: node.tagName,
                selector: this.getElementSelector(node)
              });
            }
          });
        }
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    this.observers.set('node', observer);
  }

  // 요소 비활성화 감지
  trackElementDisabling() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && 
            ['style', 'disabled'].includes(mutation.attributeName)) {
          const el = mutation.target;
          const style = window.getComputedStyle(el);
          
          if (style.display === 'none' || el.disabled) {
            this.record({
              type: 'element-disabled',
              element: el.tagName,
              attribute: mutation.attributeName,
              value: el.getAttribute(mutation.attributeName),
              selector: this.getElementSelector(el)
            });
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'disabled']
    });

    this.observers.set('disable', observer);
  }

  // 요소의 고유 선택자 생성
  getElementSelector(element) {
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
    this.trackInputChanges();
    this.trackTextChanges();
    this.trackNodeChanges();
    this.trackElementDisabling();
  }

  // 모든 감지 중지
  stop() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  // 기록 조회
  getRecords() {
    return this.records;
  }
}

export default DOMTracker; 
