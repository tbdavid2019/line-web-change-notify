const BaseScraper = require('./BaseScraper');
const PChomeParser = require('../parsers/PChomeParser');

/**
 * PChome 購物網站爬蟲範例
 * 展示如何擴展新架構支援其他購物平台
 */
class PChomeScraper extends BaseScraper {
  constructor(options = {}) {
    super({
      platform: 'pchome',
      ...options
    });
    
    this.baseUrl = 'https://24h.pchome.com.tw';
    this.categories = options.categories || ['mac', 'ipad'];
  }

  /**
   * 取得 PChome 搜尋頁面網址
   * @returns {string[]} 網址陣列
   */
  getTargetUrls() {
    const searchTerms = {
      mac: ['MacBook', 'Mac+mini', 'Mac+Studio', 'iMac'],
      ipad: ['iPad', 'iPad+Pro', 'iPad+Air', 'iPad+mini']
    };

    const urls = [];
    
    for (const category of this.categories) {
      if (searchTerms[category]) {
        for (const term of searchTerms[category]) {
          urls.push(`${this.baseUrl}/search/v3.3/?q=${term}&scope=all`);
        }
      }
    }
    
    return urls;
  }

  /**
   * 爬取 PChome 產品
   * @returns {Promise<Array>} 產品陣列
   */
  async scrapeProducts() {
    if (!this.browser) {
      throw new Error('瀏覽器實例未設定，請先設定 browser 屬性');
    }

    const page = await this.browser.newPage();
    
    try {
      const urls = this.getTargetUrls();
      let allProducts = [];

      console.log(`🛒 開始爬取 PChome 產品，共 ${urls.length} 個搜尋頁面...`);

      for (const url of urls) {
        try {
          console.log(`📄 正在爬取: ${url}`);
          
          await page.goto(url, { 
            waitUntil: "networkidle2",
            timeout: 30000
          });
          
          // 等待頁面載入
          await this.wait(3000);

          const products = await page.evaluate(() => {
            const productData = [];

            // PChome 的產品選擇器（需要根據實際網站結構調整）
            const productItems = document.querySelectorAll('.prod_item, .item, [data-gtm*="product"]');

            productItems.forEach((item, index) => {
              try {
                // 產品名稱
                const nameElement = item.querySelector('.prod_name, .name, h3, h4');
                const name = nameElement ? nameElement.textContent.trim() : '';

                // 價格
                const priceElement = item.querySelector('.price, .prod_price, [class*="price"]');
                const price = priceElement ? priceElement.textContent.trim() : '';

                // 連結
                const linkElement = item.querySelector('a[href]');
                const url = linkElement ? linkElement.href : '';

                // 圖片
                const imgElement = item.querySelector('img');
                const image = imgElement ? (imgElement.src || imgElement.dataset.src || '') : '';

                // 篩選 Apple 相關產品
                const isAppleProduct = name.toLowerCase().includes('mac') || 
                                     name.toLowerCase().includes('ipad') ||
                                     name.toLowerCase().includes('apple');

                if (name && price && url && isAppleProduct) {
                  productData.push({
                    name: name,
                    price: price,
                    url: url,
                    image: image,
                    description: name,
                    category: this.categorizeProduct(name)
                  });
                }
              } catch (e) {
                console.error(`解析 PChome 產品 ${index} 時發生錯誤:`, e);
              }
            });

            return productData;
          });

          console.log(`✅ 從 ${url} 爬取到 ${products.length} 個產品`);
          allProducts = allProducts.concat(products);
          
        } catch (error) {
          console.error(`❌ 爬取 ${url} 失敗:`, error.message);
        }
      }

      // 標準化產品資料
      const standardizedProducts = allProducts.map(product => {
        return this.standardizeProduct({
          ...product,
          specs: PChomeParser.parseSpecs(product.name, product.description, product.category)
        });
      }).filter(product => this.validateProduct(product));

      console.log(`🎉 PChome 爬蟲完成，共取得 ${standardizedProducts.length} 個有效產品`);
      return standardizedProducts;
      
    } catch (error) {
      console.error("❌ PChome 爬蟲發生錯誤:", error);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * 解析單一產品詳細資訊
   * @param {string} url 產品網址
   * @returns {Promise<Object>} 產品詳細資訊
   */
  async parseProductDetails(url) {
    if (!this.browser) {
      throw new Error('瀏覽器實例未設定');
    }

    const page = await this.browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: "networkidle2" });
      
      const details = await page.evaluate(() => {
        // 根據 PChome 產品頁面結構調整選擇器
        const name = document.querySelector('h1, .prod_name')?.textContent?.trim() || '';
        const price = document.querySelector('.price, #price')?.textContent?.trim() || '';
        const description = document.querySelector('.prod_info, .description')?.textContent?.trim() || '';
        
        return { name, price, description };
      });

      return details;
      
    } catch (error) {
      console.error(`解析 PChome 產品詳情失敗 ${url}:`, error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * 簡單的產品分類
   * @param {string} name 產品名稱
   * @returns {string} 產品分類
   */
  categorizeProduct(name) {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('macbook') || lowerName.includes('mac mini') || 
        lowerName.includes('mac studio') || lowerName.includes('imac')) {
      return 'Mac';
    } else if (lowerName.includes('ipad')) {
      return 'iPad';
    }
    
    return 'Other';
  }

  /**
   * 解析產品規格（簡化版）
   * @param {string} name 產品名稱
  /**
   * 取得支援的產品類型
   * @returns {Array} 產品類型陣列
   */
  getSupportedProductTypes() {
    return [
      'MacBook Air',
      'MacBook Pro',
      'Mac mini',
      'iMac',
      'iPad Pro',
      'iPad Air',
      'iPad mini',
      'iPad'
    ];
  }

  /**
   * 取得支援的晶片類型
   * @returns {Array} 晶片類型陣列
   */
  getSupportedChips() {
    return [
      'M1', 'M1 Pro', 'M1 Max',
      'M2', 'M2 Pro', 'M2 Max',
      'M3', 'M3 Pro', 'M3 Max',
      'M4', 'M4 Pro', 'M4 Max'
    ];
  }
}

module.exports = PChomeScraper;