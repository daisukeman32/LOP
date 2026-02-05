# CLAUDE.md

## プロジェクト概要

**WEBLOP** - Web版ループ動画作成ツール（Netlifyデプロイ用）

FFmpeg.wasmを使用してブラウザ上で動画のループ処理を行う。

**重要：Electron版（main.js, renderer.js等）は使用しない。WEBLOPのみ。**

## ファイル構成

```
WEBLOP/          → 開発用
WEBLOP_DEPLOY/   → Netlifyデプロイ用（本番）
```

※ルート直下のmain.js, renderer.js, index.html等はElectron版の残骸。触らない。

## 開発コマンド

```bash
cd WEBLOP
npm start
# http://localhost:3000
```

## 現在のバージョン: v2.5

## Reverseモードの仕様

### フレームカット設定（トグルスイッチ）

| 設定 | パターン | 処理 | 高FPS対応 |
|-----|---------|------|----------|
| OFF（デフォルト） | 123455432 | concat demuxer (-c copy) | OK |
| ON | 12345432 | filter_complex (再エンコード) | NG（アラート） |

### フレームカットOFF（123455432パターン）
- forward + reverse をそのまま連結
- 端フレームが2回出る（5が2回、1が2回）
- concat demuxer + `-c copy` で連結時再エンコード不要
- 60FPS以上でも処理可能
- 視覚的な違いはほぼ感じない

### フレームカットON（12345432パターン）
- trim=start_frame=1 で端フレームを除去
- 滑らかなループ（端フレーム重複なし）
- filter_complex必須、再エンコード発生
- 高FPS/高解像度でメモリ問題 → アラート表示

## 技術仕様

- FFmpeg.wasm 0.12.x
- concat demuxer方式（v2.4〜）
- 対応形式：MP4, WebM, MOV, AVI
- 出力：MP4 (H.264)

## 更新履歴

- v2.5: Reverseモードにフレームカット切替機能追加
- v2.4: concat demuxer化、Reverse安全対策、品質UI削除
