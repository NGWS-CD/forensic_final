// 네트워크 요청 감지 모듈 (src/core/network.js)

class NetworkTracker {
  constructor(options = {}) {
    this.options = {
      maskPatterns: options.maskPatterns || ['card', 'password'],
      logLevel: options.logLevel || 'info',
      ...options
    };
    
    this.records = [];
    this.originalFetch = window.fetch;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
  }

  // 민감 정보 마스킹
  maskSensitiveData(data, contentType) {
    if (!data) return data;

    try {
      // JSON 데이터 처리
      if (contentType?.includes('application/json')) {
        const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
        const maskedData = this.maskObject(jsonData);
        return JSON.stringify(maskedData);
      }

      // Form 데이터 처리
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(data);
        for (const [key, value] of params.entries()) {
          if (this.isSensitiveField(key)) {
            params.set(key, this.maskValue(value));
          }
        }
        return params.toString();
      }

      // 일반 텍스트 데이터 처리
      if (typeof data === 'string') {
        return this.maskText(data);
      }

      return data;
    } catch (error) {
      console.warn('[NetworkTracker] 데이터 마스킹 중 오류:', error);
      return data;
    }
  }

  maskObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const masked = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        masked[key] = this.maskValue(value);
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskObject(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  maskValue(value) {
    if (!value) return value;
    return '*'.repeat(Math.min(value.length, 8));
  }

  maskText(text) {
    return text.replace(
      new RegExp(this.options.maskPatterns.join('|'), 'gi'),
      match => '*'.repeat(Math.min(match.length, 8))
    );
  }

  isSensitiveField(fieldName) {
    return this.options.maskPatterns.some(pattern => 
      fieldName.toLowerCase().includes(pattern.toLowerCase())
    );
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
    console.log(`[NETWORK RECORD] ${JSON.stringify(record)}`);
    
    // 서버로 전송 또는 로컬 저장
    this.saveRecord(record);
  }

  // 기록 저장 구현
  async saveRecord(record) {
    try {
      // 민감한 데이터 마스킹
      const maskedRecord = {
        ...record,
        body: this.maskSensitiveData(record.body, record.headers['content-type'])
      };

      // 로컬 스토리지에 저장
      const storageKey = `network_${record.timestamp}`;
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
          console.warn('[NetworkTracker] 서버 저장 실패:', await response.text());
        }
      }

      // 로그 레벨에 따른 콘솔 출력
      if (this.options.logLevel === 'debug') {
        console.debug('[NetworkTracker] 기록 저장:', maskedRecord);
      } else if (this.options.logLevel === 'info') {
        console.info('[NetworkTracker] 요청 감지:', {
          type: maskedRecord.type,
          url: maskedRecord.url,
          method: maskedRecord.method,
          timestamp: maskedRecord.timestamp
        });
      }
    } catch (error) {
      console.error('[NetworkTracker] 기록 저장 중 오류:', error);
    }
  }

  // Fetch 요청 가로채기
  interceptFetch() {
    window.fetch = async (resource, init = {}) => {
      const url = resource.url || resource;
      const method = init.method || 'GET';
      const headers = init.headers || {};
      const contentType = headers['Content-Type'] || headers['content-type'];
      
      let body = init.body;
      if (body) {
        body = this.maskSensitiveData(body, contentType);
      }

      this.record({
        type: 'fetch',
        url,
        method,
        headers: {
          referer: headers.referer,
          origin: headers.origin,
          'content-type': contentType
        },
        body,
        timestamp: Date.now()
      });

      return this.originalFetch.call(window, resource, init);
    };
  }

  // XMLHttpRequest 가로채기
  interceptXHR() {
    XMLHttpRequest.prototype.open = function(method, url) {
      this._method = method;
      this._url = url;
      return this.originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      const headers = {};
      ['Content-Type', 'Referer', 'Origin'].forEach(header => {
        const value = this.getRequestHeader(header);
        if (value) headers[header.toLowerCase()] = value;
      });

      if (body) {
        body = this.maskSensitiveData(body, headers['content-type']);
      }

      this.record({
        type: 'xhr',
        url: this._url,
        method: this._method,
        headers,
        body,
        timestamp: Date.now()
      });

      return this.originalXHRSend.apply(this, arguments);
    };
  }

  // Puppeteer 요청 가로채기 설정
  async setupPuppeteerInterception(page) {
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      const url = request.url();
      const method = request.method();
      const headers = request.headers();
      const postData = request.postData();
      
      let maskedData = postData;
      if (postData) {
        maskedData = this.maskSensitiveData(
          postData, 
          headers['content-type']
        );
      }

      this.record({
        type: 'puppeteer-request',
        url,
        method,
        headers: {
          referer: headers.referer,
          origin: headers.origin,
          'content-type': headers['content-type']
        },
        body: maskedData,
        timestamp: Date.now()
      });

      request.continue();
    });
  }

  // 모든 감지 시작
  start() {
    this.interceptFetch();
    this.interceptXHR();
  }

  // 모든 감지 중지
  stop() {
    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXHROpen;
    XMLHttpRequest.prototype.send = this.originalXHRSend;
  }

  // 기록 조회
  getRecords() {
    return this.records;
  }
}

export default NetworkTracker; 
