const rcedit = require('rcedit');
const path = require('path');

exports.default = async function(context) {
  // Windowsビルドの場合のみ実行
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  console.log('\n🔧 [afterPack] EXEファイルにアイコンを設定中...\n');

  const exePath = path.join(context.appOutDir, 'LOP.exe');
  const iconPath = path.join(context.packager.projectDir, 'LPOicon.ico');

  try {
    await rcedit(exePath, { icon: iconPath });
    console.log('✅ アイコンを設定しました:', exePath);
  } catch (err) {
    console.error('❌ アイコン設定エラー:', err);
  }
};
