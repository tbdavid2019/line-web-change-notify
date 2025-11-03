# Vercel 部署指南

本指南說明如何將 `line-web-change-notify` 專案部署到 [Vercel](https://vercel.com/)，包含程式調整建議、環境變數設定以及部署後驗證步驟。請先完成 `LINE_SETUP.md` 與 `FIREBASE_SETUP.md` 中的設定，再繼續進行雲端部署。

## 1. 專案概觀
- 主要執行入口為 `app.js`，使用 Express 提供 REST API 與 LIFF 入口頁面，並透過 Puppeteer 進行爬蟲。
- Firebase 作為資料儲存以及使用者設定管理，LINE 作為通知管道。
- `config.json`（可由 `config.example.json` 複製）用來控制通知提供者、排程與郵件設定。

## 2. 部署前準備
1. 確認程式碼已推送至 GitHub 或 GitLab 倉庫，Vercel 將直接從遠端倉庫匯入。
2. 本地端確認可以成功啟動：
   ```bash
   npm install
   npm run dev
   ```
3. 將 `.env` 中的機敏資訊改為使用環境變數，部署後會在 Vercel 後台設定。
4. 若需要 Firebase，先將服務帳戶 JSON 內容備份並移除實體檔案中的機敏資訊。

## 3. 調整程式碼以支援無伺服器環境
Vercel 以 Serverless Functions 執行 Node.js。**若沒有完成下列調整，Vercel 只會部署出靜態網站，所有 `/api/*` 與 `/webhook/*` 路徑都會回傳 404。**

1. **讓 `app.js` 在被匯入時不要自動監聽埠號**
   - 將檔尾的 `tracker.start()` 改為只在本地開發時啟動，例如：
     ```javascript
     if (require.main === module) {
       const tracker = new AppleTracker();
       tracker.start();
     }

     module.exports = AppleTracker;
     ```
   - 這樣在 Vercel Serverless 中匯入 `app.js` 時不會重複啟動。

2. **建立 `api/index.js` 作為 Vercel 入口**
   - 新增檔案 `api/index.js`：
     ```javascript
     const AppleTracker = require('../app');

     let tracker;
     let appPromise;

     module.exports = async (req, res) => {
       if (!tracker) {
         tracker = new AppleTracker();
         appPromise = tracker.init().then(() => tracker.app);
       }

       const app = await appPromise;
       return app(req, res);
     };
     ```
   - 以上程式碼重複使用同一個 `AppleTracker` 實例，避免每次請求都重新啟動 Puppeteer。

3. **設定 Vercel 函式參數與路由**（可選）
   - 在專案根目錄新增 `vercel.json`：
     ```json
     {
       "functions": {
         "api/index.js": {
           "memory": 1024,
           "maxDuration": 60
         }
       },
       "rewrites": [
         { "source": "/(.*)", "destination": "/api/index.js" }
       ]
   }
   ```
   - `memory` 與 `maxDuration` 需依方案調整，爬蟲建議至少 1024MB、60 秒。

4. **使用輕量化 Chromium**
   - Serverless 環境不會自動下載完整的 Chrome，本專案已整合 `@sparticuz/chromium` 與 `puppeteer-core`。
   - 程式會在偵測到 Vercel/AWS 等環境時自動載入輕量化 Chrome，避免出現「Could not find Chrome」錯誤；在本地開發仍使用原本的 `puppeteer`。

## 4. Vercel 專案設定步驟
1. 確認專案已包含上一節的 `app.js` 修改、`api/index.js` 與（選用）`vercel.json`。
2. 於 Vercel 後台選擇 **Add New… → Project**，連結儲存庫。
2. Build & Output Settings：
   - **Framework Preset**：`Other`。
   - **Install Command**：`npm install`（可保留預設）。
   - **Build Command**：留空（代表這是 Serverless 專案，並非「不要部署」）。
   - **Output Directory**：留空。
3. Environment → `+ Add` 新增下列環境變數（見下一節）。
4. 保存設定後按 **Deploy**，觀察日誌是否有顯示安裝依賴與初始化訊息（非只有靜態匯出）。

## 5. 必要環境變數
下表列出程式碼中會讀取的環境變數。請於 Vercel → Project → Settings → Environment Variables 中設定，Production 與 Preview 環境可分別設定不同值。

| 名稱 | 用途 | 是否必要 | 範例值 |
| --- | --- | --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API access token，發送訊息與 webhook 驗證 | ✅ | `xxxxxxxxxxxxxxxx` |
| `LINE_CHANNEL_SECRET` | LINE Messaging API channel secret | ✅ | `xxxxxxxxxxxxxxxx` |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login channel ID，用於網頁登入 | ⚠️ 若啟用 LINE Login 或 LIFF 必填 | `165xxxxxxx` |
| `LINE_LOGIN_CHANNEL_SECRET` | LINE Login channel secret，不設定時會回退到 `LINE_CHANNEL_SECRET` | 建議 | `xxxxxxxxxxxxxxxx` |
| `LINE_LOGIN_REDIRECT_URI` | LINE Login callback，需改為 Vercel 網域 | ⚠️ | `https://your-app.vercel.app/auth/line/callback` |
| `LINE_LIFF_ID` | LIFF 應用 ID，提供 LINE 內嵌頁面 | ⚠️ 若啟用 LIFF 必填 | `165xxxxxxx-AbCdEf` |
| `WEB_URL` | 系統產生連結時使用的公開網址 | ✅ | `https://your-app.vercel.app` |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 服務帳戶 JSON 內容字串化後貼上 | ⚠️ 若使用 Firebase 必填 | `{"type":"service_account",...}` |
| `FIREBASE_PROJECT_ID` | 若未使用 `FIREBASE_SERVICE_ACCOUNT`，可改用分散式設定 | 可選 | `line-web-change-notify` |
| `FIREBASE_CLIENT_EMAIL` | 同上，服務帳戶 email | 可選 | `firebase-adminsdk@project.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | 服務帳戶私鑰，請將 `\n` 轉義為真正換行 | 可選 | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` |
| `PORT` | 本地開發使用，Vercel 會忽略 | 選填 | `3000` |
| `NODE_ENV` | 設為 `production` 以停用測試功能 | 建議 | `production` |
| `SHOW_TEST_FEATURES` | 可選，用於在正式環境顯示測試工具 | 選填 | `false` |

> **貼心提醒**：Vercel 的環境變數支援 JSON 字串，貼上 `FIREBASE_SERVICE_ACCOUNT` 前可先執行 `cat firebase-service-account.json | tr -d '\n'` 或使用線上工具轉成單行 JSON。

## 6. 部署後驗證
1. 查看部署日誌，確認 `✅ Firebase 已初始化`、`🤖 爬蟲管理器已初始化` 等訊息；若只有「生成靜態資源」類訊息，表示 Serverless 函式尚未生效。
2. 造訪 Vercel 產生的網址，檢查健康檢查端點：`https://your-app.vercel.app/health`。
3. 測試 webhook 端點（需使用 `POST`）：
   ```bash
   curl -X POST https://your-app.vercel.app/webhook/line \
     -H "Content-Type: application/json" \
     -d '{"events":[]}'
   ```
   預期回應為 `[]` 或你自訂的訊息。若直接以瀏覽器（GET）開啟會得到 404，屬於正常行為。
4. 更新 LINE Developers：
   - Webhook URL → `https://your-app.vercel.app/webhook/line`
   - LIFF Endpoint → `https://your-app.vercel.app/`
   - LINE Login Callback → `https://your-app.vercel.app/auth/line/callback`
5. 測試：向 LINE Bot 傳送「測試」或「新增規則」，確認通知與 LIFF 可用。

## 7. 進階設定（可選）
- **排程任務**：可使用 [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) 定期呼叫自訂 API（例如建立 `/api/tasks/run-scraper` 以觸發爬蟲）。
- **多環境管理**：可在 Preview 環境使用測試用的 LINE/Firebase 帳號，以免干擾正式使用者。
- **資源監控**：若 puppeteer 執行時間過長，可於 Vercel Project → Settings → Functions 調整 `Max Duration` 與 `Memory`，或升級方案。

完成以上設定後，即可在 Vercel 上維運 LINE 網頁變化通知器。祝部署順利！
