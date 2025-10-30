/**
 * 基礎爬蟲抽象類別
 * 所有平台的爬蟲都應該繼承此類別
 */
class BaseScraper {
  constructor(options = {}) {
    this.platform = options.platform || 'unknown';
    this.browser = options.browser || null;
    this.config = options.config || {};
    this.enabled = options.enabled !== false;
  }

  /**
   * 取得目標爬取網址
   * @returns {string[]} 網址陣列
   */
  getTargetUrls() {
    throw new Error('子類別必須實作 getTargetUrls 方法');
  }

  /**
   * 爬取產品資料
   * @returns {Promise<Array>} 產品陣列
   */
  async scrapeProducts() {
    throw new Error('子類別必須實作 scrapeProducts 方法');
  }

  /**
   * 解析單一產品詳細資訊
   * @param {string} url 產品網址
   * @returns {Promise<Object>} 產品詳細資訊
   */
  async parseProductDetails(url) {
    throw new Error('子類別必須實作 parseProductDetails 方法');
  }

  /**
   * 驗證產品資料格式
   * @param {Object} product 產品物件
   * @returns {boolean} 是否為有效格式
   */
  validateProduct(product) {
    const requiredFields = ['name', 'price', 'url', 'platform'];
    return requiredFields.every(field => product[field] !== undefined && product[field] !== null);
  }

  /**
   * 標準化產品資料格式
   * @param {Object} rawProduct 原始產品資料
   * @returns {Object} 標準化後的產品資料
   */
  standardizeProduct(rawProduct) {
    return {
      id: rawProduct.id || this.generateProductId(rawProduct),
      name: rawProduct.name || '',
      price: this.parsePrice(rawProduct.price),
      originalPrice: this.parsePrice(rawProduct.originalPrice),
      url: rawProduct.url || '',
      image: rawProduct.image || '',
      platform: this.platform,
      category: rawProduct.category || 'Other',
      specs: rawProduct.specs || {},
      description: rawProduct.description || rawProduct.name || '',
      lastUpdated: new Date(),
      ...rawProduct
    };
  }

  /**
   * 產生產品唯一 ID
   * @param {Object} product 產品物件
   * @returns {string} 唯一 ID
   */
  generateProductId(product) {
    const baseString = `${this.platform}_${product.name}_${product.url}`;
    return Buffer.from(baseString).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * 解析價格字串為數字
   * @param {string} priceStr 價格字串
   * @returns {number} 價格數字
   */
  parsePrice(priceStr) {
    if (!priceStr) return 0;
    const numStr = priceStr.toString().replace(/[^\d]/g, '');
    return parseInt(numStr) || 0;
  }

  /**
   * 等待指定時間
   * @param {number} ms 毫秒
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重試機制
   * @param {Function} fn 要重試的函數
   * @param {number} maxRetries 最大重試次數
   * @param {number} delay 重試間隔（毫秒）
   */
  async retry(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        console.error(`${this.platform} 爬蟲第 ${i + 1} 次嘗試失敗:`, error.message);
        if (i === maxRetries - 1) throw error;
        await this.wait(delay);
      }
    }
  }

  /**
   * 關閉資源
   */
  async close() {
    // 子類別可以覆寫此方法來清理特定資源
    console.log(`${this.platform} 爬蟲已關閉`);
  }
}

module.exports = BaseScraper;