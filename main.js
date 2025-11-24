const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

// FFmpegバイナリのパス設定
const fs = require('fs');

function setupFFmpegPaths() {
  // アプリがパッケージングされているかどうかで判定
  if (!app.isPackaged) {
    // 開発時：@ffmpeg-installerからバイナリを使用
    console.log('開発モード: @ffmpeg-installerを使用');
    try {
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
      ffmpeg.setFfprobePath(ffprobeInstaller.path);
      console.log('FFmpeg開発パス設定完了:', ffmpegInstaller.path);
    } catch (error) {
      console.error('FFmpeg開発パス設定エラー:', error);
    }
  } else {
    // 本番時：アプリリソース内のバイナリを使用
    console.log('本番モード: 内蔵FFmpegを使用');
    
    // アプリにバンドルされたFFmpegバイナリを使用
    const resourcesPath = process.resourcesPath;
    const ffmpegPath = path.join(resourcesPath, 'bin', 'ffmpeg');
    const ffprobePath = path.join(resourcesPath, 'bin', 'ffprobe');
    
    console.log('アーキテクチャ:', process.arch);
    console.log('リソースパス:', resourcesPath);
    console.log('FFmpegパス:', ffmpegPath);
    
    if (fs.existsSync(ffmpegPath)) {
      // バイナリを実行可能にする
      try {
        fs.chmodSync(ffmpegPath, '755');
        ffmpeg.setFfmpegPath(ffmpegPath);
        console.log('FFmpeg内蔵バイナリを使用:', ffmpegPath);
      } catch (error) {
        console.error('FFmpegバイナリの権限設定エラー:', error);
      }
    } else {
      console.warn('FFmpeg内蔵バイナリが見つかりません。フォールバックを試します。');
      try {
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);
        console.log('フォールバック: @ffmpeg-installer使用');
      } catch (error) {
        console.error('FFmpegの設定に失敗しました:', error);
      }
    }
    
    if (fs.existsSync(ffprobePath)) {
      try {
        fs.chmodSync(ffprobePath, '755');
        ffmpeg.setFfprobePath(ffprobePath);
        console.log('FFprobe内蔵バイナリを使用:', ffprobePath);
      } catch (error) {
        console.error('FFprobeバイナリの権限設定エラー:', error);
      }
    } else {
      try {
        ffmpeg.setFfprobePath(ffprobeInstaller.path);
        console.log('フォールバック: @ffprobe-installer使用');
      } catch (error) {
        console.error('FFprobeの設定に失敗しました:', error);
      }
    }
  }
}

// FFmpegパス初期化
setupFFmpegPaths();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // ウィンドウの準備ができるまで非表示
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'LPOicon.png'),
    title: 'LOP v2.0',
    center: true, // ウィンドウを画面中央に配置
    backgroundColor: '#1a1a1a' // 背景色を設定してちらつき防止
  });

  // ウィンドウの準備ができてから表示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus(); // ウィンドウにフォーカス
  });

  mainWindow.loadFile('index.html');

  // 開発時はDevToolsを開く
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ファイル選択ダイアログ
ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: '動画ファイル', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// 複数ファイル選択ダイアログ
ipcMain.handle('select-multiple-video-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: '動画ファイル', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return null;
});

