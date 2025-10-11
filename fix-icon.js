const rcedit = require('rcedit');
const path = require('path');

async function fixIcon() {
  console.log('🔧 EXEファイルにアイコンを強制設定中...\n');

  const exePath = path.join(__dirname, 'dist', 'win-unpacked', 'LOP.exe');
  const iconPath = path.join(__dirname, 'LPOicon.ico');

  try {
    await rcedit(exePath, { icon: iconPath });
    console.log('✅ アイコンを設定しました:', exePath);
  } catch (err) {
    console.error('❌ エラー:', err);
    process.exit(1);
  }
}

fixIcon();
