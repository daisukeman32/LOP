const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

console.log('🔒 コード難読化を開始...\n');

// 難読化設定（強力だが動作に影響しない設定）
const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: true,
    shuffleStringArray: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

// 難読化対象ファイル
const filesToObfuscate = ['main.js', 'renderer.js'];

// 各ファイルを難読化（バックアップ→難読化→置き換え）
filesToObfuscate.forEach(file => {
    console.log(`📄 ${file} を難読化中...`);

    const filePath = path.join(__dirname, file);
    const backupPath = path.join(__dirname, file + '.original');

    // 元のファイルをバックアップ
    fs.copyFileSync(filePath, backupPath);

    // ファイルを読み込み
    const code = fs.readFileSync(filePath, 'utf8');

    // 難読化を実行
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, obfuscationOptions).getObfuscatedCode();

    // 難読化されたコードで置き換え
    fs.writeFileSync(filePath, obfuscatedCode, 'utf8');

    console.log(`✅ ${file} を難読化済みファイルに置き換えました`);
    console.log(`💾 元のファイルは ${file}.original にバックアップされています\n`);
});

console.log('✅ 難読化完了！ビルド後は自動的に元に戻ります');
