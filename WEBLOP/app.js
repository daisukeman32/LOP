// WEBLOP - Web Loop Video Creator

// グローバル変数
let ffmpeg = null;
let videoFile = null;
let videoDuration = 0;
let outputBlob = null;
let loopMode = 'reverse';
let quality = 'high';
const TARGET_FPS = 30;
// 常にfps制限を適用（高fpsビデオの安全策）
const ALWAYS_LIMIT_FPS = true;

// DOM要素
const elements = {
    ffmpegLoading: document.getElementById('ffmpegLoading'),
    inputSection: document.getElementById('inputSection'),
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    videoInfo: document.getElementById('videoInfo'),
    fileName: document.getElementById('fileName'),
    videoDuration: document.getElementById('videoDuration'),
    fileSize: document.getElementById('fileSize'),
    warningMessage: document.getElementById('warningMessage'),
    previewVideo: document.getElementById('previewVideo'),
    changeFileBtn: document.getElementById('changeFileBtn'),
    controlsSection: document.getElementById('controlsSection'),
    loopCount: document.getElementById('loopCount'),
    totalDuration: document.getElementById('totalDuration'),
    outputSection: document.getElementById('outputSection'),
    generateBtn: document.getElementById('generateBtn'),
    progress: document.getElementById('progress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressLabel: document.getElementById('progressLabel'),
    resultSection: document.getElementById('resultSection'),
    resultVideo: document.getElementById('resultVideo'),
    downloadBtn: document.getElementById('downloadBtn'),
    newVideoBtn: document.getElementById('newVideoBtn'),
    // テーマ
    themeDark: document.getElementById('themeDark'),
    themeDay: document.getElementById('themeDay'),
    themePink: document.getElementById('themePink'),
    // モード
    modeReverse: document.getElementById('modeReverse'),
    modeForward: document.getElementById('modeForward'),
    // 品質
    qualityHigh: document.getElementById('qualityHigh'),
    qualityMedium: document.getElementById('qualityMedium'),
    qualityFast: document.getElementById('qualityFast')
};

// FFmpeg初期化
async function initFFmpeg() {
    const { createFFmpeg, fetchFile } = FFmpeg;

    ffmpeg = createFFmpeg({
        log: true,
        progress: ({ ratio }) => {
            const percent = Math.round(ratio * 100);
            updateProgress(percent);
        }
    });

    window.ffmpegFetchFile = fetchFile;

    try {
        await ffmpeg.load();
        console.log('FFmpeg loaded successfully');
        elements.ffmpegLoading.classList.add('hidden');
    } catch (error) {
        console.error('FFmpeg load error:', error);
        elements.ffmpegLoading.innerHTML = `
            <div class="loading-content">
                <p style="color: #dc3545;">FFmpegの読み込みに失敗しました</p>
                <p class="loading-note">${error.message}</p>
                <p class="loading-note" style="margin-top: 16px;">
                    ブラウザをリロードして再試行してください。
                </p>
            </div>
        `;
    }
}

// ユーティリティ関数
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 動画ファイル処理
async function handleVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        alert('動画ファイルを選択してください');
        return;
    }

    videoFile = file;

    const url = URL.createObjectURL(file);
    elements.previewVideo.src = url;

    elements.previewVideo.onloadedmetadata = () => {
        videoDuration = elements.previewVideo.duration;
        elements.fileName.textContent = file.name;
        elements.videoDuration.textContent = formatDuration(videoDuration);
        elements.fileSize.textContent = formatFileSize(file.size);

        // 警告チェック
        checkVideoWarnings(file, elements.previewVideo);

        updateEstimatedDuration();
    };

    // UI更新
    elements.inputSection.style.display = 'none';
    elements.videoInfo.style.display = 'block';
    elements.controlsSection.style.display = 'flex';
    elements.outputSection.style.display = 'block';
    elements.resultSection.style.display = 'none';
}

