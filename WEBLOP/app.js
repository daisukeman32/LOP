// WEBLOP - Web Loop Video Creator

// グローバル変数
let ffmpeg = null;
let ffmpegWorker = null; // Web Worker for merge
let videoFile = null;
let videoDuration = 0;
let videoWidth = 0;
let videoHeight = 0;
let detectedFps = null;
let outputBlob = null;
let loopMode = 'reverse';
let loopFrameCut = false; // false=OFF（高速）, true=ON（滑らかループ）

// Batch Loop用変数
let batchLoopVideos = []; // { file, name, duration, width, height, loopCount, loopMode, frameCut }
let batchOutputBlobs = []; // { blob, name }
let isBatchMode = false;
let batchProgressStart = 0;
let batchProgressEnd = 100;

// Merge用変数
let currentMode = 'loop'; // 'loop' or 'merge'
let mergeVideos = []; // { file, duration, name }
let frameCutMode = 0; // 0=OFF, 1=1フレーム, 2=2フレーム（両側）
let mergeWorkerReady = false;

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
    // フレームカット（Loop用）
    frameCutGroup: document.getElementById('frameCutGroup'),
    frameCutOff: document.getElementById('frameCutOff'),
    frameCutOn: document.getElementById('frameCutOn'),
    frameCutHint: document.getElementById('frameCutHint'),
    // モードタブ
    tabLoop: document.getElementById('tabLoop'),
    tabMerge: document.getElementById('tabMerge'),
    loopMode: document.getElementById('loopMode'),
    mergeMode: document.getElementById('mergeMode'),
    // Merge用
    mergeDropZone: document.getElementById('mergeDropZone'),
    mergeFileInput: document.getElementById('mergeFileInput'),
    mergeInputSection: document.getElementById('mergeInputSection'),
    mergeVideoList: document.getElementById('mergeVideoList'),
    mergeVideos: document.getElementById('mergeVideos'),
    mergeVideoCount: document.getElementById('mergeVideoCount'),
    addMoreBtn: document.getElementById('addMoreBtn'),
    mergeControlsSection: document.getElementById('mergeControlsSection'),
    frameCut0: document.getElementById('frameCut0'),
    frameCut1: document.getElementById('frameCut1'),
    frameCut2: document.getElementById('frameCut2'),
    mergeTotalDuration: document.getElementById('mergeTotalDuration'),
    mergeOutputSection: document.getElementById('mergeOutputSection'),
    mergeGenerateBtn: document.getElementById('mergeGenerateBtn'),
    mergeNote: document.getElementById('mergeNote'),
    // Batch Loop用
    batchVideoList: document.getElementById('batchVideoList'),
    batchVideos: document.getElementById('batchVideos'),
    batchVideoCount: document.getElementById('batchVideoCount'),
    addMoreLoopBtn: document.getElementById('addMoreLoopBtn')
};

// マージ注釈を更新
function updateMergeNote() {
    if (!elements.mergeNote) return;

    const commonNote = '（同じ解像度・フレームレートの動画のみ）';

    if (frameCutMode === 0) {
        elements.mergeNote.textContent = `※ OFF: そのまま結合（高速）${commonNote}`;
    } else if (frameCutMode === 1) {
        elements.mergeNote.textContent = `※ 1F: 繋ぎ目の重複1枚削除${commonNote}`;
    } else if (frameCutMode === 2) {
        elements.mergeNote.textContent = `※ 2F: 繋ぎ目の重複2枚削除${commonNote}`;
    }
}

// 現在の処理モード（進捗計算用）
let currentProcessMode = 'loop'; // 'loop' or 'merge'

// プログレスラベルのアニメーション
let progressLabelInterval = null;
let dotCount = 0;

// 進捗バーの滑らかなアニメーション用
let progressAnimationInterval = null;
let currentDisplayProgress = 0;
let targetProgress = 0;

function startProgressAnimation(start, end, durationMs) {
    stopProgressAnimation();
    currentDisplayProgress = start;
    targetProgress = end;
    const steps = Math.ceil(durationMs / 50); // 50msごとに更新
    const increment = (end - start) / steps;
    let stepCount = 0;

    progressAnimationInterval = setInterval(() => {
        stepCount++;
        currentDisplayProgress = Math.min(start + increment * stepCount, end);
        updateProgressDisplay(Math.round(currentDisplayProgress));
        if (stepCount >= steps) {
            stopProgressAnimation();
        }
    }, 50);
}

function stopProgressAnimation() {
    if (progressAnimationInterval) {
        clearInterval(progressAnimationInterval);
        progressAnimationInterval = null;
    }
}

