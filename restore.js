const fs = require('fs');
const path = require('path');

console.log('\n🔄 元のファイルを復元中...\n');

const filesToRestore = ['main.js', 'renderer.js'];

filesToRestore.forEach(file => {
    const filePath = path.join(__dirname, file);
    const backupPath = path.join(__dirname, file + '.original');

    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
        fs.unlinkSync(backupPath);
        console.log(`✅ ${file} を元に戻しました`);
    }
});

console.log('\n✅ 復元完了！');
