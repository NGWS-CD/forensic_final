// 세션 재생 모듈 (src/replay.js)

class SessionReplayer {
  constructor(options = {}) {
    this.options = {
      speed: options.speed || 1.0,
      autoStart: options.autoStart || false,
      showProgress: options.showProgress !== false,
      logLevel: options.logLevel || 'info',
      ...options
    };
    
    this.sessionData = null;
    this.events = [];
    this.isReplaying = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.replaySpeed = this.options.speed;
    this.startTime = null;
    this.progressCallback = null;
    
    // 재생 상태 표시 요소
    this.progressElement = null;
    this.createProgressElement();
  }

  // 진행률 표시 요소 생성
  createProgressElement() {
    if (!this.options.showProgress) return;
    
    this.progressElement = document.createElement('div');
    this.progressElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      min-width: 200px;
    `;
    this.progressElement.innerHTML = '재생 준비됨';
    document.body.appendChild(this.progressElement);
  }

  // 진행률 업데이트
  updateProgress() {
    if (!this.progressElement) return;
    
    const progress = this.events.length > 0 ? (this.currentIndex / this.events.length * 100).toFixed(1) : 0;
    const currentEvent = this.events[this.currentIndex];
    const timeInfo = currentEvent ? `(${Math.round(currentEvent.timestamp / 1000)}s)` : '';
    
    this.progressElement.innerHTML = `
      <div>재생 중... ${progress}%</div>
      <div>이벤트: ${this.currentIndex + 1}/${this.events.length}</div>
      <div>속도: ${this.replaySpeed}x ${timeInfo}</div>
      <div>상태: ${this.isPaused ? '일시정지' : '재생중'}</div>
    `;
  }

  // 세션 데이터 로드
  loadSession(sessionData) {
    if (!sessionData) {
      console.error('[SessionReplayer] 세션 데이터가 없습니다.');
      return false;
    }
    
    if (typeof sessionData === 'string') {
      try {
        sessionData = JSON.parse(sessionData);
      } catch (error) {
        console.error('[SessionReplayer] 세션 데이터 파싱 실패:', error);
        return false;
      }
    }
    
    // 세션 데이터 구조 검증
    if (!sessionData.events || !Array.isArray(sessionData.events)) {
      console.error('[SessionReplayer] 유효하지 않은 세션 데이터: events 배열이 없습니다.');
      return false;
    }
    
    this.sessionData = sessionData;
    this.events = sessionData.events;
    this.currentIndex = 0;
    
    console.log('[SessionReplayer] 세션 로드됨:', {
      sessionId: sessionData.sessionId,
      totalEvents: this.events.length,
      duration: sessionData.endTime ? sessionData.endTime - sessionData.startTime : 'unknown'
    });
    
    return true;
  }

  // 파일에서 세션 로드
  loadSessionFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const sessionData = JSON.parse(e.target.result);
          const success = this.loadSession(sessionData);
          if (success) {
            resolve(sessionData);
          } else {
            reject(new Error('세션 로드 실패'));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsText(file);
    });
  }

  // 재생 시작
  startReplay(speed = null) {
    if (this.isReplaying) {
      console.warn('[SessionReplayer] 이미 재생 중입니다.');
      return;
    }
    
    if (this.events.length === 0) {
      console.warn('[SessionReplayer] 재생할 이벤트가 없습니다.');
      return;
    }
    
    if (speed !== null) {
      this.replaySpeed = speed;
    }
    
    this.isReplaying = true;
    this.isPaused = false;
    this.currentIndex = 0;
    this.startTime = Date.now();
    
    console.log('[SessionReplayer] 재생 시작:', {
      totalEvents: this.events.length,
      speed: this.replaySpeed
    });
    
    this.updateProgress();
    this.replayNext();
  }

  // 재생 중지
  stopReplay() {
    this.isReplaying = false;
    this.isPaused = false;
    this.currentIndex = 0;
    
    if (this.progressElement) {
      this.progressElement.innerHTML = '재생 중지됨';
    }
    
    console.log('[SessionReplayer] 재생 중지');
  }

  // 재생 일시정지/재개
  togglePause() {
    if (!this.isReplaying) return;
    
    this.isPaused = !this.isPaused;
    
    if (!this.isPaused) {
      this.replayNext();
    }
    
    this.updateProgress();
    console.log('[SessionReplayer] 재생', this.isPaused ? '일시정지' : '재개');
  }

  // 재생 속도 변경
  setSpeed(speed) {
    this.replaySpeed = speed;
    this.updateProgress();
    console.log('[SessionReplayer] 재생 속도 변경:', speed);
  }

  // 다음 이벤트 재생
  replayNext() {
    // 안전성 검증
    if (!this.isReplaying || this.isPaused) {
      return;
    }
    
    if (!this.events || !Array.isArray(this.events)) {
      console.error('[SessionReplayer] 이벤트 배열이 유효하지 않습니다.');
      this.stopReplay();
      return;
    }
    
    if (this.currentIndex >= this.events.length) {
      this.onReplayComplete();
      return;
    }

    const event = this.events[this.currentIndex];
    if (!event) {
      console.warn('[SessionReplayer] 유효하지 않은 이벤트:', this.currentIndex);
      this.currentIndex++;
      this.replayNext();
      return;
    }
    
    this.replayEvent(event);
    this.currentIndex++;
    this.updateProgress();

    // 다음 이벤트까지 대기
    const nextEvent = this.events[this.currentIndex];
    if (nextEvent && event.timestamp) {
      const delay = Math.max(0, (nextEvent.timestamp - event.timestamp) / this.replaySpeed);
      setTimeout(() => {
        if (this.isReplaying && !this.isPaused) {
          this.replayNext();
        }
      }, delay);
    } else {
      this.onReplayComplete();
    }
  }

  // 이벤트 재생
  replayEvent(event) {
    try {
      switch (event.type) {
        case 'click':
          this.replayClick(event);
          break;
        case 'dblclick':
          this.replayDoubleClick(event);
          break;
        case 'contextmenu':
          this.replayContextMenu(event);
          break;
        case 'mousedown':
          this.replayMouseDown(event);
          break;
        case 'mouseup':
          this.replayMouseUp(event);
          break;
        case 'input':
          this.replayInput(event);
          break;
        case 'keydown':
          this.replayKeydown(event);
          break;
        case 'keyup':
          this.replayKeyup(event);
          break;
        case 'scroll':
          this.replayScroll(event);
          break;
        case 'mousemove':
          this.replayMouseMove(event);
          break;
        case 'wheel':
          this.replayWheel(event);
          break;
        case 'submit':
          this.replaySubmit(event);
          break;
        case 'focus':
          this.replayFocus(event);
          break;
        case 'blur':
          this.replayBlur(event);
          break;
        case 'resize':
          this.replayResize(event);
          break;
        case 'page-load':
          this.replayPageLoad(event);
          break;
        case 'url-change':
          this.replayUrlChange(event);
          break;
        default:
          if (this.options.logLevel === 'debug') {
            console.log('[SessionReplayer] 미지원 이벤트 타입:', event.type);
          }
      }
    } catch (error) {
      console.warn('[SessionReplayer] 이벤트 재생 실패:', event, error);
    }
  }

  // 요소 찾기
  findElement(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      console.warn('[SessionReplayer] 요소 찾기 실패:', selector, error);
      return null;
    }
  }

  // 클릭 재생
  replayClick(event) {
    const element = this.findElement(event.target);
    if (element) {
      // 마우스 이벤트 시뮬레이션
      const mouseEvent = new MouseEvent('click', {
        clientX: event.x,
        clientY: event.y,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(mouseEvent);
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 클릭 재생:', event.target);
      }
    }
  }

  // 더블클릭 재생
  replayDoubleClick(event) {
    const element = this.findElement(event.target);
    if (element) {
      const mouseEvent = new MouseEvent('dblclick', {
        clientX: event.x,
        clientY: event.y,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(mouseEvent);
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 더블클릭 재생:', event.target);
      }
    }
  }

  // 우클릭 재생
  replayContextMenu(event) {
    const element = this.findElement(event.target);
    if (element) {
      const mouseEvent = new MouseEvent('contextmenu', {
        clientX: event.x,
        clientY: event.y,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(mouseEvent);
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 우클릭 재생:', event.target);
      }
    }
  }

  // 마우스 다운 재생
  replayMouseDown(event) {
    const element = this.findElement(event.target);
    if (element) {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: event.x,
        clientY: event.y,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(mouseEvent);
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 마우스 다운 재생:', event.target);
      }
    }
  }

  // 마우스 업 재생
  replayMouseUp(event) {
    const element = this.findElement(event.target);
    if (element) {
      const mouseEvent = new MouseEvent('mouseup', {
        clientX: event.x,
        clientY: event.y,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(mouseEvent);
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 마우스 업 재생:', event.target);
      }
    }
  }

  // 입력 재생
  replayInput(event) {
    const element = this.findElement(event.target);
    if (element && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
      element.value = event.value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 입력 재생:', event.target, event.value);
      }
    }
  }

  // 키 입력 재생
  replayKeydown(event) {
    const element = this.findElement(event.target);
    if (element) {
      // 특수 키 처리
      if (event.key === 'Enter') {
        if (element.tagName === 'FORM') {
          element.dispatchEvent(new Event('submit', { bubbles: true }));
        } else if (element.tagName === 'TEXTAREA') {
          // textarea에서 Enter는 줄바꿈
          const currentValue = element.value || '';
          const cursorPos = element.selectionStart || currentValue.length;
          const newValue = currentValue.slice(0, cursorPos) + '\n' + currentValue.slice(cursorPos);
          element.value = newValue;
          element.selectionStart = element.selectionEnd = cursorPos + 1;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else if (event.key === 'Backspace') {
        // Backspace 처리
        if (element.value && element.value.length > 0) {
          const currentValue = element.value;
          const cursorPos = element.selectionStart || currentValue.length;
          if (cursorPos > 0) {
            const newValue = currentValue.slice(0, cursorPos - 1) + currentValue.slice(cursorPos);
            element.value = newValue;
            element.selectionStart = element.selectionEnd = cursorPos - 1;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      } else if (event.key === 'Tab') {
        // Tab 키는 포커스 이동을 시뮬레이션
        const focusableElements = document.querySelectorAll('input, textarea, select, button, [tabindex]:not([tabindex="-1"])');
        const currentIndex = Array.from(focusableElements).indexOf(element);
        const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
        
        if (nextIndex >= 0 && nextIndex < focusableElements.length) {
          focusableElements[nextIndex].focus();
        }
      } else if (event.key.length === 1) {
        // 일반 문자 입력
        if (['INPUT', 'TEXTAREA'].includes(element.tagName)) {
          const currentValue = element.value || '';
          const cursorPos = element.selectionStart || currentValue.length;
          const newValue = currentValue.slice(0, cursorPos) + event.key + currentValue.slice(cursorPos);
          element.value = newValue;
          element.selectionStart = element.selectionEnd = cursorPos + 1;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      
      // 키보드 이벤트도 함께 발생
      const keyEvent = new KeyboardEvent('keydown', {
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(keyEvent);
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 키 입력 재생:', event.key, '->', element.value);
      }
    }
  }

  // 키 해제 재생
  replayKeyup(event) {
    const element = this.findElement(event.target);
    if (element) {
      const keyEvent = new KeyboardEvent('keyup', {
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(keyEvent);
    }
  }

  // 스크롤 재생
  replayScroll(event) {
    if (event.isPageScroll) {
      // 페이지 전체 스크롤
      if (event.scrollX !== undefined && event.scrollY !== undefined) {
        window.scrollTo({
          left: event.scrollX,
          top: event.scrollY,
          behavior: 'auto'
        });
        
        if (this.options.logLevel === 'debug') {
          console.log('[SessionReplayer] 페이지 스크롤 재생:', event.scrollX, event.scrollY);
        }
      }
    } else {
      // 특정 요소 스크롤
      const element = this.findElement(event.target);
      if (element) {
        if (event.scrollTop !== undefined) {
          element.scrollTop = event.scrollTop;
        }
        if (event.scrollLeft !== undefined) {
          element.scrollLeft = event.scrollLeft;
        }
        
        if (this.options.logLevel === 'debug') {
          console.log('[SessionReplayer] 요소 스크롤 재생:', event.target, 'scrollTop:', event.scrollTop, 'scrollLeft:', event.scrollLeft);
        }
      }
    }
  }

  // 마우스 이동 재생
  replayMouseMove(event) {
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: event.x,
      clientY: event.y,
      bubbles: true
    });
    document.dispatchEvent(mouseEvent);
  }

  // 마우스 휠 재생
  replayWheel(event) {
    // wheel 이벤트를 실제로 발생시켜 스크롤이 작동하도록 함
    const wheelEvent = new WheelEvent('wheel', {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      clientX: event.clientX,
      clientY: event.clientY,
      bubbles: true,
      cancelable: true
    });
    
    // 특정 요소에 wheel 이벤트를 발생시킴
    const target = event.target ? this.findElement(event.target) : document;
    if (target) {
      // 이벤트를 발생시키고 기본 동작이 차단되지 않도록 함
      const defaultPrevented = !target.dispatchEvent(wheelEvent);
      
      // 기본 동작이 차단된 경우 수동으로 스크롤 처리
      if (defaultPrevented) {
        if (target === document || target === document.documentElement || target === document.body) {
          // 페이지 스크롤
          window.scrollBy({
            left: event.deltaX,
            top: event.deltaY,
            behavior: 'auto'
          });
        } else {
          // 요소 스크롤
          target.scrollTop += event.deltaY;
          target.scrollLeft += event.deltaX;
        }
      }
    } else {
      // 타겟을 찾을 수 없는 경우 페이지에 이벤트 발생
      document.dispatchEvent(wheelEvent);
    }
    
    if (this.options.logLevel === 'debug') {
      console.log('[SessionReplayer] 휠 이벤트 재생:', event.deltaX, event.deltaY, 'target:', event.target);
    }
  }

  // 폼 제출 재생
  replaySubmit(event) {
    const element = this.findElement(event.target);
    if (element && element.tagName === 'FORM') {
      element.dispatchEvent(new Event('submit', { bubbles: true }));
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 폼 제출 재생:', event.target);
      }
    }
  }

  // 포커스 재생
  replayFocus(event) {
    const element = this.findElement(event.target);
    if (element) {
      element.focus();
      
      if (this.options.logLevel === 'debug') {
        console.log('[SessionReplayer] 포커스 재생:', event.target);
      }
    }
  }

  // 블러 재생
  replayBlur(event) {
    const element = this.findElement(event.target);
    if (element) {
      element.blur();
    }
  }

  // 리사이즈 재생
  replayResize(event) {
    // 브라우저 창 크기 변경은 시뮬레이션하기 어려우므로 로그만 출력
    if (this.options.logLevel === 'debug') {
      console.log('[SessionReplayer] 리사이즈 재생:', event.width, event.height);
    }
  }

  // 페이지 로드 재생
  replayPageLoad(event) {
    if (this.options.logLevel === 'debug') {
      console.log('[SessionReplayer] 페이지 로드 재생:', event.url);
    }
  }

  // URL 변경 재생
  replayUrlChange(event) {
    if (this.options.logLevel === 'debug') {
      console.log('[SessionReplayer] URL 변경 재생:', event.from, '->', event.to);
    }
  }

  // 재생 완료 처리
  onReplayComplete() {
    this.isReplaying = false;
    this.isPaused = false;
    
    if (this.progressElement) {
      this.progressElement.innerHTML = '재생 완료';
      setTimeout(() => {
        if (this.progressElement) {
          this.progressElement.style.display = 'none';
        }
      }, 3000);
    }
    
    console.log('[SessionReplayer] 재생 완료');
    
    if (this.progressCallback) {
      this.progressCallback('complete');
    }
  }

  // 진행률 콜백 설정
  onProgress(callback) {
    this.progressCallback = callback;
  }

  // 재생 상태 조회
  getReplayStatus() {
    return {
      isReplaying: this.isReplaying,
      isPaused: this.isPaused,
      currentIndex: this.currentIndex,
      totalEvents: this.events.length,
      progress: this.events.length > 0 ? (this.currentIndex / this.events.length * 100) : 0,
      speed: this.replaySpeed,
      sessionData: this.sessionData
    };
  }

  // 특정 이벤트로 점프
  jumpToEvent(index) {
    if (index >= 0 && index < this.events.length) {
      this.currentIndex = index;
      this.updateProgress();
      console.log('[SessionReplayer] 이벤트로 점프:', index);
    }
  }

  // 진행률로 점프
  jumpToProgress(percentage) {
    const index = Math.floor((percentage / 100) * this.events.length);
    this.jumpToEvent(index);
  }

  // 진행률 표시 요소 제거
  destroy() {
    if (this.progressElement) {
      document.body.removeChild(this.progressElement);
      this.progressElement = null;
    }
  }
}

// 전역 객체로 노출
window.SessionReplayer = SessionReplayer; 
