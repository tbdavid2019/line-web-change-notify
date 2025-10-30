const AppleScraper = require('../scrapers/AppleScraper');
const PChomeScraper = require('../scrapers/PChomeScraper');

/**
 * 爬蟲管理器
 * 統一管理所有平台的爬蟲
 */
class ScraperManager {
  constructor(options = {}) {
    this.browser = options.browser || null;
    this.config = options.config || {};
    this.scrapers = new Map();
    this.enabledScrapers = new Set();
    
    this.initializeScrapers();
  }

  /**
   * 初始化所有爬蟲
   */
  initializeScrapers() {
    // 初始化 Apple 爬蟲
    const appleConfig = this.config.apple || { enabled: true };
    if (appleConfig.enabled) {
      const appleScraper = new AppleScraper({
        browser: this.browser,
        config: appleConfig,
        categories: appleConfig.categories || ['mac', 'ipad', 'appletv']
      });
      
      this.scrapers.set('apple', appleScraper);
      this.enabledScrapers.add('apple');
      console.log('✅ Apple 爬蟲已初始化');
    }

    // 初始化 PChome 爬蟲
    const pchomeConfig = this.config.pchome || { enabled: false };
    if (pchomeConfig.enabled) {
      const pchomeScraper = new PChomeScraper({
        browser: this.browser,
        config: pchomeConfig,
        categories: pchomeConfig.categories || ['mac', 'ipad']
      });
      
      this.scrapers.set('pchome', pchomeScraper);
      this.enabledScrapers.add('pchome');
      console.log('✅ PChome 爬蟲已初始化');
    }

    // 未來可以在這裡初始化其他平台的爬蟲
    // 例如：momo、蝦皮等
    
    console.log(`🎯 爬蟲管理器初始化完成，已啟用 ${this.enabledScrapers.size} 個爬蟲`);
  }

  /**
   * 設定瀏覽器實例
   * @param {Object} browser Puppeteer 瀏覽器實例
   */
  setBrowser(browser) {
    this.browser = browser;
    
    // 更新所有爬蟲的瀏覽器實例
    for (const scraper of this.scrapers.values()) {
      scraper.browser = browser;
    }
  }

  /**
   * 啟用指定平台的爬蟲
   * @param {string} platform 平台名稱
   */
  enableScraper(platform) {
    if (this.scrapers.has(platform)) {
      this.enabledScrapers.add(platform);
      console.log(`✅ ${platform} 爬蟲已啟用`);
    } else {
      console.warn(`⚠️ 找不到 ${platform} 爬蟲`);
    }
  }

  /**
   * 停用指定平台的爬蟲
   * @param {string} platform 平台名稱
   */
  disableScraper(platform) {
    this.enabledScrapers.delete(platform);
    console.log(`❌ ${platform} 爬蟲已停用`);
  }

  /**
   * 取得已啟用的爬蟲列表
   * @returns {Array} 平台名稱陣列
   */
  getEnabledScrapers() {
    return Array.from(this.enabledScrapers);
  }

  /**
   * 取得所有可用的爬蟲列表
   * @returns {Array} 平台名稱陣列
   */
  getAvailableScrapers() {
    return Array.from(this.scrapers.keys());
  }

  /**
   * 取得指定平台的爬蟲
   * @param {string} platform 平台名稱
   * @returns {BaseScraper|null} 爬蟲實例
   */
  getScraper(platform) {
    return this.scrapers.get(platform) || null;
  }

  /**
   * 爬取所有已啟用平台的產品
   * @returns {Promise<Array>} 所有平台的產品陣列
   */
  async scrapeAllProducts() {
    const allProducts = [];
    const scrapingPromises = [];

    console.log(`🚀 開始爬取 ${this.enabledScrapers.size} 個平台的產品...`);

    for (const platform of this.enabledScrapers) {
      const scraper = this.scrapers.get(platform);
      if (scraper) {
        scrapingPromises.push(
          this.scrapePlatformWithRetry(platform, scraper)
        );
      }
    }

    const results = await Promise.allSettled(scrapingPromises);
    
    results.forEach((result, index) => {
      const platform = Array.from(this.enabledScrapers)[index];
      
      if (result.status === 'fulfilled') {
        const products = result.value || [];
        allProducts.push(...products);
        console.log(`✅ ${platform} 爬取完成，取得 ${products.length} 個產品`);
      } else {
        console.error(`❌ ${platform} 爬取失敗:`, result.reason?.message);
      }
    });

    console.log(`🎉 所有平台爬取完成，總共取得 ${allProducts.length} 個產品`);
    return allProducts;
  }

