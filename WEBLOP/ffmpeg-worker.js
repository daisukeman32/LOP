// FFmpeg Web Worker
// メインスレッドをブロックせずにFFmpeg処理を実行

let ffmpeg = null;
let ffmpegFetchFile = null;

// FFmpeg初期化
async function initFFmpeg() {
    try {
        // FFmpegスクリプトを動的に読み込み
        importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');

        const { createFFmpeg, fetchFile } = FFmpeg;

        ffmpeg = createFFmpeg({
            log: true,
            progress: ({ ratio }) => {
                self.postMessage({ type: 'progress', ratio: ratio });
            }
        });

        ffmpegFetchFile = fetchFile;

        self.postMessage({ type: 'status', message: 'FFmpegを読み込み中...' });
        await ffmpeg.load();
        self.postMessage({ type: 'ready' });
    } catch (error) {
        console.error('Worker FFmpeg init error:', error);
        self.postMessage({ type: 'error', message: 'Worker初期化エラー: ' + error.message });
    }
}

// ファイル書き込み
async function writeFile(name, data) {
    const fileData = await ffmpegFetchFile(new Blob([data]));
    ffmpeg.FS('writeFile', name, fileData);
}

// FFmpeg実行
async function runFFmpeg(args) {
    await ffmpeg.run(...args);
}

// ファイル読み込み
function readFile(name) {
    return ffmpeg.FS('readFile', name);
}

// ファイル削除
function unlinkFile(name) {
    try {
        ffmpeg.FS('unlink', name);
    } catch (e) {
        // ignore
    }
}

// メッセージハンドラ
self.onmessage = async function(e) {
    const { type, payload } = e.data;

    try {
        switch (type) {
            case 'init':
                await initFFmpeg();
                break;

            case 'writeFile':
                self.postMessage({ type: 'status', message: `Writing ${payload.name}...` });
                await writeFile(payload.name, payload.data);
                self.postMessage({ type: 'writeComplete', name: payload.name });
                break;

            case 'run':
                self.postMessage({ type: 'status', message: 'Processing...' });
                await runFFmpeg(payload.args);
                self.postMessage({ type: 'runComplete' });
                break;

            case 'readFile':
                const data = readFile(payload.name);
                self.postMessage({ type: 'fileData', data: data.buffer }, [data.buffer]);
                break;

            case 'unlink':
                unlinkFile(payload.name);
                self.postMessage({ type: 'unlinkComplete' });
                break;

            case 'merge':
                // マージ処理を一括で実行
                await processMerge(payload);
                break;
        }
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message || error.toString() });
    }
};

// マージ処理
async function processMerge(payload) {
    const { files, filterComplex, outputArgs, inputCount } = payload;

    // ファイル書き込み
    for (let i = 0; i < files.length; i++) {
        self.postMessage({
            type: 'status',
            message: `動画 ${i + 1}/${files.length} を読み込み中...`
        });
        self.postMessage({ type: 'progress', ratio: (i / files.length) * 0.3 });

        const fileData = await ffmpegFetchFile(new Blob([files[i].data]));
        ffmpeg.FS('writeFile', `input${i}.mp4`, fileData);
    }

    self.postMessage({ type: 'status', message: '動画を結合中...' });
    self.postMessage({ type: 'progress', ratio: 0.3 });

    // FFmpeg実行
    const inputArgs = [];
    for (let i = 0; i < inputCount; i++) {
        inputArgs.push('-i', `input${i}.mp4`);
    }

    await ffmpeg.run(
        ...inputArgs,
        '-filter_complex', filterComplex,
        ...outputArgs
    );

    self.postMessage({ type: 'status', message: '出力ファイルを準備中...' });
    self.postMessage({ type: 'progress', ratio: 1 });

    // 出力ファイル読み込み
    const outputData = ffmpeg.FS('readFile', 'output.mp4');

    // クリーンアップ
    for (let i = 0; i < inputCount; i++) {
        try { ffmpeg.FS('unlink', `input${i}.mp4`); } catch(e) {}
    }
    try { ffmpeg.FS('unlink', 'output.mp4'); } catch(e) {}

    // 結果を送信
    self.postMessage({
        type: 'mergeComplete',
        data: outputData.buffer
    }, [outputData.buffer]);
}
