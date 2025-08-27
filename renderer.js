const { ipcRenderer } = require('electron');
const path = require('path');

let selectedVideoPath = null;
let videoDurationSeconds = 0;

// DOM要素の取得
const selectFileBtn = document.getElementById('selectFileBtn');
const fileName = document.getElementById('fileName');
const loopCount = document.getElementById('loopCount');
const generateBtn = document.getElementById('generateBtn');
const progressSection = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const videoInfo = document.getElementById('videoInfo');
const videoDuration = document.getElementById('videoDuration');
const previewVideo = document.getElementById('previewVideo');
const totalInfo = document.getElementById('totalInfo');
const totalDuration = document.getElementById('totalDuration');

// ファイル選択ボタンのクリック処理
selectFileBtn.addEventListener('click', async () => {
    try {
        const filePath = await ipcRenderer.invoke('select-video-file');
        if (filePath) {
            selectedVideoPath = filePath;
            loadVideoInfo(filePath);
        }
    } catch (error) {
        showError('ファイル選択エラー: ' + error.message);
    }
});

// 動画情報を読み込む関数
function loadVideoInfo(filePath) {
    fileName.textContent = path.basename(filePath);
    
    // プレビュー動画を設定
    previewVideo.src = `file://${filePath}`;
    
    // 動画のメタデータ読み込み完了時
    previewVideo.onloadedmetadata = () => {
        videoDurationSeconds = previewVideo.duration;
        const formattedDuration = formatDuration(videoDurationSeconds);
        videoDuration.textContent = formattedDuration;
        
        // 動画情報を表示
        videoInfo.style.display = 'block';
        generateBtn.disabled = false;
        
        // 総再生時間を更新
        updateTotalDuration();
    };
    
    // エラーハンドリング
    previewVideo.onerror = () => {
        showError('動画ファイルの読み込みに失敗しました');
        resetVideoInfo();
    };
}

// 時間フォーマット関数
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 総再生時間を更新
function updateTotalDuration() {
    if (videoDurationSeconds > 0) {
        const loopValue = parseInt(loopCount.value) || 1;
        const totalSeconds = videoDurationSeconds * loopValue * 2; // 正再生 + 逆再生
        totalDuration.textContent = formatDuration(totalSeconds);
        totalInfo.style.display = 'block';
    }
}

// 動画情報をリセット
function resetVideoInfo() {
    videoInfo.style.display = 'none';
    totalInfo.style.display = 'none';
    generateBtn.disabled = true;
    selectedVideoPath = null;
    videoDurationSeconds = 0;
}

// ループ回数変更時の処理
loopCount.addEventListener('change', updateTotalDuration);

// 出力ボタンのクリック処理
generateBtn.addEventListener('click', async () => {
    if (!selectedVideoPath) {
        showError('動画ファイルが選択されていません');
        return;
    }

    try {
        // 保存先選択
        const outputPath = await ipcRenderer.invoke('select-output-path');
        if (!outputPath) return;

        // UI状態の更新
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="icon">⏳</span><span>処理中...</span>';
        progressSection.style.display = 'block';
        updateProgress(0);

        // ループ動画生成開始
        const result = await ipcRenderer.invoke('generate-loop', {
            inputPath: selectedVideoPath,
            loopCount: parseInt(loopCount.value),
            outputPath: outputPath
        });

        if (result.success) {
            showSuccess(`完了: ${path.basename(outputPath)}`);
            updateProgress(100);
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        showError('出力エラー: ' + error.message);
        updateProgress(0);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="icon">🎬</span><span>ループ動画を出力</span>';
        setTimeout(() => {
            progressSection.style.display = 'none';
        }, 3000);
    }
});

// プログレス更新のリスナー
ipcRenderer.on('progress-update', (event, percent) => {
    updateProgress(Math.round(percent));
});

// プログレス表示の更新
function updateProgress(percent) {
    progressFill.style.width = percent + '%';
    progressText.textContent = percent + '%';
}

// 成功メッセージ表示
function showSuccess(message) {
    const existing = document.querySelector('.success');
    if (existing) existing.remove();
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    document.querySelector('.app').appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

// エラーメッセージ表示
function showError(message) {
    const existing = document.querySelector('.error');
    if (existing) existing.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.querySelector('.app').appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('るーぷツール準備完了');
});