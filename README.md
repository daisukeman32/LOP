# LOP Ver2 - Professional Loop Video Creator

洗練された動画ループ作成ツール（Electronベース）

## 🎬 主要機能

### Ver2 新機能
- **🎲 ランダム速度**: 各ループごとに0.5x～3.0xの可変速度適用
- **🔢 連番自動保存**: video_loop_001.mp4 形式で自動ファイル名生成

### 基本機能  
- **📁 動画選択**: ドラッグ&ドロップ対応の直感的ファイル選択
- **📺 リアルタイムプレビュー**: 選択動画の即座確認
- **⏱️ 時間計算**: ループ回数に応じた総再生時間表示
- **🔄 正逆ループ**: 正再生→逆再生のスムーズな繰り返し
- **🎥 高品質出力**: H.264エンコードによるMP4出力

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

## 🚀 使用方法

### 基本操作
1. **アプリケーションを起動**
2. **📁 動画を選択**ボタンで動画ファイルを選択
3. **プレビュー確認**で内容をチェック  
4. **ループ回数設定**（1-20回）で総時間確認

### Ver2 新機能の使用
5. **🎲 ランダム速度**をチェックでオン/オフ
   - スライダーで最小・最大速度を調整（0.5x-3.0x）
   - 概算時間がリアルタイム表示
6. **🎬 ループ動画を出力**をクリック
7. **保存フォルダを選択**（ファイル名は自動連番生成）

### 出力例
```
入力: sample.mp4 → sample_loop_001.mp4
再実行: sample.mp4 → sample_loop_002.mp4
```

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

## 💻 推奨システムスペック

### 最小動作環境
- **OS**: Windows 10/11 (64bit)
- **CPU**: Intel Core i3-8100 / AMD Ryzen 3 2200G 以上
- **RAM**: 8GB以上
- **GPU**: 内蔵GPU（Intel UHD Graphics 630以上）
- **ストレージ**: 500MB以上の空き容量

### 推奨環境（快適動作）
- **CPU**: Intel Core i5-10400 / AMD Ryzen 5 3600 以上
- **RAM**: 16GB以上  
- **GPU**: 専用GPU（GTX 1660 / RX 580以上）
- **ストレージ**: SSD with 2GB以上の空き容量

## 🔧 技術仕様

- **フレームワーク**: Electron 28.x
- **動画処理**: FFmpeg 8.0 + fluent-ffmpeg
- **UI**: モダン ガラスモーフィズム デザイン
- **出力形式**: MP4 (H.264, CRF23, medium preset)
- **サポート入力**: MP4, MOV, AVI, MKV, WebM
- **新機能**: ランダム速度変更、連番自動保存

## ⚠️ 注意事項

- **FFmpeg必須**: 動画処理エンジンとして必要
- **処理時間**: 高解像度・長時間動画は時間がかかります
- **ランダム速度**: より高いCPU性能が必要
- **ファイルサイズ**: ループ回数に比例して増加