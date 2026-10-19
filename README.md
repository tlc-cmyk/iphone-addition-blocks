# 加數積木星星

- Repo：https://github.com/tlc-cmyk/iphone-addition-blocks
- 線上玩：https://tlc-cmyk.github.io/iphone-addition-blocks/

專為 **iPhone** 設計嘅兒童加法練習遊戲。用原創「數字積木」方塊角色學加法，唔係 Numberblocks / BBC 官方內容。

## 點樣喺 iPhone 打開

### 方法一：GitHub Pages（推薦）
1. 用 Safari 打開：https://tlc-cmyk.github.io/iphone-addition-blocks/
2. 點分享按鈕 → **加入主畫面**，就可以好似 App 咁全螢幕玩

### 方法二：本機開啟
1. 下載或 clone 呢個 repo
2. 用電腦開啟 `index.html`，或用任意靜態伺服器
3. 用 iPhone Safari 開同一個 Wi‑Fi 下嘅本機位址；或把檔案傳到手機後用檔案 App / Safari 開啟

```bash
# 本機靜態伺服器例子
cd iphone-addition-blocks
python3 -m http.server 8080
# 然後喺 iPhone Safari 開 http://<電腦IP>:8080
```

## 功能
- **三關難度**：易／中／難（每關 12 題）
- **四選一** 作答
- **答對**：顯示正確、加星星、簡單慶祝動畫
- **答錯**：即刻顯示正確答案，然後繼續
- 題型（按難度比重出現）：
  1. 1–10 簡單加法
  2. 1–20 小一加法
  3. 湊十
  4. 連加三個數
  5. 缺數（□＋5＝12）
  6. 組合數式（邊一組加起嚟係 N）
- iPhone 直向、安全區、大掣、可加入主畫面（PWA-ish）

## 難度對應（大約）
| 難度 | 主要題型 |
|------|----------|
| 易 | 1–10、湊十、大積木視覺 |
| 中 | 1–20、缺數、輕組合 |
| 難 | 連加三個數、缺數、組合數式 |

## 技術
- 純靜態：`index.html` + `styles.css` + `app.js`
- 無需建置、無需外部圖片 CDN
- 積木角色用 CSS 繪製（原創）

## 版權說明
「數字積木／加數積木星星」為原創名稱與美術。請勿抄襲 Numberblocks 官方角色、名稱、標誌或 BBC 商標。

## 授權
MIT — 歡迎用於課堂同家庭練習。
