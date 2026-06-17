# OCR Auto Fill Extension

Chrome Extension，直接以目前 repo 根目錄作為專案。它會在所有網站注入 content script，但只有在你於 options 頁面設定的單一規則命中時，才會擷取指定 `<img>`、用本機離線 OCR 辨識，並把結果填入指定輸入框。

## 功能範圍

- 本機離線 OCR，使用 `tesseract.js`
- 單一全域規則
- 僅支援頁面上的 `<img>`
- 支援 OCR 無效時有限次自動重試
- 不自動送出表單

## 安裝與建置

```powershell
npm install
npm run typecheck
npm run test
npm run build
```

建置完成後，於 Chrome 開啟 `chrome://extensions`，啟用 Developer mode，選擇 Load unpacked，指向 [dist](D:/repo/Ocr/dist)。

## 規則設定

進入 extension 的 options 頁面，設定：

- `Host Pattern`：例如 `localhost`，留白代表所有網站
- `Image Selector`：可留白；若有填，例如 `#codeImage`，會優先使用指定 selector
- `Input Selector`：可留白；若有填，例如 `#codeInput`，會優先使用指定 selector
- `Refresh Selector`：例如 `#refreshButton`
- `Min Length` / `Max Length`
- `Enable Auto Retry`
- `Max Retries`

## 手動驗證

可以用任何靜態伺服器提供 [public/manual-test.html](D:/repo/Ocr/public/manual-test.html)：

```powershell
npx serve public
```

之後打開 `http://localhost:3000/manual-test.html`，並在 options 中填入：

- `Host Pattern`: 留白或 `localhost`
- `Image Selector`: `#codeImage`
- `Input Selector`: `#codeInput`
- `Refresh Selector`: `#refreshButton`

驗證重點：

- 規則不存在時，不會自動填值
- 規則命中時，能將 OCR 結果填入 `#codeInput`
- `Image Selector` / `Input Selector` 留白時，會自動選最近的一組圖片與文字輸入框
- 結果無效時，會點擊 refresh 後有限次重試
- 不會自動送出表單
