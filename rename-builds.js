const fs = require('fs');
const path = require('path');

console.log('\n📝 ビルドファイル名を変更中...\n');

const distDir = path.join(__dirname, 'dist');

// リネーム対象ファイルのマッピング
const renameMap = {
  'LOP-2.0.0-Mac-x64.dmg': 'LOP-2.0.0-Mac-Intel.dmg',
  'LOP-2.0.0-Mac-x64.dmg.blockmap': 'LOP-2.0.0-Mac-Intel.dmg.blockmap',
  'LOP-2.0.0-Mac-x64.zip': 'LOP-2.0.0-Mac-Intel.zip',
  'LOP-2.0.0-Mac-x64.zip.blockmap': 'LOP-2.0.0-Mac-Intel.zip.blockmap',
  'LOP-2.0.0-Mac-arm64.dmg': 'LOP-2.0.0-Mac-Apple_s.dmg',
  'LOP-2.0.0-Mac-arm64.dmg.blockmap': 'LOP-2.0.0-Mac-Apple_s.dmg.blockmap',
  'LOP-2.0.0-Mac-arm64.zip': 'LOP-2.0.0-Mac-Apple_s.zip',
  'LOP-2.0.0-Mac-arm64.zip.blockmap': 'LOP-2.0.0-Mac-Apple_s.zip.blockmap'
};

// 各ファイルをリネーム
for (const [oldName, newName] of Object.entries(renameMap)) {
  const oldPath = path.join(distDir, oldName);
  const newPath = path.join(distDir, newName);

  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`✅ ${oldName} → ${newName}`);
  }
}

console.log('\n✅ ファイル名変更完了！');
