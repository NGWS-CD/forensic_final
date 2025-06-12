// 사용자 세션 레코딩 모듈 (src/record.js)

class SessionRecorder {
  constructor(options = {}) {
    this.options = {
      recordMouse: options.recordMouse !== false,
      recordKeyboard: options.recordKeyboard !== false,
      recordScroll: options.recordScroll !== false,
      recordResize: options.recordResize !== false,
      recordNavigation: options.recordNavigation !== false,
      recordFormInputs: options.recordFormInputs !== false,
      recordClicks: options.recordClicks !== false,
      maskSensitiveData: options.maskSensitiveData !== false,
      maskPatterns: options.maskPatterns || ['password', 'card', 'ssn', 'email'],
      logLevel: options.logLevel || 'info',
      ...options
    };
    
    this.sessionId = this.generateSessionId();
    this.records = [];
    this.isRecording = false;
    this.startTime = null;
    this.listeners = new Map();
    
    // 페이지 정보 저장
    this.pageInfo = {
      url: window.location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  // 세션 ID 생성
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 민감 정보 마스킹
  maskSensitiveData(value, fieldName = '') {
    if (!this.options.maskSensitiveData || !value) return value;
    
    const shouldMask = this.options.maskPatterns.some(pattern => 
      fieldName.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (shouldMask) {
      return '*'.repeat(Math.min(value.length, 8));
    }
    
    return value;
  }

  // 이벤트 기록
  recordEvent(event) {
    if (!this.isRecording) {
      console.debug('[SessionRecorder] 기록 중이 아니므로 이벤트 무시:', event.type);
      return;
    }

    try {
      const timestamp = Date.now() - this.startTime;
      const record = {
        ...event,
        sessionId: this.sessionId,
        timestamp,
        url: window.location.href,
        timestampAbsolute: Date.now()
      };

      this.records.push(record);
      
      // 로컬 스토리지에 저장
      this.saveToStorage(record);
      
      // 콘솔 로그
      if (this.options.logLevel === 'debug') {
        console.debug('[SessionRecorder] 이벤트 기록:', {
          type: record.type,
          target: record.target,
          timestamp: record.timestamp,
          totalRecords: this.records.length
        });
      }
    } catch (error) {
      console.error('[SessionRecorder] 이벤트 기록 중 오류:', error, event);
    }
  }

  // 로컬 스토리지에 저장
  saveToStorage(record) {
    try {
      const storageKey = `session_${this.sessionId}_${record.timestamp}`;
      localStorage.setItem(storageKey, JSON.stringify(record));
    } catch (error) {
      console.warn('[SessionRecorder] 로컬 스토리지 저장 실패:', error);
    }
  }

  // 마우스 이벤트 기록
  recordMouseEvents() {
    if (!this.options.recordMouse) return;

    // 클릭 이벤트
    if (this.options.recordClicks) {
      // 일반 클릭
      this.addListener('click', (event) => {
        this.recordEvent({
          type: 'click',
          x: event.clientX,
          y: event.clientY,
          target: this.getElementSelector(event.target),
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey
        });
      });

      // 더블클릭
      this.addListener('dblclick', (event) => {
        this.recordEvent({
          type: 'dblclick',
          x: event.clientX,
          y: event.clientY,
          target: this.getElementSelector(event.target),
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey
        });
      });

      // 우클릭 (contextmenu)
      this.addListener('contextmenu', (event) => {
        this.recordEvent({
          type: 'contextmenu',
          x: event.clientX,
          y: event.clientY,
          target: this.getElementSelector(event.target),
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey
        });
      });

      // 마우스 다운
      this.addListener('mousedown', (event) => {
        this.recordEvent({
          type: 'mousedown',
          x: event.clientX,
          y: event.clientY,
          target: this.getElementSelector(event.target),
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey
        });
      });

      // 마우스 업
      this.addListener('mouseup', (event) => {
        this.recordEvent({
          type: 'mouseup',
          x: event.clientX,
          y: event.clientY,
          target: this.getElementSelector(event.target),
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey
        });
      });
    }

    // 마우스 이동 (throttled)
    let mouseMoveTimeout;
    this.addListener('mousemove', (event) => {
      if (mouseMoveTimeout) return;
      
      mouseMoveTimeout = setTimeout(() => {
        this.recordEvent({
          type: 'mousemove',
          x: event.clientX,
          y: event.clientY
        });
        mouseMoveTimeout = null;
      }, 100); // 100ms throttle
    });
  }

  // 키보드 이벤트 기록
  recordKeyboardEvents() {
    if (!this.options.recordKeyboard) return;

    // 키 입력
    this.addListener('keydown', (event) => {
      this.recordEvent({
        type: 'keydown',
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        target: this.getElementSelector(event.target)
      });
    });

    // 키 해제
    this.addListener('keyup', (event) => {
      this.recordEvent({
        type: 'keyup',
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        target: this.getElementSelector(event.target)
      });
    });
  }

  // 스크롤 이벤트 기록
  recordScrollEvents() {
    if (!this.options.recordScroll) return;

    // 페이지 전체 스크롤 기록
    let pageScrollTimeout;
    this.addListener('scroll', (event) => {
      if (pageScrollTimeout) return;
      
      pageScrollTimeout = setTimeout(() => {
        // 페이지 스크롤
        this.recordEvent({
          type: 'scroll',
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          target: 'window',
          isPageScroll: true
        });
        pageScrollTimeout = null;
      }, 50);
    });

    // 모든 스크롤 가능한 요소의 스크롤 기록
    const recordElementScroll = (element) => {
      if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
        let elementScrollTimeout;
        const scrollHandler = (event) => {
          if (elementScrollTimeout) return;
          
          elementScrollTimeout = setTimeout(() => {
            this.recordEvent({
              type: 'scroll',
              scrollTop: element.scrollTop,
              scrollLeft: element.scrollLeft,
              scrollHeight: element.scrollHeight,
              scrollWidth: element.scrollWidth,
              clientHeight: element.clientHeight,
              clientWidth: element.clientWidth,
              target: this.getElementSelector(element),
              isPageScroll: false
            });
            elementScrollTimeout = null;
          }, 50);
        };
        
        element.addEventListener('scroll', scrollHandler, true);
        this.listeners.set(`scroll-${this.getElementSelector(element)}`, scrollHandler);
      }
    };

    // 현재 페이지의 모든 스크롤 가능한 요소 찾기
    const findScrollableElements = () => {
      const scrollableElements = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );

      let node;
      while (node = walker.nextNode()) {
        scrollableElements.push(node);
      }
      return scrollableElements;
    };

    // 초기 스크롤 가능한 요소들에 리스너 추가
    findScrollableElements().forEach(recordElementScroll);

    // DOM 변경 감지하여 새로운 스크롤 가능한 요소 추가
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            recordElementScroll(node);
            // 자식 요소들도 확인
            if (node.querySelectorAll) {
              node.querySelectorAll('*').forEach(recordElementScroll);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // wheel 이벤트 기록 (마우스 휠 스크롤)
    this.addListener('wheel', (event) => {
      this.recordEvent({
        type: 'wheel',
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        clientX: event.clientX,
        clientY: event.clientY,
        target: this.getElementSelector(event.target)
      });
    });
  }

  // 리사이즈 이벤트 기록
  recordResizeEvents() {
    if (!this.options.recordResize) return;

    let resizeTimeout;
    this.addListener('resize', (event) => {
      if (resizeTimeout) return;
      
      resizeTimeout = setTimeout(() => {
        this.recordEvent({
          type: 'resize',
          width: window.innerWidth,
          height: window.innerHeight
        });
        resizeTimeout = null;
      }, 100);
    });
  }

  // 폼 입력 이벤트 기록
  recordFormInputs() {
    if (!this.options.recordFormInputs) return;

    // 입력 변경
    this.addListener('input', (event) => {
      const target = event.target;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        this.recordEvent({
          type: 'input',
          value: this.maskSensitiveData(target.value, target.name || target.id),
          name: target.name || '',
          id: target.id || '',
          type: target.type || '',
          target: this.getElementSelector(target)
        });
      }
    });

    // 폼 제출
    this.addListener('submit', (event) => {
      const form = event.target;
      const formData = new FormData(form);
      const data = {};
      
      for (const [key, value] of formData.entries()) {
        data[key] = this.maskSensitiveData(value, key);
      }

      this.recordEvent({
        type: 'submit',
        formData: data,
        target: this.getElementSelector(form)
      });
    });

    // 포커스/블러
    this.addListener('focus', (event) => {
      this.recordEvent({
        type: 'focus',
        target: this.getElementSelector(event.target)
      });
    });

    this.addListener('blur', (event) => {
      this.recordEvent({
        type: 'blur',
        target: this.getElementSelector(event.target)
      });
    });
  }

  // 네비게이션 이벤트 기록
  recordNavigationEvents() {
    if (!this.options.recordNavigation) return;

    // 페이지 로드
    this.addListener('load', () => {
      this.recordEvent({
        type: 'page-load',
        url: window.location.href,
        title: document.title
      });
    });

    // 페이지 언로드
    this.addListener('beforeunload', () => {
      this.recordEvent({
        type: 'page-unload',
        url: window.location.href
      });
    });

    // URL 변경 감지 (SPA)
    let currentUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== currentUrl) {
        this.recordEvent({
          type: 'url-change',
          from: currentUrl,
          to: window.location.href
        });
        currentUrl = window.location.href;
      }
    }, 1000);
  }

  // 이벤트 리스너 추가
  addListener(eventType, handler) {
    const wrappedHandler = (event) => {
      if (this.isRecording) {
        handler(event);
      }
    };
    
    document.addEventListener(eventType, wrappedHandler, true);
    this.listeners.set(eventType, wrappedHandler);
  }

  // 요소 선택자 생성
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

    // 부모 요소들도 포함
    let parent = element.parentElement;
    let depth = 0;
    while (parent && parent !== document.documentElement && depth < 3) {
      if (parent.id) {
        selector = `${parent.tagName.toLowerCase()}#${parent.id} > ${selector}`;
        break;
      } else if (parent.className) {
        const classes = parent.className.split(' ').filter(c => c).slice(0, 2);
        if (classes.length > 0) {
          selector = `${parent.tagName.toLowerCase()}.${classes.join('.')} > ${selector}`;
        }
      }
      parent = parent.parentElement;
      depth++;
    }

    return selector;
  }

  // 기록 시작
  startRecording() {
    if (this.isRecording) {
      console.warn('[SessionRecorder] 이미 기록 중입니다.');
      return;
    }
    
    try {
      this.isRecording = true;
      this.startTime = Date.now();
      this.sessionId = this.generateSessionId();
      this.records = [];
      
      console.log('[SessionRecorder] 기록 시작 - 설정:', {
        recordMouse: this.options.recordMouse,
        recordKeyboard: this.options.recordKeyboard,
        recordScroll: this.options.recordScroll,
        recordResize: this.options.recordResize,
        recordNavigation: this.options.recordNavigation,
        recordFormInputs: this.options.recordFormInputs,
        recordClicks: this.options.recordClicks
      });
      
      this.recordMouseEvents();
      this.recordKeyboardEvents();
      this.recordScrollEvents();
      this.recordResizeEvents();
      this.recordFormInputs();
      this.recordNavigationEvents();
      
      console.log('[SessionRecorder] 세션 기록 시작:', this.sessionId);
      console.log('[SessionRecorder] 등록된 리스너 수:', this.listeners.size);
    } catch (error) {
      console.error('[SessionRecorder] 기록 시작 중 오류:', error);
      this.isRecording = false;
      throw error;
    }
  }

  // 기록 중지
  stopRecording() {
    if (!this.isRecording) {
      console.warn('[SessionRecorder] 기록 중이 아닙니다.');
      return [];
    }
    
    this.isRecording = false;
    
    // 모든 리스너 제거
    this.listeners.forEach((handler, eventType) => {
      document.removeEventListener(eventType, handler, true);
    });
    this.listeners.clear();
    
    // records 배열이 없으면 빈 배열로 초기화
    if (!this.records || !Array.isArray(this.records)) {
      this.records = [];
    }
    
    console.log('[SessionRecorder] 세션 기록 중지. 총 이벤트:', this.records.length);
    return this.records;
  }

  // 세션 저장
  saveSession(filename = null) {
    const sessionData = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: Date.now(),
      pageInfo: this.pageInfo,
      events: this.records,
      totalEvents: this.records.length
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `session_${this.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('[SessionRecorder] 세션 저장됨:', a.download);
  }

  // 기록 조회
  getRecords() {
    return this.records;
  }

  // 세션 정보 조회
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      isRecording: this.isRecording,
      totalEvents: this.records.length,
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      pageInfo: this.pageInfo
    };
  }

  // 모든 기록 삭제
  clearRecords() {
    this.records = [];
    this.sessionId = null;
    this.startTime = null;
    console.log('[SessionRecorder] 모든 기록 삭제됨');
  }
}

// 전역 객체로 노출
window.SessionRecorder = SessionRecorder; 
