# AI 講義：數據自動化與網頁部署實務 技術規範說明

本文件定義「AI 講義」的來源與產出方式，未來更新內容時請遵循本規範。

## 1. 基本資訊

| 項目 | 說明 |
|------|------|
| 報表名稱 | `AIclass.html`（文字版，主要版本）／`AI講義_Alex_20260724.html`（簡報圖文版） |
| 內容來源 | `AI講義.txt`（課程逐字稿/大綱）／`AI講義_Alex_20260724.pptx`（NotebookLM 產出的 9 張投影片） |
| 產生方式 | 手動轉製（無 generator 腳本），以 `python-pptx` 擷取 pptx 文字與圖片後手工排版 |
| 資料來源 | 無資料庫，純靜態內容 |
| 主要目的 | 記錄「從 Excel 到 HTML 產出、GitHub 部署、雙向回寫、MongoDB 整合、自動排程與 LINE 通知」的完整實務流程筆記 |

## 2. 兩個版本的差異

| | `AIclass.html` | `AI講義_Alex_20260724.html` |
|---|---|---|
| 內容來源 | `AI講義.txt`（較完整，含 Antigravity 安裝、GitHub Repository 設定等細節） | `AI講義_Alex_20260724.pptx` 9 張投影片（第 1 張為文字大綱，第 2-9 張為 NotebookLM 產出的圖片） |
| 呈現方式 | 純文字卡片排版，含目錄導覽 | 文字大綱 + 8 張嵌入圖片（`ai_lecture_20260724_assets/slide_02.png` ~ `slide_09.png`） |
| 定位 | 主要版本，內容較完整 | 備用／視覺化版本，保留原簡報圖表 |

兩者皆為靜態 HTML，沒有共用的資料層，內容更新時需分別手動修改。

## 3. 更新方式

若來源 `AI講義.txt` 或 `AI講義_Alex_20260724.pptx` 有異動：
1. 手動編輯對應的 HTML 檔案（無自動化腳本）
2. 若簡報圖片有變動，重新用 `python-pptx` 擷取圖片存到 `ai_lecture_20260724_assets/`
3. 同步更新 `ALEX_Life_Catalog.html` 對應列的更新時間

## 4. 相關連結

- 目錄：`ALEX_Life_Catalog.html`（需密碼）

---
*最後更新：2026/07/28（於 `AIclass.html` 第 5 頁與第 6 頁分別新增 `AIC_5_1.png` 與 `AIC_6_1.png` 展示圖片，並加入 MongoDB Atlas 連結）*
