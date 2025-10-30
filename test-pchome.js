const puppeteer = require("puppeteer");
const PChomeScraper = require("./src/scrapers/PChomeScraper");

async function testPChomeScraper() {
  console.log("🧪 開始測試 PChome 爬蟲...");
  
  let browser = null;
  let pchomeScraper = null;
  
  try {
    // 初始化瀏覽器
    console.log("🚀 啟動瀏覽器...");
    browser = await puppeteer.launch({
      headless: process.env.DEBUG ? false : true, // DEBUG 模式顯示瀏覽器
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      slowMo: process.env.DEBUG ? 100 : 0 // DEBUG 模式放慢操作
    });
    
    // 初始化 PChome 爬蟲
    console.log("🛒 初始化 PChome 爬蟲...");
    pchomeScraper = new PChomeScraper({
      browser: browser,
      categories: ['mac'], // 只測試 Mac 分類以節省時間
      config: {
        maxRetries: 2,
        retryDelay: 3000
      }
    });
    
    // 顯示目標網址
    const targetUrls = pchomeScraper.getTargetUrls();
    console.log("🎯 目標網址:");
    targetUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });
    
    // 測試基本驗證
    console.log("\n🔍 測試基本驗證...");
    const testProduct = {
      name: "MacBook Air M2",
      price: "NT$35,900",
      url: "https://24h.pchome.com.tw/prod/test",
      platform: "pchome"
    };
    
    const isValid = pchomeScraper.validateProduct(testProduct);
    console.log(`✅ 產品驗證測試: ${isValid ? '通過' : '失敗'}`);
    
    // 測試價格解析
    const parsedPrice = pchomeScraper.parsePrice("NT$35,900");
    console.log(`✅ 價格解析測試: NT$35,900 → ${parsedPrice}`);
    
    // 測試產品 ID 生成
    const productId = pchomeScraper.generateProductId(testProduct);
    console.log(`✅ 產品 ID 生成: ${productId}`);
    
    // 測試規格解析
    console.log("\n🔍 測試規格解析...");
    const specs = pchomeScraper.parseSpecs("MacBook Air M2 13吋 256GB", "Apple MacBook Air");
    console.log("規格解析結果:", JSON.stringify(specs, null, 2));
    
    // 測試支援的產品類型
    console.log("\n📋 支援的產品類型:");
    const supportedTypes = pchomeScraper.getSupportedProductTypes();
    supportedTypes.forEach(type => console.log(`  - ${type}`));
    
    console.log("\n📋 支援的晶片類型:");
    const supportedChips = pchomeScraper.getSupportedChips();
    supportedChips.forEach(chip => console.log(`  - ${chip}`));
    
    // 實際爬取測試（可選）
    if (process.env.FULL_TEST === 'true') {
      console.log("\n🔍 開始實際爬取測試...");
      console.log("⚠️  注意：這將實際訪問 PChome 網站，可能需要較長時間");
      
      const products = await pchomeScraper.scrapeProducts();
      
      console.log(`\n✅ 爬取完成！共取得 ${products.length} 個產品`);
      
      if (products.length > 0) {
        console.log("\n📋 產品範例 (前3個):");
        products.slice(0, 3).forEach((product, index) => {
          console.log(`\n${index + 1}. ${product.name}`);
          console.log(`   價格: ${product.price}`);
          console.log(`   平台: ${product.platform}`);
          console.log(`   分類: ${product.category}`);
          console.log(`   網址: ${product.url}`);
          if (product.specs) {
            console.log(`   規格: ${JSON.stringify(product.specs)}`);
          }
        });
        
        // 測試篩選功能
        console.log("\n🔍 測試篩選功能...");
        const macBookAirs = pchomeScraper.filterProducts(products, {
          productType: 'MacBook Air'
        });
        console.log(`✅ MacBook Air 篩選結果: ${macBookAirs.length} 個產品`);
        
        const expensiveProducts = pchomeScraper.filterProducts(products, {
          maxPrice: 50000
        });
        console.log(`✅ 價格低於 50,000 的產品: ${expensiveProducts.length} 個`);
        
      } else {
        console.log("⚠️  未找到任何產品，可能是：");
        console.log("   1. PChome 網站結構已改變");
        console.log("   2. 搜尋條件需要調整");
        console.log("   3. 網路連線問題");
      }
    } else {
      console.log("\n💡 如要進行完整測試（實際爬取），請執行:");
      console.log("   FULL_TEST=true node test-pchome.js");
    }
    
    console.log("\n🎉 PChome 爬蟲測試完成！");
    
  } catch (error) {
    console.error("❌ 測試失敗:", error.message);
    if (process.env.DEBUG) {
      console.error("詳細錯誤:", error.stack);
    }
    
    console.log("\n🔧 故障排除建議:");
    console.log("1. 檢查網路連線");
    console.log("2. 確認 PChome 網站可正常訪問");
    console.log("3. 使用 DEBUG=true 模式查看詳細過程");
    console.log("4. 檢查瀏覽器是否正確啟動");
    
  } finally {
    // 清理資源
    if (pchomeScraper) {
      await pchomeScraper.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

// 使用說明
function showUsage() {
  console.log("\n📖 使用說明:");
  console.log("基本測試:");
  console.log("  node test-pchome.js");
  console.log("\n除錯模式 (顯示瀏覽器):");
  console.log("  DEBUG=true node test-pchome.js");
  console.log("\n完整測試 (實際爬取):");
  console.log("  FULL_TEST=true node test-pchome.js");
  console.log("\n完整除錯測試:");
  console.log("  DEBUG=true FULL_TEST=true node test-pchome.js");
}

// 執行測試
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
  }
  
  testPChomeScraper().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error("測試執行失敗:", error);
    process.exit(1);
  });
}

module.exports = testPChomeScraper;