// バッチ処理の保存先フォルダ選択
ipcMain.handle('select-batch-output-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'ループ動画の保存先フォルダを選択',
    buttonLabel: '選択'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// ランダム速度生成関数
function generateRandomSpeed(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

// 品質設定を取得する関数
function getQualityOptions(quality = 'high') {
  const qualityPresets = {
    ultra: {
      preset: 'slow',
      crf: '15',
      description: '超高品質 - ほぼ無劣化（処理時間: 非常に長い）'
    },
    high: {
      preset: 'slow',
      crf: '17',
      description: '高品質 - 元の画質を維持（処理時間: 長い）'
    },
    medium: {
      preset: 'medium',
      crf: '23',
      description: '標準品質 - バランス重視（処理時間: 中程度）'
    },
    fast: {
      preset: 'fast',
      crf: '28',
      description: '高速処理 - 速度優先（処理時間: 短い）'
    }
  };

  const selectedQuality = qualityPresets[quality] || qualityPresets.high;

  return [
    '-map', '[output]',
    '-c:v', 'libx264',
    '-preset', selectedQuality.preset,
    '-crf', selectedQuality.crf,
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-profile:v', 'high',
    '-level', '4.2',
    '-bf', '2',
    '-g', '300'
  ];
}

// 連番ファイル名生成関数
function generateSequentialFilename(basePath, baseName, extension) {
  const fs = require('fs');
  const path = require('path');
  
  let counter = 1;
  let finalPath;
  
  do {
    const paddedNumber = counter.toString().padStart(3, '0');
    const fileName = `${baseName}_${paddedNumber}.${extension}`;
    finalPath = path.join(basePath, fileName);
    counter++;
  } while (fs.existsSync(finalPath));
  
  return finalPath;
}

// ループ動画生成
ipcMain.handle('generate-loop', async (event, { inputPath, loopCount, outputPath, randomSpeed = false, minSpeed = 1.0, maxSpeed = 1.0, loopMode = 'reverse', quality = 'ultra' }) => {
  return new Promise((resolve, reject) => {
    console.log('=== ループ生成開始 ===');
    console.log('入力パラメータ:', { inputPath, loopCount, outputPath, randomSpeed, minSpeed, maxSpeed, loopMode, quality });
    console.log('loopCountの型:', typeof loopCount, 'loopCountの値:', loopCount);
    const fs = require('fs');
    const os = require('os');
    
    // 一時ディレクトリを作成
    const tempDir = path.join(os.tmpdir(), 'loop-tool-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    
    // 進行状況更新関数
    const updateOverallProgress = (progress = 0) => {
      event.sender.send('progress-update', Math.min(progress, 100));
    };
    
    // メモリ効率を改善した実装
    let filterComplex;

    if (loopMode === 'reverse') {
      // Reverseモード: 1234-321-234-321 (最初と最後のフレームを除去して滑らか)
      let filterParts = [];
      let concatInputs = '';

      // 最初のループ: 完全な forward + reverse（最後のフレーム除去）
      filterParts.push(`[0:v]copy[forward0]`);
      filterParts.push(`[0:v]reverse,trim=start_frame=1[reverse0]`);
      concatInputs += `[forward0][reverse0]`;

      // 2回目以降: 最初と最後のフレームを除去
      for (let i = 1; i < loopCount; i++) {
        filterParts.push(`[0:v]trim=start_frame=1,copy[forward${i}]`);
        filterParts.push(`[0:v]reverse,trim=start_frame=1[reverse${i}]`);
        concatInputs += `[forward${i}][reverse${i}]`;
      }

      filterParts.push(`${concatInputs}concat=n=${loopCount * 2}:v=1:a=0[output]`);
      filterComplex = filterParts.join(';');
    } else {
      // Forwardモード: 12345-2345-2345 (Mac版と同じロジック)
      // 高FPS対応：フレーム単位ではなくPTS（時間）ベースで処理
      let filterParts = [];
      let concatInputs = '';

      // 最初のループ: 完全な動画
      filterParts.push(`[0:v]copy[forward0]`);
      concatInputs += `[forward0]`;

      // 2回目以降: select filterで最初のフレームを除外
      for (let i = 1; i < loopCount; i++) {
        filterParts.push(`[0:v]select='gte(n\\,1)',setpts=PTS-STARTPTS[forward${i}]`);
        concatInputs += `[forward${i}]`;
      }

      filterParts.push(`${concatInputs}concat=n=${loopCount}:v=1:a=0[output]`);
      filterComplex = filterParts.join(';');
    }
    
    console.log('ループ数:', loopCount, '使用フィルター:', filterComplex);
    
    // タイムアウト設定 (10分)
    const timeout = setTimeout(() => {
      console.log('FFmpeg処理がタイムアウトしました');
      command.kill('SIGKILL');
      resolve({ success: false, error: '処理がタイムアウトしました（10分経過）' });
    }, 600000); // 10分

    // 品質設定を適用
    const qualityOptions = getQualityOptions(quality);
    const command = ffmpeg(inputPath)
      .complexFilter(filterComplex)
      .outputOptions(qualityOptions)
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg コマンド:', commandLine);
        updateOverallProgress(0);
      })
      .on('progress', (progress) => {
        updateOverallProgress(progress.percent || 0);
      })
      .on('end', () => {
        clearTimeout(timeout); // タイムアウトをクリア
        // 一時ディレクトリのクリーンアップ
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        updateOverallProgress(100);
        resolve({ success: true, outputPath: outputPath });
      })
      .on('error', (err) => {
        clearTimeout(timeout); // タイムアウトをクリア
        // エラー時も一時ディレクトリをクリーンアップ
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.error('FFmpeg エラー:', err);
        reject({ 
          success: false, 
          error: `動画処理エラー: ${err.message}` 
        });
      });
    
    // FFmpegプロセス開始
    command.run();
  });
});

// 保存先選択（連番自動生成）
ipcMain.handle('select-output-path', async (event, inputFileName) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '保存先フォルダを選択'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedDirectory = result.filePaths[0];

    // 入力ファイル名から基本名を生成
    const baseName = inputFileName ?
      path.basename(inputFileName, path.extname(inputFileName)) + '_loop' :
      'loop_output';

    // 連番ファイル名を生成
    const sequentialPath = generateSequentialFilename(selectedDirectory, baseName, 'mp4');

    return sequentialPath;
  }
  return null;
});

