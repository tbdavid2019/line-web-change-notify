const puppeteer = require("puppeteer");
const ScraperManager = require("./src/managers/ScraperManager");

async function testNewArchitecture() {
  console.log("🧪 開始測試新架構...");
  
  let browser = null;
  let scraperManager = null;
  
  try {
    // 初始化瀏覽器
    console.log("🚀 啟動瀏覽器...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    
    // 初始化爬蟲管理器
    console.log("🤖 初始化爬蟲管理器...");
    scraperManager = new ScraperManager({
      browser: browser,
      config: {
        apple: {
          enabled: true,
          categories: ['mac'], // 只測試 Mac 分類以節省時間
          maxRetries: 2
        }
      }
    });
    
    // 驗證配置
    if (!scraperManager.validateConfig()) {
      throw new Error("爬蟲管理器配置無效");
    }
    
    // 顯示統計資訊
    console.log("📊 爬蟲統計:", scraperManager.getStats());
    
    // 測試爬取
    console.log("🔍 開始爬取測試（僅 Mac 分類）...");
    const products = await scraperManager.scrapeAllProducts();
    
    console.log(`✅ 爬取完成！共取得 ${products.length} 個產品`);
    
    if (products.length > 0) {
      console.log("📋 產品範例:");
      const sample = products[0];
      console.log("  名稱:", sample.name);
      console.log("  價格:", sample.price);
      console.log("  平台:", sample.platform);
      console.log("  分類:", sample.category);
      console.log("  規格:", sample.specs);
    }
    
    // 測試篩選功能
    console.log("🔍 測試篩選功能...");
    const appleScraper = scraperManager.getScraper('apple');
    if (appleScraper) {
      const filtered = appleScraper.filterProducts(products, {
        productType: 'MacBook Air'
      });
      console.log(`✅ MacBook Air 篩選結果: ${filtered.length} 個產品`);
    }
    
    console.log("🎉 新架構測試完成！");
    
  } catch (error) {
    console.error("❌ 測試失敗:", error.message);
    console.error(error.stack);
  } finally {
    // 清理資源
    if (scraperManager) {
      await scraperManager.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

// 執行測試
if (require.main === module) {
  testNewArchitecture();
}

module.exports = testNewArchitecture;