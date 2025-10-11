const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

console.log('🔄 PNGをICOに変換中...\n');

// buildディレクトリが存在しない場合は作成
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const pngPath = path.join(__dirname, 'LPOicon.png');
pngToIco(pngPath)
  .then(buf => {
    // buildディレクトリにicon.icoを作成
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), buf);
    console.log('✅ build/icon.ico を作成しました');

    // ルートディレクトリにもLPOicon.icoを作成
    fs.writeFileSync('LPOicon.ico', buf);
    console.log('✅ LPOicon.ico を作成しました');
  })
  .catch(err => {
    console.error('❌ エラー:', err);
    process.exit(1);
  });
