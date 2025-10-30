const BaseScraper = require('./BaseScraper');
const AppleParser = require('../parsers/AppleParser');

/**
 * Apple 官網整修機爬蟲
 * 繼承 BaseScraper 並實作 Apple 特定的爬蟲邏輯
 */
class AppleScraper extends BaseScraper {
  constructor(options = {}) {
    super({
      platform: 'apple',
      ...options
    });
    
    this.baseUrl = 'https://www.apple.com/tw/shop/refurbished';
    this.categories = options.categories || ['mac', 'ipad', 'appletv'];
  }

  /**
   * 取得 Apple 整修機頁面網址
   * @returns {string[]} 網址陣列
   */
  getTargetUrls() {
    return this.categories.map(category => `${this.baseUrl}/${category}`);
  }

  /**
   * 爬取 Apple 整修機產品
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

      console.log(`🍎 開始爬取 Apple 整修機產品，共 ${urls.length} 個頁面...`);

      for (const url of urls) {
        try {
          console.log(`📄 正在爬取: ${url}`);
          
          await page.goto(url, { 
            waitUntil: "networkidle2",
            timeout: 30000
          });
          
          // 等待頁面完全載入
          await this.wait(2000);

          const products = await page.evaluate((currentUrl) => {
            const productData = [];

            // 尋找產品連結
            const links = document.querySelectorAll('a[href*="/shop/product/"]');

            // 篩選整修機產品連結
            const refurbishedLinks = Array.from(links).filter((a) => {
              const href = a.href.toLowerCase();
              const text = a.textContent.toLowerCase();

              const isRefurbished =
                href.includes("refurbished") ||
                text.includes("整修品") ||
                text.includes("整修");

              return isRefurbished && text.trim().length > 0;
            });

            console.log(`找到 ${refurbishedLinks.length} 個整修機產品連結`);

            refurbishedLinks.forEach((link, index) => {
              try {
                const name = link.textContent.trim();

                // 尋找價格
                let price = "";
                let currentElement = link.parentElement;
                let searchDepth = 0;

                while (currentElement && searchDepth < 6) {
                  const containerText = currentElement.textContent || "";
                  const priceMatch = containerText.match(/NT\$[\d,]+/);
                  if (priceMatch) {
                    price = priceMatch[0];
                    break;
                  }
                  currentElement = currentElement.parentElement;
                  searchDepth++;
                }

                // 尋找圖片
                let image = "";
                const parentContainer = link.closest("div");
                if (parentContainer) {
                  const imgElement = parentContainer.querySelector("img");
                  if (imgElement) {
                    image =
                      imgElement.src ||
                      imgElement.getAttribute("data-src") ||
                      "";
                  }
                }

                // 確定分類
                const category = currentUrl.includes("/mac")
                  ? "Mac"
                  : currentUrl.includes("/ipad")
                  ? "iPad"
                  : currentUrl.includes("/appletv")
                  ? "Apple TV"
                  : "Other";

                if (name.length > 0) {
                  productData.push({
                    name: name,
                    price: price || "價格未找到",
                    image: image || "",
                    description: name,
                    url: link.href,
                    category: category,
                  });
                }
              } catch (e) {
                console.error(`解析產品 ${index} 時發生錯誤:`, e);
              }
            });

            return productData;
          }, url);

          console.log(`✅ 從 ${url} 爬取到 ${products.length} 個產品`);
          allProducts = allProducts.concat(products);
          
        } catch (error) {
          console.error(`❌ 爬取 ${url} 失敗:`, error.message);
        }
      }

      // 解析產品規格並標準化資料格式
      const standardizedProducts = allProducts.map(product => {
        const specs = AppleParser.parseSpecs(
          product.name,
          product.description,
          product.category
        );
        
        return this.standardizeProduct({
          ...product,
          specs: specs
        });
      }).filter(product => this.validateProduct(product));

      console.log(`🎉 Apple 爬蟲完成，共取得 ${standardizedProducts.length} 個有效產品`);
      return standardizedProducts;
      
    } catch (error) {
      console.error("❌ Apple 爬蟲發生錯誤:", error);
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
        const name = document.querySelector('h1')?.textContent?.trim() || '';
        const price = document.querySelector('[data-autom="price"]')?.textContent?.trim() || '';
        const description = document.querySelector('[data-autom="overview"]')?.textContent?.trim() || '';
        
        // 尋找更多規格資訊
        const specs = {};
        const specElements = document.querySelectorAll('[data-autom*="tech-specs"]');
        
        specElements.forEach(el => {
          const label = el.querySelector('dt, .label')?.textContent?.trim();
          const value = el.querySelector('dd, .value')?.textContent?.trim();
          if (label && value) {
            specs[label] = value;
          }
        });

        return {
          name,
          price,
          description,
          detailedSpecs: specs
        };
      });

      return details;
      
    } catch (error) {
      console.error(`解析產品詳情失敗 ${url}:`, error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * 驗證 Apple 產品
   * @param {Object} product 產品物件
   * @returns {boolean} 是否為有效的 Apple 產品
   */
  validateProduct(product) {
    // 基本驗證
    if (!super.validateProduct(product)) {
      return false;
    }

    // Apple 特定驗證
    const validCategories = ['Mac', 'iPad', 'Apple TV'];
    if (!validCategories.includes(product.category)) {
      console.warn(`無效的 Apple 產品分類: ${product.category}`);
      return false;
    }

    // 驗證規格
    if (product.specs && !AppleParser.validateSpecs(product.specs)) {
      console.warn(`無效的 Apple 產品規格: ${product.name}`);
      return false;
    }

    return true;
  }