// 動画の警告チェック
function checkVideoWarnings(file, video) {
    const warnings = [];
    const notices = [];

    // 常にfps制限を適用する旨を表示
    notices.push(`動画は${TARGET_FPS}fpsに自動変換されます（メモリ最適化）`);

    // 長さ警告（10秒以上）
    if (video.duration > 10) {
        warnings.push(`動画が10秒以上 (${formatDuration(video.duration)}) - 処理に失敗する可能性があります`);
    }

    // メッセージ構築
    let message = '';

    if (notices.length > 0) {
        message += '📝 ' + notices.join('<br>') + '<br>';
    }

    if (warnings.length > 0) {
        message += '⚠️ <strong>注意:</strong> ' + warnings.join('<br>');
    }

    if (message) {
        elements.warningMessage.innerHTML = message;
        elements.warningMessage.style.display = 'block';
    } else {
        elements.warningMessage.style.display = 'none';
    }
}

// 推定出力時間更新
function updateEstimatedDuration() {
    if (!videoDuration) return;

    const count = parseInt(elements.loopCount.value) || 3;
    let estimated;

    if (loopMode === 'reverse') {
        estimated = videoDuration * count * 2;
    } else {
        estimated = videoDuration * count;
    }

    elements.totalDuration.textContent = formatDuration(estimated);
}

