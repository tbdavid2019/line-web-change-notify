# 解析器架構設計報告

## 🎯 問題分析

用戶提出了一個很重要的架構問題：

> "解析器只要一個就可以通用 吃 apple 和 pchome 網站了？"

## ❌ 錯誤假設

**不對！每個平台需要專屬的解析器。**

原本的設計問題：
- 只有 `AppleParser` - 專門為 Apple 官網設計
- `PChomeScraper` 內部有自己的 `parseSpecs()` 方法
- 缺乏統一的解析器介面

## ✅ 正確架構

### 新設計的解析器架構

```
src/parsers/
├── BaseParser.js       # 抽象基類
├── AppleParser.js      # Apple 官網專用
└── PChomeParser.js     # PChome 購物專用
```

### 為什麼無法通用？

#### 1. 格式差異巨大

**Apple 官網格式**（繁體中文專業術語）:
```
產品名稱: "MacBook Air M2 晶片 13 吋"
產品描述: "8GB 統一記憶體 256GB SSD 儲存裝置 星光色"
```

**PChome 購物格式**（混合中英文商品格式）:
```  
產品名稱: "Apple MacBook Air M2 13吋 筆電"
產品描述: "8GB/256GB SSD/星光色/MLXY3TA"
```

#### 2. 解析邏輯完全不同

**Apple 解析邏輯**:
- 使用 "統一記憶體" 關鍵字識別 RAM
- 使用 "SSD 儲存裝置" 識別儲存空間
- 支援繁體中文顏色名稱

**PChome 解析邏輯**:
- 使用 "/" 分隔符號解析規格
- 支援混合中英文格式
- 需要從 URL 推測產品分類

#### 3. 擴展性考量

新增平台時：
- ✅ **模組化設計** - 只需新增對應解析器
- ❌ **通用解析器** - 需要修改核心邏輯，容易出錯

## 📊 測試結果

```bash
node test-parser-architecture.js
```

### 解析器測試結果

#### Apple 官網格式測試
```
產品: MacBook Air M2 晶片 13 吋 | 8GB 統一記憶體 256GB SSD 儲存裝置 星光色
解析: MacBook Air 13吋 M2 8GB 256GB 星光色 ✅
```

#### PChome 購物格式測試  
```
產品: Apple MacBook Air M2 13吋 筆電 | 8GB/256GB SSD/星光色/MLXY3TA
解析: MacBook Air 13吋 M2 8GB 256GB 星光色 ✅
```

#### 差異性驗證
- **相同產品，不同平台** → 兩個解析器都能正確處理
- **iPhone 產品（非主要支援）** → PChome 解析器能識別儲存容量

## 🏗️ 架構優勢

### 1. 單一職責原則
- `AppleParser` - 只處理 Apple 官網格式
- `PChomeParser` - 只處理 PChome 購物格式
- `BaseParser` - 提供通用工具方法

### 2. 開放封閉原則
- **對擴展開放** - 新增平台只需新增解析器
- **對修改封閉** - 現有解析器不受新平台影響

### 3. 可維護性
- 每個解析器獨立維護
- 問題隔離，不會互相影響
- 單元測試更容易編寫

### 4. 可測試性
```javascript
// 獨立測試每個解析器
const appleSpecs = AppleParser.parseSpecs(name, desc, category);
const pchomeSpecs = PChomeParser.parseSpecs(name, desc, category);

// 統一的驗證接口
const isValid = AppleParser.validateSpecs(specs);
```

## 🚀 未來擴展

新增 momo 購物或 Shopee：

```javascript
// src/parsers/MomoParser.js
class MomoParser extends BaseParser {
  static parseSpecs(name, description, category) {
    // momo 特定的解析邏輯
  }
}

// src/parsers/ShopeeParser.js  
class ShopeeParser extends BaseParser {
  static parseSpecs(name, description, category) {
    // Shopee 特定的解析邏輯
  }
}
```

## 📝 結論

**解析器無法通用，每個平台都需要專屬的解析器。**

這個架構設計：
- ✅ 遵循物件導向設計原則
- ✅ 提供強大的擴展性
- ✅ 確保程式碼可維護性
- ✅ 支援完整的單元測試

通過 `BaseParser` 抽象類別提供統一介面，同時允許每個平台實作自己的特殊邏輯，是最佳的架構選擇。