// 表示のみを更新（アニメーション用）
function updateProgressDisplay(percent) {
    percent = Math.max(0, Math.min(100, Math.round(percent)));
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${percent}%`;
}

function startProgressLabelAnimation(baseText) {
    stopProgressLabelAnimation();
    dotCount = 0;

    // 固定テキストとアニメーションするドット用spanを分離
    // ドット部分は固定幅でガタつき防止
    elements.progressLabel.innerHTML = `${baseText}<span id="animDots" style="display:inline-block;width:1.5em;text-align:left;">.</span>`;
    const dotsSpan = document.getElementById('animDots');

    progressLabelInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        const dots = '.'.repeat(dotCount || 1);
        if (dotsSpan) {
            dotsSpan.textContent = dots;
        }
    }, 400);
}

function stopProgressLabelAnimation() {
    if (progressLabelInterval) {
        clearInterval(progressLabelInterval);
        progressLabelInterval = null;
    }
}

// FFmpeg初期化
async function initFFmpeg() {
    const { createFFmpeg, fetchFile } = FFmpeg;

    ffmpeg = createFFmpeg({
        log: true,
        progress: ({ ratio }) => {
            let percent;
            if (isBatchMode) {
                // バッチモード: per-videoレンジにスケーリング
                percent = Math.round(batchProgressStart + ratio * (batchProgressEnd - batchProgressStart));
            } else if (currentProcessMode === 'merge') {
                percent = Math.round(20 + ratio * 50); // 20% ~ 70%
            } else {
                percent = Math.round(30 + ratio * 50); // 30% ~ 80%
            }
            updateProgress(percent);
        }
    });

    window.ffmpegFetchFile = fetchFile;

    try {
        await ffmpeg.load();
        console.log('FFmpeg loaded successfully');
        elements.ffmpegLoading.classList.add('hidden');

        // Web Workerは無効化（安定性のため）
        // initMergeWorker();
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

// Merge用Web Worker初期化
function initMergeWorker() {
    if (typeof Worker === 'undefined') {
        console.warn('Web Workers not supported');
        return;
    }

    try {
        ffmpegWorker = new Worker('ffmpeg-worker.js');

        ffmpegWorker.onmessage = function(e) {
            const { type, ratio, message, data } = e.data;

            switch (type) {
                case 'ready':
                    console.log('FFmpeg Worker ready');
                    mergeWorkerReady = true;
                    break;

                case 'progress':
                    const percent = Math.round(ratio * 100);
                    updateProgress(percent);
                    break;

                case 'status':
                    elements.progressLabel.textContent = message;
                    break;

                case 'mergeComplete':
                    handleMergeComplete(data);
                    break;

                case 'error':
                    handleMergeError(message);
                    break;
            }
        };

        ffmpegWorker.onerror = function(error) {
            console.error('Worker error:', error);
            console.error('Error message:', error.message);
            console.error('Error filename:', error.filename);
            console.error('Error lineno:', error.lineno);
            mergeWorkerReady = false;
        };

        // Worker初期化
        console.log('Initializing FFmpeg Worker...');
        ffmpegWorker.postMessage({ type: 'init' });

    } catch (error) {
        console.error('Failed to create worker:', error);
    }
}

// Merge完了ハンドラ
function handleMergeComplete(arrayBuffer) {
    outputBlob = new Blob([arrayBuffer], { type: 'video/mp4' });

    const resultUrl = URL.createObjectURL(outputBlob);
    elements.resultVideo.src = resultUrl;

    elements.progress.style.display = 'none';
    elements.resultSection.style.display = 'block';
    elements.progressFill.classList.remove('pulsing');
}

// Mergeエラーハンドラ
function handleMergeError(message) {
    elements.progressFill.classList.remove('pulsing');

    if (message.includes('OOM') || message.includes('memory') || message.includes('abort')) {
        alert('メモリ不足エラー\n\n動画の合計サイズが大きすぎます。\n動画の数を減らすか、短い動画を使用してください。');
    } else {
        alert(`エラーが発生しました: ${message}`);
    }

    resetMergeUI();
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

// 動画ファイル処理（dispatch）
async function handleVideoFile(files) {
    // FileList, File, Array いずれにも対応
    let fileArray;
    if (files instanceof FileList) {
        fileArray = Array.from(files);
    } else if (files instanceof File) {
        fileArray = [files];
    } else {
        fileArray = Array.from(files);
    }
    const videoFiles = fileArray.filter(f => f && f.type.startsWith('video/'));

    if (videoFiles.length === 0) {
        alert('動画ファイルを選択してください');
        return;
    }

    // バッチモード中なら追加
    if (batchLoopVideos.length > 0) {
        await handleBatchVideoFiles(videoFiles);
        return;
    }

    if (videoFiles.length === 1) {
        await handleSingleVideoFile(videoFiles[0]);
    } else {
        await handleBatchVideoFiles(videoFiles);
    }
}

// 単一動画ファイル処理（既存ロジック）
async function handleSingleVideoFile(file) {
    videoFile = file;

    const url = URL.createObjectURL(file);
    elements.previewVideo.src = url;

    elements.previewVideo.onloadedmetadata = () => {
        videoDuration = elements.previewVideo.duration;
        videoWidth = elements.previewVideo.videoWidth;
        videoHeight = elements.previewVideo.videoHeight;
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
    elements.batchVideoList.style.display = 'none';
}

// ===== BATCH LOOP FUNCTIONS =====

// 複数動画をバッチリストに追加
async function handleBatchVideoFiles(videoFiles) {
    // 単一モードの状態をクリーンアップ
    if (videoFile) {
        videoFile = null;
        videoDuration = 0;
        elements.previewVideo.src = '';
    }

    const defaultLoopCount = parseInt(elements.loopCount.value) || 3;
    const defaultLoopMode = loopMode;
    const defaultFrameCut = loopFrameCut;

    for (const file of videoFiles) {
        const metadata = await getVideoMetadata(file);
        batchLoopVideos.push({
            file,
            name: file.name,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            loopCount: defaultLoopCount,
            loopMode: defaultLoopMode,
            frameCut: defaultFrameCut
        });
    }

    // バッチUI表示
    elements.inputSection.style.display = 'none';
    elements.videoInfo.style.display = 'none';
    elements.controlsSection.style.display = 'none';
    elements.batchVideoList.style.display = 'block';
    elements.outputSection.style.display = 'block';
    elements.resultSection.style.display = 'none';

    updateBatchVideoList();
}

// バッチ推定時間計算
function calcBatchEstDuration(v) {
    if (!v.duration) return '-';
    const estimated = v.loopMode === 'reverse'
        ? v.duration * v.loopCount * 2
        : v.duration * v.loopCount;
    return formatDuration(estimated);
}

function calcBatchTotalDuration() {
    const total = batchLoopVideos.reduce((sum, v) => {
        return sum + (v.loopMode === 'reverse'
            ? v.duration * v.loopCount * 2
            : v.duration * v.loopCount);
    }, 0);
    return formatDuration(total);
}

function updateBatchEstDurations() {
    batchLoopVideos.forEach((v, i) => {
        const el = document.getElementById(`batchEst${i}`);
        if (el) el.textContent = calcBatchEstDuration(v);
    });
    const totalEl = document.getElementById('batchTotalDuration');
    if (totalEl) totalEl.textContent = calcBatchTotalDuration();
}

// バッチ動画リスト描画
function updateBatchVideoList() {
    if (batchLoopVideos.length === 0) {
        resetBatchUI();
        return;
    }

    elements.batchVideoCount.textContent = batchLoopVideos.length;

    elements.batchVideos.innerHTML = batchLoopVideos.map((v, i) => `
        <div class="batch-video-item" data-index="${i}">
            <div class="batch-video-header">
                <span class="video-number">${i + 1}</span>
                <span class="video-name">${v.name}</span>
                <span class="video-duration">${formatDuration(v.duration)}</span>
                <button class="batch-expand-btn" onclick="toggleBatchExpand(${i})">設定 ▼</button>
                <button class="remove-btn" onclick="removeBatchVideo(${i})">✕</button>
            </div>
            <div class="batch-video-controls" id="batchControls${i}" style="display: none;">
                <div class="batch-control-row">
                    <label class="control-label">ループ回数</label>
                    <input type="number" value="${v.loopCount}" min="1" max="20" class="loop-input"
                           oninput="updateBatchSetting(${i}, 'loopCount', parseInt(this.value) || 1)">
                </div>
                <div class="batch-control-row">
                    <label class="control-label">再生モード</label>
                    <div class="loop-mode-switcher">
                        <button class="mode-btn ${v.loopMode === 'reverse' ? 'active' : ''}"
                                onclick="updateBatchMode(${i}, 'reverse', this)">Reverse</button>
                        <button class="mode-btn ${v.loopMode === 'forward' ? 'active' : ''}"
                                onclick="updateBatchMode(${i}, 'forward', this)">Forward</button>
                    </div>
                </div>
                <div class="batch-control-row batch-frame-cut-row" style="display: ${v.loopMode === 'reverse' ? 'flex' : 'none'};">
                    <label class="control-label">フレームカット</label>
                    <div class="loop-mode-switcher">
                        <button class="mode-btn ${!v.frameCut ? 'active' : ''}"
                                onclick="updateBatchFrameCut(${i}, false, this)">OFF</button>
                        <button class="mode-btn ${v.frameCut ? 'active' : ''}"
                                onclick="updateBatchFrameCut(${i}, true, this)">ON</button>
                    </div>
                </div>
                <div class="batch-control-row">
                    <label class="control-label">推定出力時間</label>
                    <span class="batch-est-value" id="batchEst${i}">${calcBatchEstDuration(v)}</span>
                </div>
            </div>
        </div>
    `).join('');

    // 合計推定時間＋注意喚起を追加
    const existing = elements.batchVideoList.querySelector('.batch-footer');
    if (existing) existing.remove();

    const totalSizeMB = batchLoopVideos.reduce((sum, v) => sum + v.file.size, 0) / (1024 * 1024);
    const count = batchLoopVideos.length;

    let warningHtml = '';
    if (count >= 20 || totalSizeMB >= 200) {
        warningHtml = `<div class="batch-warning batch-warning-danger">
            ⚠️ 動画${count}本（合計${totalSizeMB.toFixed(0)}MB）- ブラウザがクラッシュする可能性があります。本数を減らすことを推奨します。
        </div>`;
    } else if (count >= 10 || totalSizeMB >= 100) {
        warningHtml = `<div class="batch-warning">
            ⚠️ 動画${count}本（合計${totalSizeMB.toFixed(0)}MB）- 処理に時間がかかる場合があります。
        </div>`;
    }

    const footerHtml = `
        <div class="batch-footer">
            <div class="batch-total-info">
                <span class="total-label">合計推定出力時間:</span>
                <span id="batchTotalDuration" class="total-value">${calcBatchTotalDuration()}</span>
            </div>
            ${warningHtml}
            <div class="batch-note">
                ※ 目安: 10本・合計100MB以内を推奨（ブラウザ上で処理するため）
            </div>
        </div>`;
    elements.batchVideos.insertAdjacentHTML('afterend', footerHtml);
}

// バッチ動画削除
function removeBatchVideo(index) {
    batchLoopVideos.splice(index, 1);
    if (batchLoopVideos.length === 0) {
        resetBatchUI();
    } else {
        updateBatchVideoList();
    }
}

// 展開/折りたたみ
function toggleBatchExpand(index) {
    const controls = document.getElementById(`batchControls${index}`);
    const item = controls.closest('.batch-video-item');
    const btn = item.querySelector('.batch-expand-btn');
    if (controls.style.display === 'none') {
        controls.style.display = 'flex';
        btn.textContent = '設定 ▲';
    } else {
        controls.style.display = 'none';
        btn.textContent = '設定 ▼';
    }
}

// 個別設定変更
function updateBatchSetting(index, key, value) {
    batchLoopVideos[index][key] = value;
    updateBatchEstDurations();
}

function updateBatchMode(index, mode, btn) {
    batchLoopVideos[index].loopMode = mode;
    const switcher = btn.parentElement;
    switcher.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // フレームカット行の表示切替
    const item = btn.closest('.batch-video-item');
    const frameCutRow = item.querySelector('.batch-frame-cut-row');
    if (frameCutRow) {
        frameCutRow.style.display = mode === 'reverse' ? 'flex' : 'none';
    }
    updateBatchEstDurations();
}

function updateBatchFrameCut(index, value, btn) {
    batchLoopVideos[index].frameCut = value;
    const switcher = btn.parentElement;
    switcher.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// バッチ処理メイン
async function generateBatchLoopVideos() {
    if (!ffmpeg || batchLoopVideos.length === 0) return;

    isBatchMode = true;
    batchOutputBlobs = [];

    // UI
    elements.batchVideoList.style.display = 'none';
    elements.outputSection.style.display = 'none';
    elements.progress.style.display = 'block';
    elements.progressFill.classList.remove('pulsing');
    updateProgress(0);

    const total = batchLoopVideos.length;
    let failCount = 0;

    try {
        for (let i = 0; i < total; i++) {
            const videoStart = 5 + (85 * i / total);
            const videoEnd = 5 + (85 * (i + 1) / total);

            updateProgress(Math.round(videoStart));
            startProgressLabelAnimation(`${i + 1}/${total}本目処理中`);

            try {
                const blob = await processSingleLoopVideo(batchLoopVideos[i], videoStart, videoEnd);
                const originalName = batchLoopVideos[i].name.replace(/\.[^.]+$/, '');
                batchOutputBlobs.push({ blob, name: `${originalName}_loop.mp4` });
            } catch (err) {
                console.error(`Batch video ${i + 1} failed:`, err);
                failCount++;
            }
        }

        if (batchOutputBlobs.length === 0) {
            throw new Error('すべての動画の処理に失敗しました');
        }

        // ZIP作成
        updateProgress(90);
        startProgressLabelAnimation('ZIPファイルを作成中');

        const zip = new JSZip();
        for (const item of batchOutputBlobs) {
            zip.file(item.name, item.blob, { compression: 'STORE' });
        }
        outputBlob = await zip.generateAsync({ type: 'blob' });

        // 自動ダウンロード
        const link = document.createElement('a');
        link.href = URL.createObjectURL(outputBlob);
        link.download = `loop_videos_${Date.now()}.zip`;
        link.click();

        stopProgressLabelAnimation();
        updateProgress(100);

        await new Promise(resolve => setTimeout(resolve, 400));

        // 完了表示
        elements.progress.style.display = 'none';
        elements.resultSection.style.display = 'block';
        const resultPreview = elements.resultSection.querySelector('.result-preview');
        if (resultPreview) resultPreview.style.display = 'none';
        const successEl = elements.resultSection.querySelector('.success');
        let msg = `${batchOutputBlobs.length}本のループ動画を作成しました！`;
        if (failCount > 0) msg += `（${failCount}本失敗）`;
        successEl.textContent = msg;

    } catch (error) {
        console.error('Batch error:', error);
        stopProgressLabelAnimation();

        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('OOM') || errorMsg.includes('memory') || errorMsg.includes('abort')) {
            alert('メモリ不足エラー\n\nバッチ処理中にメモリが不足しました。\n動画の数を減らすか、短い動画を使用してください。');
        } else {
            alert(`バッチ処理エラー: ${errorMsg}`);
        }
        resetBatchUI();
    } finally {
        isBatchMode = false;
    }
}

// 1本のループ動画を処理してBlobを返す
async function processSingleLoopVideo(config, videoStart, videoEnd) {
    const { file, loopCount, loopMode: mode, frameCut } = config;
    const range = videoEnd - videoStart;

    // 入力ファイル書き込み
    ffmpeg.FS('writeFile', 'input.mp4', await window.ffmpegFetchFile(file));

    if (mode === 'reverse' && frameCut) {
        // S-CUT-E方式: 個別ステップ + concat demuxer（高速・省メモリ）
        // Step 1: H.264正規化
        batchProgressStart = videoStart;
        batchProgressEnd = videoStart + range * 0.25;
        await ffmpeg.run(
            '-i', 'input.mp4',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
            'forward.mp4'
        );

        // Step 2: 逆再生版
        batchProgressStart = videoStart + range * 0.25;
        batchProgressEnd = videoStart + range * 0.5;
        await ffmpeg.run(
            '-i', 'forward.mp4',
            '-vf', 'reverse',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
            'reverse.mp4'
        );

        // Step 3: forward先頭フレーム除去（ループ繋ぎ目用）
        batchProgressStart = videoStart + range * 0.5;
        batchProgressEnd = videoStart + range * 0.65;
        await ffmpeg.run(
            '-i', 'forward.mp4',
            '-vf', 'trim=start_frame=1,setpts=PTS-STARTPTS',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
            'forward_cut.mp4'
        );

        // Step 4: reverse先頭フレーム除去（ループ繋ぎ目用）
        batchProgressStart = videoStart + range * 0.65;
        batchProgressEnd = videoStart + range * 0.8;
        await ffmpeg.run(
            '-i', 'reverse.mp4',
            '-vf', 'trim=start_frame=1,setpts=PTS-STARTPTS',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
            'reverse_cut.mp4'
        );

        // Step 5: concat demuxer（-c copy 高速連結）
        let fileListContent = "file 'forward.mp4'\nfile 'reverse_cut.mp4'\n";
        for (let i = 1; i < loopCount; i++) {
            fileListContent += "file 'forward_cut.mp4'\nfile 'reverse_cut.mp4'\n";
        }
        ffmpeg.FS('writeFile', 'filelist.txt', fileListContent);

        batchProgressStart = videoStart + range * 0.8;
        batchProgressEnd = videoEnd;
        await ffmpeg.run(
            '-f', 'concat', '-i', 'filelist.txt',
            '-c', 'copy', '-movflags', '+faststart',
            'output.mp4'
        );
    } else if (mode === 'reverse') {
        // concat demuxer reverse（3段階）
        batchProgressStart = videoStart;
        batchProgressEnd = videoStart + range * 0.4;
        await ffmpeg.run(
            '-i', 'input.mp4',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
            'forward.mp4'
        );

        batchProgressStart = videoStart + range * 0.4;
        batchProgressEnd = videoStart + range * 0.8;
        await ffmpeg.run(
            '-i', 'forward.mp4',
            '-vf', 'reverse',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
            'reverse.mp4'
        );

        let fileListContent = '';
        for (let i = 0; i < loopCount; i++) {
            fileListContent += "file 'forward.mp4'\n";
            fileListContent += "file 'reverse.mp4'\n";
        }
        ffmpeg.FS('writeFile', 'filelist.txt', fileListContent);

        batchProgressStart = videoStart + range * 0.8;
        batchProgressEnd = videoEnd;
        await ffmpeg.run(
            '-f', 'concat', '-i', 'filelist.txt',
            '-c', 'copy', '-movflags', '+faststart',
            'output.mp4'
        );
    } else {
        // Forward mode
        let fileListContent = '';
        for (let i = 0; i < loopCount; i++) {
            fileListContent += "file 'input.mp4'\n";
        }
        ffmpeg.FS('writeFile', 'filelist.txt', fileListContent);

        batchProgressStart = videoStart;
        batchProgressEnd = videoEnd;
        await ffmpeg.run(
            '-f', 'concat', '-i', 'filelist.txt',
            '-c', 'copy', '-movflags', '+faststart',
            'output.mp4'
        );
    }

    // 出力読み取り
    const outputData = ffmpeg.FS('readFile', 'output.mp4');
    if (!outputData || outputData.length === 0) {
        throw new Error('出力ファイルが空です');
    }
    const blob = new Blob([outputData.buffer], { type: 'video/mp4' });

    // クリーンアップ
    try { ffmpeg.FS('unlink', 'input.mp4'); } catch(e) {}
    try { ffmpeg.FS('unlink', 'output.mp4'); } catch(e) {}
    try { ffmpeg.FS('unlink', 'forward.mp4'); } catch(e) {}
    try { ffmpeg.FS('unlink', 'reverse.mp4'); } catch(e) {}
    try { ffmpeg.FS('unlink', 'forward_cut.mp4'); } catch(e) {}
    try { ffmpeg.FS('unlink', 'reverse_cut.mp4'); } catch(e) {}
    try { ffmpeg.FS('unlink', 'filelist.txt'); } catch(e) {}

    return blob;
}

// バッチUIリセット
function resetBatchUI() {
    batchLoopVideos = [];
    batchOutputBlobs = [];
    isBatchMode = false;

    elements.batchVideoList.style.display = 'none';
    elements.inputSection.style.display = 'block';
    elements.videoInfo.style.display = 'none';
    elements.controlsSection.style.display = 'none';
    elements.outputSection.style.display = 'none';
    elements.progress.style.display = 'none';
    elements.resultSection.style.display = 'none';

    // resultSectionをデフォルトに復元
    const resultPreview = elements.resultSection.querySelector('.result-preview');
    if (resultPreview) resultPreview.style.display = '';
    const successEl = elements.resultSection.querySelector('.success');
    if (successEl) successEl.textContent = '完了しました！';

    elements.previewVideo.src = '';
    elements.resultVideo.src = '';
}

// グローバルに公開（onclick用）
window.removeBatchVideo = removeBatchVideo;
window.toggleBatchExpand = toggleBatchExpand;
window.updateBatchSetting = updateBatchSetting;
window.updateBatchMode = updateBatchMode;
window.updateBatchFrameCut = updateBatchFrameCut;

// ===== END BATCH LOOP FUNCTIONS =====

// フレームレートを推定（requestVideoFrameCallbackを使用）
function estimateFrameRate(video) {
    return new Promise((resolve) => {
        if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
            // サポートしていない場合は不明として返す
            resolve(null);
            return;
        }

        let frameCount = 0;
        let startTime = null;
        const targetFrames = 10; // 10フレーム分サンプリング

        video.currentTime = 0;
        video.muted = true;

        const countFrame = (now, metadata) => {
            if (startTime === null) {
                startTime = metadata.mediaTime;
            }
            frameCount++;

            if (frameCount >= targetFrames) {
                const elapsed = metadata.mediaTime - startTime;
                if (elapsed > 0) {
                    const fps = Math.round(frameCount / elapsed);
                    video.pause();
                    video.currentTime = 0;
                    resolve(fps);
                } else {
                    resolve(null);
                }
            } else {
                video.requestVideoFrameCallback(countFrame);
            }
        };

        video.requestVideoFrameCallback(countFrame);
        video.play().catch(() => resolve(null));

        // タイムアウト（2秒）
        setTimeout(() => {
            video.pause();
            video.currentTime = 0;
            if (frameCount > 2) {
                resolve(Math.round(frameCount * 5)); // 推定
            } else {
                resolve(null);
            }
        }, 2000);
    });
}

// 動画の警告チェック
async function checkVideoWarnings(file, video) {
    const warnings = [];
    const notices = [];

    // 解像度を取得
    const width = video.videoWidth;
    const height = video.videoHeight;
    const resolution = `${width}x${height}`;
    notices.push(`解像度: ${resolution}`);

    // 長さ警告（10秒以上）
    if (video.duration > 10) {
        warnings.push(`動画が10秒以上 (${formatDuration(video.duration)}) - 処理に失敗する可能性があります`);
    }

    // フレームレート検出を試みる
    detectedFps = null;
    try {
        const fps = await estimateFrameRate(video);
        if (fps) {
            detectedFps = fps;
            notices.push(`検出されたフレームレート: ${fps}fps`);

            // 高解像度 + 高フレームレートの組み合わせ警告
            const isHighRes = height >= 1080 || width >= 1920;
            const isHighFps = fps >= 50;
            const isVeryHighFps = fps > 60;

            if (isVeryHighFps) {
                warnings.push(`超高フレームレート (${fps}fps) - 処理が非常に遅くなるか停止する可能性があります。事前に60fps以下に変換することを推奨します`);
            } else if (isHighRes && isHighFps) {
                warnings.push(`高解像度(${resolution}) + 高フレームレート(${fps}fps) - Reverseモードでメモリ不足になる可能性があります。Forwardモードを推奨します`);
            }
        }
    } catch (e) {
        console.log('FPS detection failed:', e);
    }

    // 解像度のみの警告（フレームレート検出失敗時のフォールバック）
    const isHighResOnly = height >= 1080 || width >= 1920;
    if (isHighResOnly && warnings.length === 0) {
        notices.push(`高解像度動画です。Reverseモードでメモリ不足になる場合はForwardモードをお試しください`);
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
    // NaN対策
    if (isNaN(percent) || percent === null || percent === undefined) {
        percent = 0;
    }
    percent = Math.max(0, Math.min(100, Math.round(percent)));
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `${percent}%`;
}

// Reverseモードのリスク判定
function isRiskyReverse() {
    if (loopMode !== 'reverse') return false;
    // フレームカットOFFなら警告不要（concat demuxer方式で高速処理）
    if (!loopFrameCut) return false;
    // フレームカットONの場合のみ、高解像度/高FPSで警告
    const isHighRes = videoHeight >= 1080 || videoWidth >= 1920;
    const isHighFps = detectedFps && detectedFps >= 50;
    return isHighRes || isHighFps;
}

// Reverseモード警告モーダル
function showReverseWarning() {
    return new Promise((resolve) => {
        const modal = document.getElementById('reverseWarningModal');
        const checkbox = document.getElementById('reverseWarningCheck');
        const proceedBtn = document.getElementById('reverseWarningProceedBtn');
        const cancelBtn = document.getElementById('reverseWarningCancelBtn');

        checkbox.checked = false;
        proceedBtn.disabled = true;

        modal.style.display = 'flex';

        const onCheckChange = () => {
            proceedBtn.disabled = !checkbox.checked;
        };

        const onProceed = () => {
            cleanup();
            modal.style.display = 'none';
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            modal.style.display = 'none';
            resolve(false);
        };

        const cleanup = () => {
            checkbox.removeEventListener('change', onCheckChange);
            proceedBtn.removeEventListener('click', onProceed);
            cancelBtn.removeEventListener('click', onCancel);
        };

        checkbox.addEventListener('change', onCheckChange);
        proceedBtn.addEventListener('click', onProceed);
        cancelBtn.addEventListener('click', onCancel);
    });
}

// ループ動画生成
async function generateLoopVideo() {
    if (!ffmpeg || !videoFile) return;

    // Reverseモード + 高リスク動画の場合、警告モーダルを表示
    if (isRiskyReverse()) {
        const proceed = await showReverseWarning();
        if (!proceed) return;
    }

    const loopCount = parseInt(elements.loopCount.value) || 3;

    // 進捗計算用にモードを設定
    currentProcessMode = 'loop';

    // UI更新
    elements.controlsSection.style.display = 'none';
    elements.outputSection.style.display = 'none';
    elements.progress.style.display = 'block';
    elements.progressFill.classList.add('pulsing');
    startProgressLabelAnimation('動画を読み込み中');
    updateProgress(0);

    try {
        ffmpeg.FS('writeFile', 'input.mp4', await window.ffmpegFetchFile(videoFile));
        updateProgress(30);

        elements.progressFill.classList.remove('pulsing');
        startProgressLabelAnimation('ループ動画を生成中');

        console.log('Mode:', loopMode, 'FrameCut:', loopFrameCut, 'Loops:', loopCount);

        // Reverseモード + フレームカットON: S-CUT-E方式（個別ステップ + concat demuxer）
        if (loopMode === 'reverse' && loopFrameCut) {
            console.log('Using S-CUT-E style frame cut (separate steps + concat)');

            // Step 1: H.264正規化
            updateProgress(10);
            await ffmpeg.run(
                '-i', 'input.mp4',
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
                'forward.mp4'
            );

            // Step 2: 逆再生版
            updateProgress(25);
            await ffmpeg.run(
                '-i', 'forward.mp4',
                '-vf', 'reverse',
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
                'reverse.mp4'
            );

            // Step 3: forward先頭フレーム除去
            updateProgress(45);
            await ffmpeg.run(
                '-i', 'forward.mp4',
                '-vf', 'trim=start_frame=1,setpts=PTS-STARTPTS',
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
                'forward_cut.mp4'
            );

            // Step 4: reverse先頭フレーム除去
            updateProgress(60);
            await ffmpeg.run(
                '-i', 'reverse.mp4',
                '-vf', 'trim=start_frame=1,setpts=PTS-STARTPTS',
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart',
                'reverse_cut.mp4'
            );

            // Step 5: concat demuxer（-c copy 高速連結）
            updateProgress(70);
            let fileListContent = "file 'forward.mp4'\nfile 'reverse_cut.mp4'\n";
            for (let i = 1; i < loopCount; i++) {
                fileListContent += "file 'forward_cut.mp4'\nfile 'reverse_cut.mp4'\n";
            }
            ffmpeg.FS('writeFile', 'filelist.txt', fileListContent);

            await ffmpeg.run(
                '-f', 'concat', '-i', 'filelist.txt',
                '-c', 'copy', '-movflags', '+faststart',
                'output.mp4'
            );

        } else {
            // concat demuxer方式（高速処理）
            console.log('Using concat demuxer mode (fast)');

            // list.txt用の変数
            let fileListContent = '';

            // Reverseモード（フレームカットOFF）: forward.mp4とreverse.mp4を作成
            if (loopMode === 'reverse') {
                console.log('Creating normalized forward and reversed videos...');

                // Step 1: 入力をH.264に正規化
                await ffmpeg.run(
                    '-i', 'input.mp4',
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-an',
                    '-movflags', '+faststart',
                    'forward.mp4'
                );
                updateProgress(15);

                // Step 2: 逆再生版を作成
                await ffmpeg.run(
                    '-i', 'forward.mp4',
                    '-vf', 'reverse',
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-an',
                    '-movflags', '+faststart',
                    'reverse.mp4'
                );
                updateProgress(25);

                // list.txtを生成: forward, reverse を交互に
                for (let i = 0; i < loopCount; i++) {
                    fileListContent += "file 'forward.mp4'\n";
                    fileListContent += "file 'reverse.mp4'\n";
                }
            } else {
                // Forwardモード: 元動画をそのまま連結
                for (let i = 0; i < loopCount; i++) {
                    fileListContent += "file 'input.mp4'\n";
                }
            }

            ffmpeg.FS('writeFile', 'filelist.txt', fileListContent);
            console.log('File list created:', fileListContent);
            updateProgress(30);

            // concat demuxerで連結
            await ffmpeg.run(
                '-f', 'concat',
                '-i', 'filelist.txt',
                '-c', 'copy',
                '-movflags', '+faststart',
                'output.mp4'
            );
        }

        console.log('FFmpeg completed');

        startProgressLabelAnimation('出力ファイルを準備中');
        // FFmpeg完了後、80%から95%まで滑らかにアニメーション
        startProgressAnimation(80, 95, 2000);

        // 出力ファイルの存在とサイズをチェック
        let outputData;
        try {
            outputData = ffmpeg.FS('readFile', 'output.mp4');
            if (!outputData || outputData.length === 0) {
                throw new Error('出力ファイルが空です。動画の結合に失敗しました。');
            }
            console.log('Output file size:', outputData.length, 'bytes');
        } catch (readError) {
            console.error('Failed to read output file:', readError);
            throw new Error('出力ファイルの読み込みに失敗しました。FFmpegでエラーが発生した可能性があります。');
        }

        // ファイル読み込み完了、アニメーション停止
        stopProgressAnimation();
        updateProgress(95);

        outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

        const resultUrl = URL.createObjectURL(outputBlob);
        elements.resultVideo.src = resultUrl;

        stopProgressLabelAnimation();
        // 95%から100%まで滑らかにアニメーション
        startProgressAnimation(95, 100, 400);

        // クリーンアップ
        try { ffmpeg.FS('unlink', 'input.mp4'); } catch(e) {}
        try { ffmpeg.FS('unlink', 'output.mp4'); } catch(e) {}
        try { ffmpeg.FS('unlink', 'forward.mp4'); } catch(e) {}
        try { ffmpeg.FS('unlink', 'reverse.mp4'); } catch(e) {}
        try { ffmpeg.FS('unlink', 'forward_cut.mp4'); } catch(e) {}
        try { ffmpeg.FS('unlink', 'reverse_cut.mp4'); } catch(e) {}
        try { ffmpeg.FS('unlink', 'filelist.txt'); } catch(e) {}

        // 少し待ってから完了表示（アニメーションが見えるように）
        await new Promise(resolve => setTimeout(resolve, 600));

        elements.progress.style.display = 'none';
        elements.resultSection.style.display = 'block';

    } catch (error) {
        console.error('Generation error:', error);
        stopProgressLabelAnimation();
        stopProgressAnimation();

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

// ===== MERGE MODE FUNCTIONS =====

// モード切り替え
function switchMode(mode) {
    currentMode = mode;
    elements.tabLoop.classList.toggle('active', mode === 'loop');
    elements.tabMerge.classList.toggle('active', mode === 'merge');
    elements.loopMode.style.display = mode === 'loop' ? 'block' : 'none';
    elements.mergeMode.style.display = mode === 'merge' ? 'block' : 'none';

    // 結果セクションを非表示
    elements.resultSection.style.display = 'none';
    elements.progress.style.display = 'none';
}

// 複数動画ファイル処理
async function handleMergeFiles(files) {
    const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/'));

    if (videoFiles.length === 0) {
        alert('動画ファイルを選択してください');
        return;
    }

    // 各動画のメタデータを取得
    for (const file of videoFiles) {
        const metadata = await getVideoMetadata(file);
        mergeVideos.push({
            file: file,
            name: file.name,
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height
        });
    }

    updateMergeVideoList();
}

// 動画のメタデータを取得（長さ、解像度）
function getVideoMetadata(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            const metadata = {
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight
            };
            URL.revokeObjectURL(video.src);
            resolve(metadata);
        };
        video.onerror = () => {
            resolve({ duration: 0, width: 0, height: 0 });
        };
        video.src = URL.createObjectURL(file);
    });
}

// Merge動画リスト更新
function updateMergeVideoList() {
    if (mergeVideos.length === 0) {
        elements.mergeInputSection.style.display = 'block';
        elements.mergeVideoList.style.display = 'none';
        elements.mergeControlsSection.style.display = 'none';
        elements.mergeOutputSection.style.display = 'none';
        return;
    }

    elements.mergeInputSection.style.display = 'none';
    elements.mergeVideoList.style.display = 'block';
    elements.mergeControlsSection.style.display = 'flex';
    elements.mergeOutputSection.style.display = 'block';

    elements.mergeVideoCount.textContent = mergeVideos.length;

    // リスト描画（ドラッグ可能）
    elements.mergeVideos.innerHTML = mergeVideos.map((v, i) => `
        <div class="merge-video-item" data-index="${i}" draggable="true">
            <span class="drag-handle">☰</span>
            <span class="video-number">${i + 1}</span>
            <span class="video-name">${v.name}</span>
            <span class="video-duration">${formatDuration(v.duration)}</span>
            <button class="remove-btn" onclick="removeMergeVideo(${i})">✕</button>
        </div>
    `).join('');

    // ドラッグ&ドロップイベントを設定
    setupDragAndDrop();

    updateMergeTotalDuration();
}

// 動画を削除
function removeMergeVideo(index) {
    mergeVideos.splice(index, 1);
    updateMergeVideoList();
}

// グローバルに公開
window.removeMergeVideo = removeMergeVideo;

// ドラッグ&ドロップ設定
let draggedItem = null;

function setupDragAndDrop() {
    const items = elements.mergeVideos.querySelectorAll('.merge-video-item');

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (draggedItem && draggedItem !== item) {
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;

                if (e.clientY < midY) {
                    item.classList.add('drag-over-top');
                    item.classList.remove('drag-over-bottom');
                } else {
                    item.classList.add('drag-over-bottom');
                    item.classList.remove('drag-over-top');
                }
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over-top', 'drag-over-bottom');

            if (draggedItem && draggedItem !== item) {
                const fromIndex = parseInt(draggedItem.dataset.index);
                const toIndex = parseInt(item.dataset.index);

                // 配列を並び替え
                const [moved] = mergeVideos.splice(fromIndex, 1);
                mergeVideos.splice(toIndex, 0, moved);

                // リストを再描画
                updateMergeVideoList();
            }
        });
    });
}

// 合計時間更新
function updateMergeTotalDuration() {
    const total = mergeVideos.reduce((sum, v) => sum + v.duration, 0);
    elements.mergeTotalDuration.textContent = formatDuration(total);
}

// フレームカット警告モーダル
function showFrameCutWarning() {
    return new Promise((resolve) => {
        const modal = document.getElementById('frameCutWarningModal');
        const checkbox = document.getElementById('warningConfirmCheck');
        const proceedBtn = document.getElementById('warningProceedBtn');
        const cancelBtn = document.getElementById('warningCancelBtn');

        // リセット
        checkbox.checked = false;
        proceedBtn.disabled = true;

        // モーダル表示
        modal.style.display = 'flex';

        // チェックボックス変更
        const onCheckChange = () => {
            proceedBtn.disabled = !checkbox.checked;
        };

        // 実行ボタン
        const onProceed = () => {
            cleanup();
            modal.style.display = 'none';
            resolve(true);
        };

        // キャンセルボタン
        const onCancel = () => {
            cleanup();
            modal.style.display = 'none';
            resolve(false);
        };

        // クリーンアップ
        const cleanup = () => {
            checkbox.removeEventListener('change', onCheckChange);
            proceedBtn.removeEventListener('click', onProceed);
            cancelBtn.removeEventListener('click', onCancel);
        };

        checkbox.addEventListener('change', onCheckChange);
        proceedBtn.addEventListener('click', onProceed);
        cancelBtn.addEventListener('click', onCancel);
    });
}

// Merge動画生成（メインスレッドで実行）
async function generateMergeVideo() {
    if (mergeVideos.length < 2) {
        alert('2本以上の動画を追加してください');
        return;
    }

    // フレームカットモードの警告
    if (frameCutMode > 0) {
        const proceed = await showFrameCutWarning();
        if (!proceed) return;
    }

    // 直接メインスレッド処理を実行
    await generateMergeVideoMainThread();
}

// メインスレッドでのMerge処理（フォールバック）
async function generateMergeVideoMainThread() {
    if (!ffmpeg) {
        alert('FFmpegが準備できていません。ページをリロードしてください。');
        return;
    }

    // 解像度チェック（全モード共通）
    // コピーモード（OFF）でも異なるスペックの動画は結合できない
    if (mergeVideos.length > 1) {
        const firstVideo = mergeVideos[0];
        const differentVideos = mergeVideos.filter(v =>
            v.width !== firstVideo.width || v.height !== firstVideo.height
        );

        if (differentVideos.length > 0) {
            const videoInfo = mergeVideos.map(v =>
                `  ${v.name}: ${v.width}x${v.height}`
            ).join('\n');

            alert(
                `⚠️ 異なる解像度の動画は結合できません。\n\n` +
                `検出された解像度:\n${videoInfo}\n\n` +
                `すべての動画が同じ解像度・フレームレートである必要があります。\n` +
                `同じソースから生成された動画を使用してください。`
            );
            return;
        }
    }

    // 進捗計算用にモードを設定
    currentProcessMode = 'merge';

    // ファイルサイズ警告
    const maxFileSize = Math.max(...mergeVideos.map(v => v.file.size));
    if (maxFileSize > 30 * 1024 * 1024) {
        const proceed = confirm(
            `⚠️ 大きなファイル（${formatFileSize(maxFileSize)}）が含まれています。\n\n` +
            `処理中にブラウザがフリーズする可能性があります。\n` +
            `続行しますか？`
        );
        if (!proceed) return;
    }

    // UI更新
    elements.mergeVideoList.style.display = 'none';
    elements.mergeControlsSection.style.display = 'none';
    elements.mergeOutputSection.style.display = 'none';
    elements.progress.style.display = 'block';
    elements.progressLabel.textContent = '動画を読み込み中...';
    elements.progressFill.classList.add('pulsing');
    updateProgress(0);

    try {
        // ファイル書き込み（進捗0-20%）
        for (let i = 0; i < mergeVideos.length; i++) {
            const fileSizeMB = (mergeVideos[i].file.size / (1024 * 1024)).toFixed(1);
            elements.progressLabel.textContent = `動画 ${i + 1}/${mergeVideos.length} を読み込み中... (${fileSizeMB}MB)`;
            console.log(`Writing file input${i}.mp4 (${fileSizeMB}MB)`);

            // ファイル読み込み進捗（0-20%）
            const loadProgress = Math.round((i / mergeVideos.length) * 20);
            updateProgress(loadProgress);

            await new Promise(resolve => setTimeout(resolve, 100));
            const fileData = await window.ffmpegFetchFile(mergeVideos[i].file);
            console.log(`File data size: ${fileData.length} bytes`);
            await new Promise(resolve => setTimeout(resolve, 50));
            ffmpeg.FS('writeFile', `input${i}.mp4`, fileData);
            console.log(`File input${i}.mp4 written successfully`);
        }

        elements.progressFill.classList.remove('pulsing');
        updateProgress(20);
        startProgressLabelAnimation('動画を結合中');

        console.log('Running FFmpeg...');
        console.log('Frame cut mode:', frameCutMode);

        if (frameCutMode === 0) {
            // フレームカットなし → concat demuxerで完全ストリーム連結
            // ファイルリストを作成（入力の順番通り）
            let fileListContent = '';
            for (let i = 0; i < mergeVideos.length; i++) {
                fileListContent += `file 'input${i}.mp4'\n`;
            }
            ffmpeg.FS('writeFile', 'filelist.txt', fileListContent);
            console.log('File list created:', fileListContent);

            // concat demuxerで連結（完全ストリーム連結）
            await ffmpeg.run(
                '-f', 'concat',
                '-i', 'filelist.txt',
                '-c', 'copy',
                '-movflags', '+faststart',
                'output.mp4'
            );
        } else {
            // フレームカットあり → filter_complex使用（再エンコード）
            let filterParts = [];
            let concatInputs = '';

            for (let i = 0; i < mergeVideos.length; i++) {
                const isFirstVideo = (i === 0);

                if (frameCutMode === 1) {
                    // 1フレームカット: 最初の動画以外の先頭フレームをカット
                    if (isFirstVideo) {
                        filterParts.push(`[${i}:v]setpts=PTS-STARTPTS[v${i}]`);
                    } else {
                        filterParts.push(`[${i}:v]trim=start_frame=1,setpts=PTS-STARTPTS[v${i}]`);
                    }
                } else if (frameCutMode === 2) {
                    // 2フレームカット: 最初の動画以外の先頭2フレームをカット
                    if (isFirstVideo) {
                        filterParts.push(`[${i}:v]setpts=PTS-STARTPTS[v${i}]`);
                    } else {
                        filterParts.push(`[${i}:v]trim=start_frame=2,setpts=PTS-STARTPTS[v${i}]`);
                    }
                }
                concatInputs += `[v${i}]`;
            }

            // concat
            filterParts.push(`${concatInputs}concat=n=${mergeVideos.length}:v=1:a=0,format=yuv420p[output]`);
            const filterComplex = filterParts.join(';');
            console.log('Filter complex:', filterComplex);

            // 入力引数を構築
            const inputArgs = [];
            for (let i = 0; i < mergeVideos.length; i++) {
                inputArgs.push('-i', `input${i}.mp4`);
            }

            await ffmpeg.run(
                ...inputArgs,
                '-filter_complex', filterComplex,
                '-map', '[output]',
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-vsync', 'vfr',
                '-threads', '1',
                '-movflags', '+faststart',
                'output.mp4'
            );
        }

        console.log('FFmpeg completed');

        startProgressLabelAnimation('出力ファイルを準備中');
        // FFmpeg完了後、70%から85%まで滑らかにアニメーション（3秒間）
        startProgressAnimation(70, 85, 3000);

        // 出力ファイルの存在とサイズをチェック
        let outputData;
        try {
            outputData = ffmpeg.FS('readFile', 'output.mp4');
            if (!outputData || outputData.length === 0) {
                throw new Error('出力ファイルが空です。動画の結合に失敗しました。');
            }
            console.log('Output file size:', outputData.length, 'bytes');
        } catch (readError) {
            console.error('Failed to read output file:', readError);
            throw new Error('出力ファイルの読み込みに失敗しました。FFmpegでエラーが発生した可能性があります。');
        }

        // ファイル読み込み完了、アニメーション停止
        stopProgressAnimation();
        updateProgress(90);

        outputBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

        const resultUrl = URL.createObjectURL(outputBlob);
        elements.resultVideo.src = resultUrl;

        stopProgressLabelAnimation();
        // 90%から100%まで滑らかにアニメーション
        startProgressAnimation(90, 100, 500);

        // クリーンアップ
        for (let i = 0; i < mergeVideos.length; i++) {
            try { ffmpeg.FS('unlink', `input${i}.mp4`); } catch(e) {}
        }
        try { ffmpeg.FS('unlink', 'filelist.txt'); } catch(e) {}
        try { ffmpeg.FS('unlink', 'output.mp4'); } catch(e) {}

        // モードをリセット
        currentProcessMode = 'loop';

        // 少し待ってから完了表示（アニメーションが見えるように）
        await new Promise(resolve => setTimeout(resolve, 600));

        elements.progress.style.display = 'none';
        elements.resultSection.style.display = 'block';

    } catch (error) {
        console.error('Merge error:', error);
        elements.progressFill.classList.remove('pulsing');
        stopProgressLabelAnimation();
        stopProgressAnimation();
        currentProcessMode = 'loop'; // モードをリセット

        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('OOM') || errorMsg.includes('memory') || errorMsg.includes('abort')) {
            alert('メモリ不足エラー\n\n動画の合計サイズが大きすぎます。');
        } else {
            alert(`エラー: ${errorMsg}`);
        }

        resetMergeUI();
    }
}

// Merge UIリセット
function resetMergeUI() {
    mergeVideos = [];
    updateMergeVideoList();
    elements.progress.style.display = 'none';
    elements.resultSection.style.display = 'none';
}

// ダウンロード（Merge用）
function downloadMergeResult() {
    if (!outputBlob) return;

    const fileName = `merged_${Date.now()}.mp4`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(outputBlob);
    link.download = fileName;
    link.click();
}

// ===== END MERGE MODE FUNCTIONS =====

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

    // タイトル変更（Wowモード用）
    const titlePrefix = document.getElementById('titlePrefix');
    const titleSuffix = document.getElementById('titleSuffix');
    const lopO = document.getElementById('lopO');
    if (titlePrefix && titleSuffix && lopO) {
        if (theme === 'pink') {
            titlePrefix.textContent = 'NSFW';
            lopO.textContent = 'OOOO';
            titleSuffix.textContent = 'P♥';
        } else {
            titlePrefix.textContent = 'WEBLO';
            lopO.textContent = 'OOO';
            titleSuffix.textContent = 'P';
        }
    }

    // タブ名変更（Wowモード用）
    if (elements.tabLoop && elements.tabMerge) {
        if (theme === 'pink') {
            elements.tabLoop.textContent = 'Loop♥';
            elements.tabMerge.textContent = 'Merge♥';
        } else {
            elements.tabLoop.textContent = 'Loop';
            elements.tabMerge.textContent = 'Merge';
        }
    }
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
        handleVideoFile(e.dataTransfer.files);
    });

    elements.dropZone.addEventListener('click', () => {
        elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleVideoFile(e.target.files);
        e.target.value = '';
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
        // Reverseモード時はフレームカットUIを表示
        if (elements.frameCutGroup) {
            elements.frameCutGroup.style.display = 'block';
        }
        updateEstimatedDuration();
    });

    elements.modeForward.addEventListener('click', () => {
        loopMode = 'forward';
        elements.modeForward.classList.add('active');
        elements.modeReverse.classList.remove('active');
        // Forwardモード時はフレームカットUIを非表示
        if (elements.frameCutGroup) {
            elements.frameCutGroup.style.display = 'none';
        }
        updateEstimatedDuration();
    });

    // フレームカット（Loop用）
    if (elements.frameCutOff) {
        elements.frameCutOff.addEventListener('click', () => {
            loopFrameCut = false;
            elements.frameCutOff.classList.add('active');
            elements.frameCutOn.classList.remove('active');
            if (elements.frameCutHint) {
                elements.frameCutHint.innerHTML = 'OFF: 高速処理<br>（60FPS対応）';
            }
        });
    }

    if (elements.frameCutOn) {
        elements.frameCutOn.addEventListener('click', () => {
            loopFrameCut = true;
            elements.frameCutOn.classList.add('active');
            elements.frameCutOff.classList.remove('active');
            if (elements.frameCutHint) {
                elements.frameCutHint.innerHTML = 'ON: 滑らかループ<br>（高FPSは警告）';
            }
        });
    }

    // テーマ
    elements.themeDark.addEventListener('click', () => setTheme('dark'));
    elements.themeDay.addEventListener('click', () => setTheme('day'));
    elements.themePink.addEventListener('click', () => setTheme('pink'));

    // 生成・ダウンロード
    elements.generateBtn.addEventListener('click', () => {
        if (batchLoopVideos.length > 0) {
            generateBatchLoopVideos();
        } else {
            generateLoopVideo();
        }
    });
    elements.downloadBtn.addEventListener('click', () => {
        if (batchOutputBlobs.length > 0 && outputBlob) {
            // バッチZIP再ダウンロード
            const link = document.createElement('a');
            link.href = URL.createObjectURL(outputBlob);
            link.download = `loop_videos_${Date.now()}.zip`;
            link.click();
        } else if (currentMode === 'merge') {
            downloadMergeResult();
        } else {
            downloadResult();
        }
    });
    elements.newVideoBtn.addEventListener('click', () => {
        if (batchLoopVideos.length > 0 || batchOutputBlobs.length > 0) {
            resetBatchUI();
        } else if (currentMode === 'merge') {
            resetMergeUI();
        } else {
            resetUI();
        }
    });

    // バッチ: 動画追加ボタン
    elements.addMoreLoopBtn.addEventListener('click', () => {
        elements.fileInput.click();
    });

    // ===== MERGE MODE EVENT LISTENERS =====

    // タブ切り替え
    elements.tabLoop.addEventListener('click', () => switchMode('loop'));
    elements.tabMerge.addEventListener('click', () => switchMode('merge'));

    // Mergeドラッグ&ドロップ
    elements.mergeDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.mergeDropZone.classList.add('drag-over');
    });

    elements.mergeDropZone.addEventListener('dragleave', () => {
        elements.mergeDropZone.classList.remove('drag-over');
    });

    elements.mergeDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.mergeDropZone.classList.remove('drag-over');
        handleMergeFiles(e.dataTransfer.files);
    });

    elements.mergeDropZone.addEventListener('click', () => {
        elements.mergeFileInput.click();
    });

    elements.mergeFileInput.addEventListener('change', (e) => {
        handleMergeFiles(e.target.files);
        e.target.value = ''; // リセット
    });

    elements.addMoreBtn.addEventListener('click', () => {
        elements.mergeFileInput.click();
    });

    // フレームカットモード
    elements.frameCut0.addEventListener('click', () => {
        frameCutMode = 0;
        elements.frameCut0.classList.add('active');
        elements.frameCut1.classList.remove('active');
        elements.frameCut2.classList.remove('active');
        updateMergeNote();
    });

    elements.frameCut1.addEventListener('click', () => {
        frameCutMode = 1;
        elements.frameCut1.classList.add('active');
        elements.frameCut0.classList.remove('active');
        elements.frameCut2.classList.remove('active');
        updateMergeNote();
    });

    elements.frameCut2.addEventListener('click', () => {
        frameCutMode = 2;
        elements.frameCut2.classList.add('active');
        elements.frameCut0.classList.remove('active');
        elements.frameCut1.classList.remove('active');
        updateMergeNote();
    });

    // Merge生成
    elements.mergeGenerateBtn.addEventListener('click', generateMergeVideo);
}

// 初期化
async function init() {
    setupEventListeners();
    updateMergeNote();
    await initFFmpeg();
}

document.addEventListener('DOMContentLoaded', init);
