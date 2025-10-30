const puppeteer = require("puppeteer");
const ScraperManager = require("./src/managers/ScraperManager");

/**
 * 通用平台測試函數
 * @param {string} platform 平台名稱 ('apple', 'pchome')
 * @param {Object} options 測試選項
 */
async function testPlatform(platform, options = {}) {
  const {
    headless = true,
    fullTest = false,
    maxProducts = 5,
    timeout = 60000
  } = options;
  
  console.log(`🧪 開始測試 ${platform.toUpperCase()} 平台...`);
  
  let browser = null;
  let scraperManager = null;
  
  try {
    // 初始化瀏覽器
    console.log("🚀 啟動瀏覽器...");
    browser = await puppeteer.launch({
      headless: headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      timeout: timeout
    });
    
    // 配置爬蟲
    const scraperConfig = {
      [platform]: {
        enabled: true,
        maxRetries: 2,
        retryDelay: 3000
      }
    };
    
    // 針對不同平台調整配置
    if (platform === 'apple') {
      scraperConfig.apple.categories = ['mac']; // 只測試 Mac 分類
    } else if (platform === 'pchome') {
      scraperConfig.pchome.categories = ['mac'];
    }
    
    // 初始化爬蟲管理器
    console.log(`🤖 初始化 ${platform} 爬蟲...`);
    scraperManager = new ScraperManager({
      browser: browser,
      config: scraperConfig
    });
    
    // 驗證配置
    if (!scraperManager.validateConfig()) {
      throw new Error("爬蟲管理器配置無效");
    }
    
    // 顯示統計資訊
    const stats = scraperManager.getStats();
    console.log("📊 爬蟲統計:", stats);
    
    // 取得爬蟲實例
    const scraper = scraperManager.getScraper(platform);
    if (!scraper) {
      throw new Error(`找不到 ${platform} 爬蟲`);
    }
    
    // 顯示支援的功能
    console.log(`\n📋 ${platform.toUpperCase()} 爬蟲功能:`);
    if (scraper.getSupportedProductTypes) {
      const types = scraper.getSupportedProductTypes();
      console.log(`  支援產品類型: ${types.join(', ')}`);
    }
    
    if (scraper.getSupportedChips) {
      const chips = scraper.getSupportedChips();
      console.log(`  支援晶片類型: ${chips.slice(0, 5).join(', ')}${chips.length > 5 ? '...' : ''}`);
    }
    
    // 顯示目標網址
    if (scraper.getTargetUrls) {
      const urls = scraper.getTargetUrls();
      console.log(`\n🎯 目標網址 (${urls.length} 個):`);
      urls.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });
    }
    
    if (fullTest) {
      // 進行實際爬取測試
      console.log(`\n🔍 開始實際爬取 ${platform.toUpperCase()} 產品...`);
      console.log("⚠️  這將實際訪問網站，可能需要較長時間");
      
      const startTime = Date.now();
      const products = await scraperManager.scrapeAllProducts();
      const endTime = Date.now();
      
      console.log(`\n✅ 爬取完成！`);
      console.log(`   耗時: ${((endTime - startTime) / 1000).toFixed(2)} 秒`);
      console.log(`   取得產品: ${products.length} 個`);
      
      if (products.length > 0) {
        // 顯示產品範例
        console.log(`\n📋 產品範例 (前 ${Math.min(maxProducts, products.length)} 個):`);
        products.slice(0, maxProducts).forEach((product, index) => {
          console.log(`\n${index + 1}. ${product.name}`);
          console.log(`   價格: ${product.price}`);
          console.log(`   平台: ${product.platform}`);
          console.log(`   分類: ${product.category}`);
          console.log(`   網址: ${product.url.substring(0, 80)}...`);
          
          if (product.specs && Object.keys(product.specs).length > 0) {
            const specsStr = Object.entries(product.specs)
              .filter(([key, value]) => value)
              .map(([key, value]) => `${key}:${value}`)
              .join(', ');
            if (specsStr) {
              console.log(`   規格: ${specsStr}`);
            }
          }
        });
        
        // 測試篩選功能
        console.log(`\n🔍 測試篩選功能...`);
        
        // 按產品類型篩選
        const productTypes = [...new Set(products.map(p => p.specs?.productType).filter(Boolean))];
        if (productTypes.length > 0) {
          const filtered = scraperManager.filterProductsByPlatform(products, {
            [platform]: { productType: productTypes[0] }
          });
          console.log(`✅ ${productTypes[0]} 篩選結果: ${filtered.length} 個產品`);
        }
        
        // 按價格篩選
        const cheapProducts = scraperManager.filterProductsByPlatform(products, {
          [platform]: { maxPrice: 50000 }
        });
        console.log(`✅ 價格低於 50,000 的產品: ${cheapProducts.length} 個`);
        
        // 統計分析
        console.log(`\n📊 統計分析:`);
        const categories = [...new Set(products.map(p => p.category))];
        categories.forEach(category => {
          const count = products.filter(p => p.category === category).length;
          console.log(`   ${category}: ${count} 個產品`);
        });
        
      } else {
        console.log(`\n⚠️  未找到任何 ${platform.toUpperCase()} 產品，可能原因:`);
        console.log("   1. 網站結構已改變，需要更新選擇器");
        console.log("   2. 搜尋條件需要調整");
        console.log("   3. 網路連線問題或網站無法訪問");
        console.log("   4. 反爬蟲機制阻擋");
      }
      
    } else {
      console.log(`\n💡 如要進行完整測試（實際爬取），請執行:`);
      console.log(`   node -e "require('./test-platform')('${platform}', {fullTest: true})"`);
    }
    
    console.log(`\n🎉 ${platform.toUpperCase()} 平台測試完成！`);
    return products || [];
    
  } catch (error) {
    console.error(`❌ ${platform.toUpperCase()} 測試失敗:`, error.message);
    
    console.log(`\n🔧 故障排除建議:`);
    console.log("1. 檢查網路連線");
    console.log(`2. 確認 ${platform} 網站可正常訪問`);
    console.log("3. 檢查瀏覽器是否正確啟動");
    console.log("4. 使用 headless: false 模式查看詳細過程");
    
    throw error;
    
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

/**
 * 測試多個平台
 * @param {string[]} platforms 平台陣列
 * @param {Object} options 測試選項
 */
async function testMultiplePlatforms(platforms, options = {}) {
  console.log(`🚀 開始測試多個平台: ${platforms.join(', ')}`);
  
  const results = {};
  
  for (const platform of platforms) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      const products = await testPlatform(platform, options);
      results[platform] = {
        success: true,
        productCount: products.length,
        products: products
      };
    } catch (error) {
      results[platform] = {
        success: false,
        error: error.message
      };
    }
  }
  
  // 顯示總結報告
  console.log(`\n${'='.repeat(50)}`);
  console.log("📊 多平台測試總結報告:");
  
  let totalProducts = 0;
  let successCount = 0;
  
  for (const [platform, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`✅ ${platform.toUpperCase()}: ${result.productCount} 個產品`);
      totalProducts += result.productCount;
      successCount++;
    } else {
      console.log(`❌ ${platform.toUpperCase()}: 失敗 - ${result.error}`);
    }
  }
  
  console.log(`\n總計: ${successCount}/${platforms.length} 個平台成功，共 ${totalProducts} 個產品`);
  
  return results;
}

// 執行測試
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log("📖 使用說明:");
    console.log("測試單一平台:");
    console.log("  node test-platform.js apple");
    console.log("  node test-platform.js pchome");
    console.log("\n完整測試:");
    console.log("  node test-platform.js apple --full");
    console.log("\n測試多平台:");
    console.log("  node test-platform.js apple pchome --full");
    process.exit(0);
  }
  
  const platforms = args.filter(arg => !arg.startsWith('--'));
  const fullTest = args.includes('--full');
  const headless = !args.includes('--debug');
  
  if (platforms.length === 0) {
    platforms.push('apple'); // 默認測試 Apple
  }
  
  const options = {
    fullTest: fullTest,
    headless: headless,
    maxProducts: 3
  };
  
  if (platforms.length === 1) {
    testPlatform(platforms[0], options).then(() => {
      process.exit(0);
    }).catch(error => {
      console.error("測試執行失敗:", error.message);
      process.exit(1);
    });
  } else {
    testMultiplePlatforms(platforms, options).then(() => {
      process.exit(0);
    }).catch(error => {
      console.error("多平台測試執行失敗:", error.message);
      process.exit(1);
    });
  }
}

module.exports = testPlatform;