// バッチ処理：複数ファイルを一括でループ化
ipcMain.handle('generate-batch-loop', async (event, { inputPaths, loopCount, randomSpeed = false, minSpeed = 1.0, maxSpeed = 1.0, outputDir = null, loopMode = 'reverse', quality = 'ultra' }) => {
  try {
    console.log('=== バッチ処理開始 ===');
    console.log('ファイル数:', inputPaths.length);
    console.log('ループ回数:', loopCount);
    console.log('再生モード:', loopMode);
    console.log('品質:', quality);
    console.log('保存先:', outputDir);

    // 保存先フォルダの確認・作成
    if (!outputDir) {
      // outputDirが指定されていない場合は従来通りホームディレクトリのLOPCOMP
      const os = require('os');
      const homeDir = os.homedir();
      outputDir = path.join(homeDir, 'LOPCOMP');
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log('保存先フォルダを作成:', outputDir);
    }

    const totalFiles = inputPaths.length;
    let completedFiles = 0;
    const results = [];

    // 各ファイルを順次処理
    for (const inputPath of inputPaths) {
      const inputFileName = path.basename(inputPath, path.extname(inputPath));
      const outputFileName = `${inputFileName}_loop.mp4`;
      const outputPath = path.join(outputDir, outputFileName);

      // 進捗通知
      event.sender.send('batch-progress-update', {
        current: completedFiles,
        total: totalFiles,
        fileName: path.basename(inputPath)
      });

      console.log(`処理中 (${completedFiles + 1}/${totalFiles}): ${inputFileName}`);

      try {
        // 個別のループ動画生成
        const result = await new Promise((resolve, reject) => {
          const os = require('os');
          const tempDir = path.join(os.tmpdir(), 'loop-tool-batch-' + Date.now());
          fs.mkdirSync(tempDir, { recursive: true });

          // 進行状況更新関数
          const updateProgress = (progress = 0) => {
            event.sender.send('progress-update', Math.min(progress, 100));
          };

          // メモリ効率を改善した実装
          let filterComplex;

          if (loopMode === 'reverse') {
            // Reverseモード: 1234-321-234-321
            let filterParts = [];
            let concatInputs = '';

            filterParts.push(`[0:v]copy[forward0]`);
            filterParts.push(`[0:v]reverse,trim=start_frame=1[reverse0]`);
            concatInputs += `[forward0][reverse0]`;

            for (let i = 1; i < loopCount; i++) {
              filterParts.push(`[0:v]trim=start_frame=1,copy[forward${i}]`);
              filterParts.push(`[0:v]reverse,trim=start_frame=1[reverse${i}]`);
              concatInputs += `[forward${i}][reverse${i}]`;
            }

            filterParts.push(`${concatInputs}concat=n=${loopCount * 2}:v=1:a=0[output]`);
            filterComplex = filterParts.join(';');
          } else {
            // Forwardモード: 12345-2345-2345 (Mac版と同じロジック)
            // 高FPS対応：select filterで最初のフレームを除外
            let filterParts = [];
            let concatInputs = '';

            // 最初のループ: 完全な動画
            filterParts.push(`[0:v]copy[forward0]`);
            concatInputs += `[forward0]`;

            // 2回目以降: select filterで最初のフレームを除外
            for (let i = 1; i < loopCount; i++) {
              filterParts.push(`[0:v]select='gte(n\\,1)',setpts=PTS-STARTPTS[forward${i}]`);
              concatInputs += `[forward${i}]`;
            }

            filterParts.push(`${concatInputs}concat=n=${loopCount}:v=1:a=0[output]`);
            filterComplex = filterParts.join(';');
          }

          const timeout = setTimeout(() => {
            console.log('バッチ処理: FFmpegタイムアウト');
            command.kill('SIGKILL');
            resolve({ success: false, error: 'タイムアウト' });
          }, 600000);

          const qualityOptions = getQualityOptions(quality);
          const command = ffmpeg(inputPath)
            .complexFilter(filterComplex)
            .outputOptions(qualityOptions)
            .output(outputPath)
            .on('start', (commandLine) => {
              console.log('FFmpeg開始:', inputFileName);
              updateProgress(0);
            })
            .on('progress', (progress) => {
              updateProgress(progress.percent || 0);
            })
            .on('end', () => {
              clearTimeout(timeout);
              fs.rmSync(tempDir, { recursive: true, force: true });
              updateProgress(100);
              resolve({ success: true, outputPath: outputPath });
            })
            .on('error', (err) => {
              clearTimeout(timeout);
              fs.rmSync(tempDir, { recursive: true, force: true });
              console.error('FFmpegエラー:', err);
              resolve({ success: false, error: err.message });
            });

          command.run();
        });

        results.push(result);
        completedFiles++;

        // 進捗更新
        event.sender.send('batch-progress-update', {
          current: completedFiles,
          total: totalFiles,
          fileName: path.basename(inputPath)
        });

      } catch (error) {
        console.error(`ファイル処理エラー (${inputFileName}):`, error);
        results.push({ success: false, error: error.message, fileName: inputFileName });
        completedFiles++;
      }
    }

    // 成功したファイル数をカウント
    const successCount = results.filter(r => r.success).length;
    console.log(`=== バッチ処理完了 ===`);
    console.log(`成功: ${successCount}/${totalFiles}`);

    return {
      success: true,
      outputDir: outputDir,
      totalFiles: totalFiles,
      successCount: successCount,
      results: results
    };

  } catch (error) {
    console.error('バッチ処理エラー:', error);
    return {
      success: false,
      error: error.message
    };
  }
});