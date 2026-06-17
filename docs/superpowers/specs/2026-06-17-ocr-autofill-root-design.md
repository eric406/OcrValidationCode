# OCR Auto-Fill Chrome Extension Design

## Summary

本文件定義一個直接以 repo 根目錄作為 Chrome Extension 專案的 V1 設計。Extension 會在所有網站注入 content script，但只有在本機單一規則存在且網域匹配時，才會擷取指定 `<img>` 驗證碼、用本機離線 OCR 辨識、正規化結果並自動填入指定輸入框。

## Goals

- 以 repo 根目錄直接作為 Manifest V3 extension 專案
- 支援自有網站或測試環境中的圖片型英數碼自動填入
- OCR 完全本機離線執行，不呼叫外部服務
- 安裝後可在所有網站注入，但只有規則命中時才執行
- 使用單一全域規則，降低 V1 複雜度
- OCR 失敗或結果無效時可有限次自動重試

## Non-Goals

- 支援第三方網站 CAPTCHA 繞過
- 支援多筆規則管理
- 支援 `canvas`、CSS background image、`iframe` 內目標
- 預設自動送出表單
- 無限重試或複雜頁面觀察機制

## Recommended Approach

採用 `content script + background service worker + options page` 架構。DOM 操作與重試邏輯放在 content script，OCR 呼叫封裝在 background 與 OCR adapter，設定儲存在 options page。這樣能保留乾淨邊界，並維持之後擴充錯誤狀態、診斷資訊與更多站點能力的空間。

## High-Level Architecture

### Components

1. `src/manifest.ts`
   - 宣告 MV3 entry points
   - 以 `<all_urls>` 注入 content script
   - 提供 `storage` 權限與 options 頁面

2. `src/content/index.ts`
   - 讀取單一規則
   - 驗證目前網域是否匹配
   - 找出指定 `<img>` 與輸入框
   - 擷取圖片資料並向 background 請求 OCR
   - 正規化結果、填值、派發 DOM events
   - 在允許時執行有限次自動重試

3. `src/background/index.ts`
   - 接收 `ocr:recognize` 訊息
   - 呼叫 OCR adapter
   - 回傳成功或結構化錯誤

4. `src/ocr/preprocess.ts`
   - 將 `<img>` 內容轉成可供 OCR 使用的 data URL

5. `src/ocr/recognize.ts`
   - 封裝 `tesseract.js`
   - 讓其餘模組不直接依賴 OCR library 細節

6. `src/shared/*`
   - 定義單一規則型別
   - 提供網域匹配、預設值補齊、OCR 文字正規化 helper

7. `src/options/*`
   - 提供單一規則編輯 UI
   - 儲存到 `chrome.storage.local.rule`

## Rule Model

V1 使用單一規則物件：

- `hostPattern`
- `imageSelector`
- `inputSelector`
- `refreshSelector?`
- `characterPolicy`，V1 固定 `alphanumeric`
- `minLength?`
- `maxLength?`
- `autoFillEnabled`
- `autoRetryEnabled`
- `maxRetries?`

規則儲存在 `chrome.storage.local` 的 `rule` 欄位，不使用陣列。

## Data Flow

1. 頁面載入後，content script 讀取 `rule`
2. 若規則不存在、停用、或網域不匹配，直接結束
3. 找到 `imageSelector` 與 `inputSelector`
4. 驗證 `imageSelector` 解析結果為 `<img>`
5. 將圖片畫到 canvas 並轉為 data URL
6. 傳送 `ocr:recognize` 訊息給 background
7. background 呼叫 OCR adapter，回傳 raw text
8. content script 執行 normalization
9. 若結果有效，填入 input 並送出 `input` / `change`
10. 若結果無效且允許重試，點擊 `refreshSelector` 後有限次重跑
11. 最終仍失敗則以明確錯誤狀態結束

## Error Handling

V1 會顯式處理以下錯誤狀態：

- `rule_not_found`
- `image_not_found`
- `input_not_found`
- `refresh_not_found`
- `image_capture_failed`
- `ocr_failed`
- `result_invalid`
- `fill_failed`

錯誤先記錄到 console，不做猜測式 fallback。

## Retry Policy

- 僅在 `autoRetryEnabled = true` 時啟用
- 需存在 `refreshSelector`
- `maxRetries` 預設為 `1`
- 每次重試前點擊 refresh element，等待短暫延遲後重新擷取圖片
- 不做無限迴圈與全頁輪詢

## Testing Strategy

### Unit tests

- `tests/siteRules.test.ts`
  - host matching
  - default values
  - single-rule normalization

- `tests/ocrText.test.ts`
  - 去除非英數
  - 長度上下限驗證

### Flow tests

- `tests/contentFlow.test.ts`
  - 成功填值
  - 無規則時不動作
  - OCR 無效時依設定觸發重試

### Manual verification

提供 `public/manual-test.html`：

- 一張驗證碼 `<img>`
- 一個目標 input
- 一個 refresh button
- 可手動驗證不自動送出與重試流程

## Success Criteria

V1 成功條件：

- 可作為 unpacked extension 載入 Chrome
- 會在所有網站注入，但只有規則命中時才執行
- 可對指定 `<img>` 執行本機離線 OCR
- 可將有效結果填入指定輸入框
- OCR 無效時可依設定有限次重試
- 不會自動送出表單
