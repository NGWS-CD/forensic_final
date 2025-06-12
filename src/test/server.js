const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// dist 폴더 정적 서빙 추가
app.use('/dist', express.static(path.join(__dirname, '../../dist')));

// src 폴더 정적 서빙 추가
app.use('/src', express.static(path.join(__dirname, '..')));

// 기존 정적 파일 서빙
app.use(express.static(path.join(__dirname)));

// API 엔드포인트
app.post('/api/test', express.json(), (req, res) => {
    console.log('API 요청 수신:', req.body);
    res.json({ status: 'success' });
});

// 테스트 페이지 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`테스트 서버가 http://localhost:${port} 에서 실행 중입니다.`);
}); 