// 進捗更新
function updateProgress(percent) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${percent}%`;
}

// ループ動画生成
async function generateLoopVideo() {
    if (!ffmpeg || !videoFile) return;

    const loopCount = parseInt(elements.loopCount.value) || 3;

    // UI更新
    elements.controlsSection.style.display = 'none';
    elements.outputSection.style.display = 'none';
    elements.progress.style.display = 'block';
    elements.progressLabel.textContent = '動画を読み込み中...';
    updateProgress(0);

    try {
        ffmpeg.FS('writeFile', 'input.mp4', await window.ffmpegFetchFile(videoFile));

        elements.progressLabel.textContent = 'ループ動画を生成中...';

        const qualitySettings = {
            high: { crf: '23', preset: 'medium' },
            medium: { crf: '28', preset: 'fast' },
            fast: { crf: '32', preset: 'ultrafast' }
        };
        const { crf, preset } = qualitySettings[quality];

        // 常にfps制限を適用（メモリ最適化）
        const fpsFilter = `fps=${TARGET_FPS},`;
        console.log('Applying fps filter:', fpsFilter, 'Mode:', loopMode, 'Loops:', loopCount);

        if (loopMode === 'reverse') {
            // Reverseモード: filter_complexを使用
            let filterParts = [];
            let concatInputs = '';

            // 最初のループ: 完全な forward + reverse（最初のフレーム除去してPTSリセット）
            filterParts.push(`[0:v]${fpsFilter}copy[forward0]`);
            filterParts.push(`[0:v]${fpsFilter}reverse,trim=start_frame=1,setpts=PTS-STARTPTS[reverse0]`);
            concatInputs += '[forward0][reverse0]';

            // 2回目以降: 最初のフレームを除去してPTSリセット
            for (let i = 1; i < loopCount; i++) {
                filterParts.push(`[0:v]${fpsFilter}trim=start_frame=1,setpts=PTS-STARTPTS[forward${i}]`);
                filterParts.push(`[0:v]${fpsFilter}reverse,trim=start_frame=1,setpts=PTS-STARTPTS[reverse${i}]`);
                concatInputs += `[forward${i}][reverse${i}]`;
            }

            const concatCount = loopCount * 2;
            filterParts.push(`${concatInputs}concat=n=${concatCount}:v=1:a=0[output]`);
            const filterComplex = filterParts.join(';');

            console.log('Filter complex:', filterComplex);

            await ffmpeg.run(
                '-i', 'input.mp4',
                '-filter_complex', filterComplex,
                '-map', '[output]',
                '-c:v', 'libx264',
                '-preset', preset,
                '-crf', crf,
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                'output.mp4'
            );
        } else {
            // Forwardモード: -stream_loopを使用（メモリ効率が良い）
            console.log('Using stream_loop for Forward mode');

            await ffmpeg.run(
                '-stream_loop', String(loopCount - 1),
                '-i', 'input.mp4',
                '-vf', `fps=${TARGET_FPS}`,
                '-c:v', 'libx264',
                '-preset', preset,
                '-crf', crf,
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                'output.mp4'
            );
        }

        elements.progressLabel.textContent = '出力ファイルを準備中...';
        updateProgress(100);

        const outputData = ffmpeg.FS('readFile', 'output.mp4');
        outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

        const resultUrl = URL.createObjectURL(outputBlob);
        elements.resultVideo.src = resultUrl;

        elements.progress.style.display = 'none';
        elements.resultSection.style.display = 'block';

        ffmpeg.FS('unlink', 'input.mp4');
        ffmpeg.FS('unlink', 'output.mp4');

    } catch (error) {
        console.error('Generation error:', error);

        // OOMエラーの判定
        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('OOM') || errorMsg.includes('memory') || errorMsg.includes('abort')) {
            alert('メモリ不足エラー\n\n' +
                '動画が大きすぎるか、フレームレートが高すぎます。\n\n' +
                '対策:\n' +
                '1. Forwardモードを使う（Reverseより軽量）\n' +
                '2. より小さい動画を使う\n' +
                '3. 動画を事前に圧縮する');
        } else {
            alert(`エラーが発生しました: ${errorMsg}`);
        }

        resetUI();
    }
}

// ダウンロード
function downloadResult() {
    if (!outputBlob) return;

    const originalName = videoFile.name.replace(/\.[^.]+$/, '');
    const fileName = `${originalName}_loop.mp4`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(outputBlob);
    link.download = fileName;
    link.click();
}

// UIリセット
function resetUI() {
    videoFile = null;
    videoDuration = 0;
    outputBlob = null;

    elements.inputSection.style.display = 'block';
    elements.videoInfo.style.display = 'none';
    elements.controlsSection.style.display = 'none';
    elements.outputSection.style.display = 'none';
    elements.progress.style.display = 'none';
    elements.resultSection.style.display = 'none';

    elements.previewVideo.src = '';
    elements.resultVideo.src = '';
    elements.loopCount.value = 3;
}

// テーマ切り替え
function setTheme(theme) {
    document.body.className = '';
    if (theme === 'day') {
        document.body.classList.add('theme-day');
    } else if (theme === 'pink') {
        document.body.classList.add('theme-pink');
    }

    // ボタンのアクティブ状態を更新
    elements.themeDark.classList.toggle('active', theme === 'dark');
    elements.themeDay.classList.toggle('active', theme === 'day');
    elements.themePink.classList.toggle('active', theme === 'pink');
}

// イベントリスナー設定
function setupEventListeners() {
    // ドラッグ&ドロップ
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('drag-over');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('drag-over');
    });

    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        handleVideoFile(file);
    });

    elements.dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleVideoFile(file);
    });

    elements.changeFileBtn.addEventListener('click', () => {
        elements.fileInput.click();
    });

    // ループ回数
    elements.loopCount.addEventListener('input', updateEstimatedDuration);

    // 再生モード
    elements.modeReverse.addEventListener('click', () => {
        loopMode = 'reverse';
        elements.modeReverse.classList.add('active');
        elements.modeForward.classList.remove('active');
        updateEstimatedDuration();
    });

    elements.modeForward.addEventListener('click', () => {
        loopMode = 'forward';
        elements.modeForward.classList.add('active');
        elements.modeReverse.classList.remove('active');
        updateEstimatedDuration();
    });

    // 品質
    elements.qualityHigh.addEventListener('click', () => {
        quality = 'high';
        elements.qualityHigh.classList.add('active');
        elements.qualityMedium.classList.remove('active');
        elements.qualityFast.classList.remove('active');
    });

    elements.qualityMedium.addEventListener('click', () => {
        quality = 'medium';
        elements.qualityMedium.classList.add('active');
        elements.qualityHigh.classList.remove('active');
        elements.qualityFast.classList.remove('active');
    });

    elements.qualityFast.addEventListener('click', () => {
        quality = 'fast';
        elements.qualityFast.classList.add('active');
        elements.qualityHigh.classList.remove('active');
        elements.qualityMedium.classList.remove('active');
    });

    // テーマ
    elements.themeDark.addEventListener('click', () => setTheme('dark'));
    elements.themeDay.addEventListener('click', () => setTheme('day'));
    elements.themePink.addEventListener('click', () => setTheme('pink'));

    // 生成・ダウンロード
    elements.generateBtn.addEventListener('click', generateLoopVideo);
    elements.downloadBtn.addEventListener('click', downloadResult);
    elements.newVideoBtn.addEventListener('click', resetUI);
}

// 初期化
async function init() {
    setupEventListeners();
    await initFFmpeg();
}

document.addEventListener('DOMContentLoaded', init);
