const { ipcRenderer } = require('electron');
const path = require('path');

let selectedVideoPath = null;
let videoDurationSeconds = 0;

// バッチ処理用の変数
let selectedFiles = [];
let isBatchMode = false;

// ループモードの変数
let isReverseMode = true; // デフォルトはReverse

// DOM要素の取得
const selectFileBtn = document.getElementById('selectFileBtn');
const selectMultipleBtn = document.getElementById('selectMultipleBtn');
const fileName = document.getElementById('fileName');
const loopCount = document.getElementById('loopCount');
const generateBtn = document.getElementById('generateBtn');
const generateBtnText = document.getElementById('generateBtnText');
const outputNoteText = document.getElementById('outputNoteText');
const progressSection = document.getElementById('progress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressLabel = document.getElementById('progressLabel');
const videoInfo = document.getElementById('videoInfo');
const videoDuration = document.getElementById('videoDuration');
const previewVideo = document.getElementById('previewVideo');
const totalInfo = document.getElementById('totalInfo');
const totalDuration = document.getElementById('totalDuration');
const randomSpeed = document.getElementById('randomSpeed');
const speedControls = document.getElementById('speedControls');
const minSpeed = document.getElementById('minSpeed');
const maxSpeed = document.getElementById('maxSpeed');
const minSpeedValue = document.getElementById('minSpeedValue');
const maxSpeedValue = document.getElementById('maxSpeedValue');

// バッチ処理用DOM要素
const fileList = document.getElementById('fileList');
const fileListItems = document.getElementById('fileListItems');
const fileCount = document.querySelector('.file-count');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const batchProgress = document.getElementById('batchProgress');
const batchProgressText = document.getElementById('batchProgressText');

// モードボタン
const modeReverse = document.getElementById('modeReverse');
const modeForward = document.getElementById('modeForward');

// ファイル選択ボタンのクリック処理
selectFileBtn.addEventListener('click', async () => {
    try {
        const filePath = await ipcRenderer.invoke('select-video-file');
        if (filePath) {
            isBatchMode = false;
            selectedVideoPath = filePath;
            selectedFiles = [];
            fileList.style.display = 'none';
            loadVideoInfo(filePath);
            updateButtonText();
        }
    } catch (error) {
        showError('ファイル選択エラー: ' + error.message);
    }
});

// 複数ファイル選択ボタンのクリック処理
selectMultipleBtn.addEventListener('click', async () => {
    try {
        const filePaths = await ipcRenderer.invoke('select-multiple-video-files');
        if (filePaths && filePaths.length > 0) {
            isBatchMode = true;
            selectedVideoPath = null;
            videoInfo.style.display = 'none';
            totalInfo.style.display = 'none';

            // 累積追加：重複を除外して既存のリストに追加
            const newFiles = filePaths.filter(fp => !selectedFiles.includes(fp));
            selectedFiles = [...selectedFiles, ...newFiles];

            renderFileList();
            generateBtn.disabled = false;
            updateButtonText();

            // 追加されたファイル数を通知
            if (newFiles.length > 0) {
                showSuccess(`${newFiles.length}個のファイルを追加しました（合計: ${selectedFiles.length}個）`);
            } else {
                showError('すべてのファイルは既に選択されています');
            }
        }
    } catch (error) {
        showError('ファイル選択エラー: ' + error.message);
    }
});

// ファイルリストクリアボタン
clearFilesBtn.addEventListener('click', () => {
    selectedFiles = [];
    isBatchMode = false;
    fileList.style.display = 'none';
    generateBtn.disabled = true;
    updateButtonText();
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
        
        if (randomSpeed.checked) {
            // ランダム速度の場合は平均速度で概算
            const minSpd = parseFloat(minSpeed.value);
            const maxSpd = parseFloat(maxSpeed.value);
            const avgSpeed = (minSpd + maxSpd) / 2;
            const totalSeconds = (videoDurationSeconds * loopValue * 2) / avgSpeed;
            totalDuration.textContent = formatDuration(totalSeconds) + ' (概算)';
        } else {
            // 通常速度
            const totalSeconds = videoDurationSeconds * loopValue * 2; // 正再生 + 逆再生
            totalDuration.textContent = formatDuration(totalSeconds);
        }
        
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

// モードボタンのクリック処理
modeReverse.addEventListener('click', () => {
    isReverseMode = true;
    modeReverse.classList.add('active');
    modeForward.classList.remove('active');
});

modeForward.addEventListener('click', () => {
    isReverseMode = false;
    modeForward.classList.add('active');
    modeReverse.classList.remove('active');
});

// ランダム速度チェックボックス変更時
randomSpeed.addEventListener('change', () => {
    speedControls.style.display = randomSpeed.checked ? 'block' : 'none';
    updateTotalDuration();
});

// 速度スライダー変更時
minSpeed.addEventListener('input', () => {
    const value = parseFloat(minSpeed.value);
    minSpeedValue.textContent = value.toFixed(1);
    
    // 最小値が最大値を超えないように調整
    if (value > parseFloat(maxSpeed.value)) {
        maxSpeed.value = value;
        maxSpeedValue.textContent = value.toFixed(1);
    }
    updateTotalDuration();
});

maxSpeed.addEventListener('input', () => {
    const value = parseFloat(maxSpeed.value);
    maxSpeedValue.textContent = value.toFixed(1);
    
    // 最大値が最小値を下回らないように調整
    if (value < parseFloat(minSpeed.value)) {
        minSpeed.value = value;
        minSpeedValue.textContent = value.toFixed(1);
    }
    updateTotalDuration();
});

// 出力ボタンのクリック処理
generateBtn.addEventListener('click', async () => {
    if (isBatchMode) {
        // バッチ処理モード
        await processBatchFiles();
    } else {
        // 単一ファイル処理モード
        await processSingleFile();
    }
});

// 単一ファイル処理
async function processSingleFile() {
    if (!selectedVideoPath) {
        showError('動画ファイルが選択されていません');
        return;
    }

    try {
        // 保存先選択（連番自動生成）
        const inputFileName = path.basename(selectedVideoPath);
        const outputPath = await ipcRenderer.invoke('select-output-path', inputFileName);
        if (!outputPath) return;

        // UI状態の更新
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="icon">⏳</span><span>処理中...</span>';
        progressSection.style.display = 'block';
        progressLabel.textContent = '処理中...';
        updateProgress(0);

        // ループ動画生成開始
        const result = await ipcRenderer.invoke('generate-loop', {
            inputPath: selectedVideoPath,
            loopCount: parseInt(loopCount.value),
            outputPath: outputPath,
            isReverseMode: isReverseMode,
            randomSpeed: randomSpeed.checked,
            minSpeed: parseFloat(minSpeed.value),
            maxSpeed: parseFloat(maxSpeed.value)
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
}

// バッチ処理
async function processBatchFiles() {
    if (selectedFiles.length === 0) {
        showError('動画ファイルが選択されていません');
        return;
    }

    try {
        // 保存先フォルダを選択
        const outputDir = await ipcRenderer.invoke('select-batch-output-directory');
        if (!outputDir) {
            return; // キャンセルされた
        }

        // UI状態の更新
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="icon">⏳</span><span>一括処理中...</span>';
        progressSection.style.display = 'block';
        batchProgress.style.display = 'block';
        updateProgress(0);

        const totalFiles = selectedFiles.length;
        let completedFiles = 0;

        // バッチ処理リクエスト
        const result = await ipcRenderer.invoke('generate-batch-loop', {
            inputPaths: selectedFiles,
            loopCount: parseInt(loopCount.value),
            isReverseMode: isReverseMode,
            randomSpeed: randomSpeed.checked,
            minSpeed: parseFloat(minSpeed.value),
            maxSpeed: parseFloat(maxSpeed.value),
            outputDir: outputDir
        });

        if (result.success) {
            showSuccess(`完了: ${totalFiles}個のファイルを処理しました\n保存先: ${result.outputDir}`);
            updateProgress(100);
            batchProgressText.textContent = `${totalFiles} / ${totalFiles} ファイル完了`;
        } else {
            throw new Error(result.error || '一括処理に失敗しました');
        }

    } catch (error) {
        showError('一括出力エラー: ' + error.message);
        updateProgress(0);
    } finally {
        generateBtn.disabled = false;
        updateButtonText();
        setTimeout(() => {
            progressSection.style.display = 'none';
            batchProgress.style.display = 'none';
        }, 5000);
    }
}

// プログレス更新のリスナー
ipcRenderer.on('progress-update', (event, percent) => {
    updateProgress(Math.round(percent));
});

// バッチ処理進行状況のリスナー
ipcRenderer.on('batch-progress-update', (event, { current, total, fileName }) => {
    batchProgressText.textContent = `${current} / ${total} ファイル完了`;
    progressLabel.textContent = `処理中: ${fileName}`;
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

// ファイルリストを表示
function renderFileList() {
    if (selectedFiles.length === 0) {
        fileList.style.display = 'none';
        return;
    }

    fileList.style.display = 'block';
    fileCount.textContent = `${selectedFiles.length}ファイル選択中`;
    fileListItems.innerHTML = '';

    selectedFiles.forEach((filePath, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-item-name';
        nameSpan.textContent = path.basename(filePath);
        nameSpan.title = filePath;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-item-remove';
        removeBtn.textContent = '削除';
        removeBtn.onclick = () => {
            selectedFiles.splice(index, 1);
            renderFileList();
            if (selectedFiles.length === 0) {
                generateBtn.disabled = true;
                isBatchMode = false;
                updateButtonText();
            }
        };

        item.appendChild(nameSpan);
        item.appendChild(removeBtn);
        fileListItems.appendChild(item);
    });
}

// ボタンテキストを更新
function updateButtonText() {
    if (isBatchMode) {
        generateBtnText.textContent = `${selectedFiles.length}個のループ動画を一括出力`;
        outputNoteText.textContent = '※ 保存先フォルダを選択できます';
    } else {
        generateBtnText.textContent = 'ループ動画を出力';
        outputNoteText.textContent = '※ 連番ファイル名で自動保存 (例: video_loop_001.mp4)';
    }
}

// テーマ切り替え機能
const themeDark = document.getElementById('themeDark');
const themeDay = document.getElementById('themeDay');
const themePink = document.getElementById('themePink');
const lopO = document.getElementById('lopO');

// ローカルストレージからテーマを読み込み
const savedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(savedTheme);

// テーマ切り替えイベント
themeDark.addEventListener('click', () => {
    applyTheme('dark');
    localStorage.setItem('theme', 'dark');
});

themeDay.addEventListener('click', () => {
    applyTheme('day');
    localStorage.setItem('theme', 'day');
});

themePink.addEventListener('click', () => {
    applyTheme('pink');
    localStorage.setItem('theme', 'pink');
});

function applyTheme(theme) {
    // すべてのテーマクラスを削除
    document.body.classList.remove('theme-day', 'theme-pink');

    // ボタンのアクティブ状態をリセット
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));

    // テーマを適用
    if (theme === 'day') {
        document.body.classList.add('theme-day');
        themeDay.classList.add('active');
        lopO.textContent = 'O';
    } else if (theme === 'pink') {
        document.body.classList.add('theme-pink');
        themePink.classList.add('active');
        lopO.textContent = '♥';
    } else {
        // dark (デフォルト)
        themeDark.classList.add('active');
        lopO.textContent = 'O';
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('るーぷツール準備完了');
});