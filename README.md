# るーぷツール v1.0

シンプルな動画ループ作成ツール（Electronベース）

## 機能

- 動画ファイル1つを選択
- 正再生→逆再生を指定回数ループ  
- MP4形式で出力

## 必要なもの

**重要**: 本ツールを使用するには、FFmpegのインストールが必要です。

### FFmpegのインストール方法

1. **Windows**:
   ```bash
   # Chocolateyを使用する場合
   choco install ffmpeg
   
   # 手動インストールの場合
   # https://ffmpeg.org/download.html からダウンロードして環境変数に追加
   ```

2. **macOS**:
   ```bash
   # Homebrewを使用
   brew install ffmpeg
   ```

3. **Linux**:
   ```bash
   # Ubuntu/Debian
   sudo apt update && sudo apt install ffmpeg
   
   # CentOS/RHEL
   sudo yum install ffmpeg
   ```

## 使用方法

1. アプリケーションを起動
2. 「📁 動画ファイル選択」ボタンで動画を選択
3. ループ回数を設定（デフォルト: 3回）
4. 「🎬 ループ動画を出力」ボタンをクリック
5. 保存先を選択して出力開始

## 開発・実行

```bash
# 依存関係のインストール
npm install

# 開発モードで起動
npm run dev

# 通常起動
npm start
```

## ファイル構成

```
るーぷつくーる/
├── package.json        # プロジェクト設定
├── main.js             # Electronメインプロセス
├── index.html          # UI
├── styles.css          # スタイル
├── renderer.js         # UIロジック
└── README.md           # このファイル
```

## 技術仕様

- **フレームワーク**: Electron 28.x
- **動画処理**: FFmpeg + fluent-ffmpeg
- **出力形式**: MP4 (H.264, CRF23)
- **サポート入力**: MP4, MOV, AVI, MKV, WebM

## 注意事項

- FFmpegが必要です
- 大きな動画ファイルは処理時間がかかります
- ループ回数が多いと出力ファイルサイズが大きくなります