  /**
   * 帶重試機制的平台爬取
   * @param {string} platform 平台名稱
   * @param {BaseScraper} scraper 爬蟲實例
   * @returns {Promise<Array>} 產品陣列
   */
  async scrapePlatformWithRetry(platform, scraper) {
    const maxRetries = this.config[platform]?.maxRetries || 3;
    const retryDelay = this.config[platform]?.retryDelay || 5000;

    return await scraper.retry(
      () => scraper.scrapeProducts(),
      maxRetries,
      retryDelay
    );
  }

  /**
   * 根據平台篩選產品
   * @param {Array} products 產品陣列
   * @param {Object} filtersByPlatform 各平台的篩選條件
   * @returns {Array} 篩選後的產品陣列
   */
  filterProductsByPlatform(products, filtersByPlatform = {}) {
    const filteredProducts = [];

    // 按平台分組產品
    const productsByPlatform = new Map();
    products.forEach(product => {
      const platform = product.platform;
      if (!productsByPlatform.has(platform)) {
        productsByPlatform.set(platform, []);
      }
      productsByPlatform.get(platform).push(product);
    });

    // 對每個平台的產品進行篩選
    for (const [platform, platformProducts] of productsByPlatform) {
      const scraper = this.scrapers.get(platform);
      const filters = filtersByPlatform[platform] || {};

      if (scraper && typeof scraper.filterProducts === 'function') {
        const filtered = scraper.filterProducts(platformProducts, filters);
        filteredProducts.push(...filtered);
      } else {
        // 如果爬蟲不支援篩選，直接加入所有產品
        filteredProducts.push(...platformProducts);
      }
    }

    return filteredProducts;
  }

  /**
   * 取得所有平台支援的篩選條件
   * @returns {Object} 各平台支援的篩選條件
   */
  getSupportedFilters() {
    const supportedFilters = {};

    for (const [platform, scraper] of this.scrapers) {
      supportedFilters[platform] = {
        productTypes: scraper.getSupportedProductTypes?.() || [],
        chips: scraper.getSupportedChips?.() || [],
        categories: scraper.getSupportedCategories?.() || [],
        // 通用篩選條件
        common: ['minPrice', 'maxPrice', 'minMemory', 'minStorage', 'color']
      };
    }

    return supportedFilters;
  }

  /**
   * 取得爬蟲統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      totalScrapers: this.scrapers.size,
      enabledScrapers: this.enabledScrapers.size,
      availablePlatforms: this.getAvailableScrapers(),
      enabledPlatforms: this.getEnabledScrapers()
    };
  }

  /**
   * 驗證配置
   * @returns {boolean} 配置是否有效
   */
  validateConfig() {
    if (!this.browser) {
      console.error('❌ 瀏覽器實例未設定');
      return false;
    }

    if (this.enabledScrapers.size === 0) {
      console.error('❌ 沒有啟用任何爬蟲');
      return false;
    }

    console.log('✅ 爬蟲管理器配置驗證通過');
    return true;
  }

  /**
   * 關閉所有爬蟲資源
   */
  async close() {
    console.log('🔄 正在關閉所有爬蟲資源...');
    
    const closePromises = [];
    for (const scraper of this.scrapers.values()) {
      if (typeof scraper.close === 'function') {
        closePromises.push(scraper.close());
      }
    }

    await Promise.allSettled(closePromises);
    
    this.scrapers.clear();
    this.enabledScrapers.clear();
    
    console.log('✅ 所有爬蟲資源已關閉');
  }
}

module.exports = ScraperManager;