  /**
   * 篩選 Apple 產品
   * @param {Array} products 產品陣列
   * @param {Object} filters 篩選條件
   * @returns {Array} 篩選後的產品陣列
   */
  filterProducts(products, filters = {}) {
    return products.filter((product) => {
      const specs = product.specs || {};

      // 產品類型篩選
      if (filters.productType && specs.productType !== filters.productType) {
        return false;
      }

      // 晶片篩選
      if (filters.chip && specs.chip !== filters.chip) {
        return false;
      }

      // 顏色篩選
      if (filters.color && specs.color !== filters.color) {
        return false;
      }

      // 最小記憶體篩選
      if (filters.minMemory) {
        const productMemory = parseInt(specs.memory);
        if (isNaN(productMemory) || productMemory < filters.minMemory) {
          return false;
        }
      }

      // 最大價格篩選
      if (filters.maxPrice) {
        const price = this.parsePrice(product.price);
        if (price > filters.maxPrice) {
          return false;
        }
      }

      // 最小儲存空間篩選
      if (filters.minStorage) {
        const storageStr = specs.storage || '';
        let storageValue = 0;
        
        if (storageStr.includes('TB')) {
          storageValue = parseInt(storageStr) * 1024; // 轉換為 GB
        } else if (storageStr.includes('GB')) {
          storageValue = parseInt(storageStr);
        }
        
        if (storageValue < filters.minStorage) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 取得支援的產品類型
   * @returns {Array} 產品類型陣列
   */
  getSupportedProductTypes() {
    return [
      'MacBook Air',
      'MacBook Pro', 
      'Mac Studio',
      'Mac mini',
      'iMac',
      'iPad Pro',
      'iPad Air',
      'iPad mini',
      'iPad',
      'Apple TV'
    ];
  }

  /**
   * 取得支援的晶片類型
   * @returns {Array} 晶片類型陣列
   */
  getSupportedChips() {
    return [
      'M1',
      'M1 Pro',
      'M1 Max',
      'M1 Ultra',
      'M2',
      'M2 Pro', 
      'M2 Max',
      'M2 Ultra',
      'M3',
      'M3 Pro',
      'M3 Max',
      'M4',
      'M4 Pro',
      'M4 Max',
      'M4 Ultra'
    ];
  }
}

module.exports = AppleScraper;