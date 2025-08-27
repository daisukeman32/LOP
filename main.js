const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// FFmpegのパスを設定
const ffmpegPath = path.join(__dirname, 'ffmpeg-8.0-essentials_build', 'bin', 'ffmpeg.exe');
ffmpeg.setFfmpegPath(ffmpegPath);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'るーぷツール v1.0'
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

// ループ動画生成
ipcMain.handle('generate-loop', async (event, { inputPath, loopCount, outputPath }) => {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const os = require('os');
    
    // 一時ディレクトリを作成
    const tempDir = path.join(os.tmpdir(), 'loop-tool-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    
    // 総進行状況の管理
    let currentStep = 0;
    const totalSteps = loopCount * 2; // 正再生 + 逆再生 の組み合わせ
    
    const updateOverallProgress = (stepProgress = 100) => {
      const overallProgress = ((currentStep + (stepProgress / 100)) / totalSteps) * 100;
      event.sender.send('progress-update', Math.min(overallProgress, 100));
    };
    
    // フィルターグラフを構築（シンプルな方法）
    let filterComplex = '';
    let inputMaps = '';
    
    for (let i = 0; i < loopCount; i++) {
      // 正再生部分
      filterComplex += `[0:v]copy[forward${i}];`;
      // 逆再生部分
      filterComplex += `[0:v]reverse[reverse${i}];`;
      
      inputMaps += `[forward${i}][reverse${i}]`;
    }
    
    // すべてを連結
    filterComplex += `${inputMaps}concat=n=${loopCount * 2}:v=1:a=0[output]`;
    
    // FFmpegコマンドを実行
    const command = ffmpeg(inputPath)
      .complexFilter(filterComplex)
      .outputOptions([
        '-map', '[output]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23'
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg コマンド:', commandLine);
        updateOverallProgress(0);
      })
      .on('progress', (progress) => {
        updateOverallProgress(progress.percent || 0);
      })
      .on('end', () => {
        // 一時ディレクトリのクリーンアップ
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        updateOverallProgress(100);
        resolve({ success: true, outputPath: outputPath });
      })
      .on('error', (err) => {
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

// 保存先選択ダイアログ
ipcMain.handle('select-output-path', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'MP4ファイル', extensions: ['mp4'] }
    ],
    defaultPath: 'loop_output.mp4'
  });
  
  if (!result.canceled) {
    return result.filePath;
  }
  return null;
});