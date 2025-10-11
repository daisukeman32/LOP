const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createMultiSizeIco() {
  console.log('🔄 適切なICOファイルを作成中...\n');

  const buildDir = path.join(__dirname, 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  const inputPng = path.join(__dirname, 'LPOicon.png');

  // 画像情報を取得
  const metadata = await sharp(inputPng).metadata();
  console.log(`📏 元画像サイズ: ${metadata.width}x${metadata.height}px`);

  // 必要なサイズを生成（Windows用）
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngFiles = [];

  console.log('\n🖼️ 各サイズのPNGを生成中...');
  for (const size of sizes) {
    const outputPath = path.join(__dirname, `temp_${size}.png`);
    await sharp(inputPng)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    pngFiles.push(outputPath);
    console.log(`  ✅ ${size}x${size}px`);
  }

  // png-to-icoを使用してICOファイルを作成
  console.log('\n🔧 ICOファイルに変換中...');
  const pngToIco = require('png-to-ico').default || require('png-to-ico');

  const icoBuffer = await pngToIco(pngFiles);

  // build/icon.icoに保存
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('✅ build/icon.ico を作成しました');

  // ルートにも保存
  fs.writeFileSync(path.join(__dirname, 'LPOicon.ico'), icoBuffer);
  console.log('✅ LPOicon.ico を作成しました');

  // 一時ファイルを削除
  console.log('\n🧹 一時ファイルをクリーンアップ中...');
  for (const file of pngFiles) {
    fs.unlinkSync(file);
  }

  console.log('\n✨ 完了！適切なマルチサイズICOファイルが作成されました');
}

createMultiSizeIco().catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
