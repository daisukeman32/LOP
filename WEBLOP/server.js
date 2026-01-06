// WEBLOP Development Server
// SharedArrayBuffer を有効にするための Cross-Origin-Isolation ヘッダー付きサーバー

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// MIMEタイプ
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  // URLパス
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  // 拡張子
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // ファイルを読み込み
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }

    // Cross-Origin-Isolation ヘッダーを設定
    // SharedArrayBuffer を有効にするために必要
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                                                        ║');
  console.log('║   🎬 WEBLOP - Web Loop Video Creator                   ║');
  console.log('║                                                        ║');
  console.log('║   サーバーが起動しました                               ║');
  console.log(`║   http://localhost:${PORT}                               ║`);
  console.log('║                                                        ║');
  console.log('║   Ctrl+C で終了                                        ║');
  console.log('║                                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
});
