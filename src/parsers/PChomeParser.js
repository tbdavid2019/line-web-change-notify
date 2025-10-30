const BaseParser = require('./BaseParser');

/**
 * PChome 產品規格解析器
 * 專門處理 PChome 購物網站的產品規格解析
 */
class PChomeParser extends BaseParser {
  
  /**
   * 解析 PChome 產品規格
   * @param {string} name 產品名稱
   * @param {string} description 產品描述
   * @param {string} category 產品分類
   * @returns {Object} 解析後的規格物件
   */
  static parseSpecs(name, description, category) {
    const normalizedName = this.normalizeText(name);
    const normalizedDescription = this.normalizeText(description);
    const combinedText = `${normalizedName} ${normalizedDescription}`;

    const specs = this.createSpecsObject({ category: category || "Other" });

    // 解析產品類型
    specs.productType = this.parseProductType(normalizedName);
    
    // 解析螢幕尺寸
    specs.screenSize = this.parseScreenSize(combinedText);
    
    // 解析晶片類型
    specs.chip = this.parseChip(combinedText);
    
    // 解析記憶體
    specs.memory = this.parseMemory(combinedText);
    
    // 解析儲存空間
    specs.storage = this.parseStorage(combinedText);
    
    // 解析顏色
    specs.color = this.parseColor(normalizedName);

    return specs;
  }

  /**
   * 解析產品類型（PChome 特定格式）
   * @param {string} name 產品名稱
   * @returns {string|null} 產品類型
   */
  static parseProductType(name) {
    // 先使用基礎解析
    let productType = this.parseBasicProductType(name);
    if (productType) return productType;

    // PChome 特殊格式處理
    const pchomePatterns = [
      { pattern: /Apple\s+MacBook\s+Air/i, type: "MacBook Air" },
      { pattern: /Apple\s+MacBook\s+Pro/i, type: "MacBook Pro" },
      { pattern: /Apple\s+iPad\s+Pro/i, type: "iPad Pro" },
      { pattern: /Apple\s+iPad\s+Air/i, type: "iPad Air" },
      { pattern: /Apple\s+iPad\s+mini/i, type: "iPad mini" },
      { pattern: /Apple\s+iPad/i, type: "iPad" },
      { pattern: /蘋果.*MacBook.*Air/i, type: "MacBook Air" },
      { pattern: /蘋果.*MacBook.*Pro/i, type: "MacBook Pro" },
      { pattern: /蘋果.*iPad.*Pro/i, type: "iPad Pro" },
      { pattern: /蘋果.*iPad.*Air/i, type: "iPad Air" },
      { pattern: /蘋果.*iPad/i, type: "iPad" },
    ];

    for (const { pattern, type } of pchomePatterns) {
      if (pattern.test(name)) {
        return type;
      }
    }
    
    return null;
  }

  /**
   * 解析螢幕尺寸（支援中英文格式）
   * @param {string} text 要解析的文字
   * @returns {string|null} 螢幕尺寸
   */
  static parseScreenSize(text) {
    const sizePatterns = [
      /(\d+(?:\.\d+)?)\s*吋/,
      /(\d+(?:\.\d+)?)\s*inch/i,
      /(\d+(?:\.\d+)?)\s*"/,
      /(\d+(?:\.\d+)?)\s*寸/,
    ];

    const match = this.findFirstMatch(text, sizePatterns);
    return match ? match + '吋' : null;
  }

  /**
   * 解析晶片類型（支援中英文格式）
   * @param {string} text 要解析的文字
   * @returns {string|null} 晶片類型
   */
  static parseChip(text) {
    const chipPatterns = [
      // 中文格式
      /Apple\s+(M\d+(?:\s+(?:Pro|Max|Ultra))?)\s*晶片/i,
      /(M\d+(?:\s+(?:Pro|Max|Ultra))?)\s*晶片/i,
      /(M\d+(?:\s+(?:Pro|Max|Ultra))?)\s*芯片/i,
      // 英文格式
      /Apple\s+(M\d+(?:\s+(?:Pro|Max|Ultra))?)\s*chip/i,
      /(M\d+(?:\s+(?:Pro|Max|Ultra))?)\s*chip/i,
      // 通用格式
      /(M\d+(?:\s+(?:Pro|Max|Ultra))?)/i,
    ];

    const match = this.findFirstMatch(text, chipPatterns);
    return match ? match.replace(/Apple\s+/i, '').replace(/[晶芯]片|chip/i, '').trim() : null;
  }

  /**
   * 解析記憶體容量（支援中英文格式）
   * @param {string} text 要解析的文字
   * @returns {string|null} 記憶體容量
   */
  static parseMemory(text) {
    const memoryPatterns = [
      // 中文格式
      /(\d+)GB\s*統一記憶體/i,
      /(\d+)GB\s*記憶體/i,
      /(\d+)GB\s*內存/i,
      /記憶體.*?(\d+)GB/i,
      /內存.*?(\d+)GB/i,
      // 英文格式
      /(\d+)GB\s*unified\s*memory/i,
      /(\d+)GB\s*memory/i,
      /(\d+)GB\s*RAM/i,
      // 通用格式（避免與儲存空間混淆）
      /(\d+)\s*GB(?!\s*(?:SSD|儲存|storage|硬碟))/i,
    ];

    const match = this.findFirstMatch(text, memoryPatterns);
    return match ? match.replace(/[^\d]/g, '') + 'GB' : null;
  }

  /**
   * 解析儲存容量（支援中英文格式）
   * @param {string} text 要解析的文字
   * @returns {string|null} 儲存容量
   */
  static parseStorage(text) {
    const storagePatterns = [
      // TB 格式
      /(\d+(?:\.\d+)?)TB/i,
      /(\d+(?:\.\d+)?)\s*TB\s*(?:SSD|儲存|storage|硬碟)/i,
      // GB 格式
      /(\d+)GB.*?(?:SSD|儲存|storage|硬碟)/i,
      /(\d+)GB\s*儲存/i,
      /儲存.*?(\d+)GB/i,
      /硬碟.*?(\d+)GB/i,
    ];

    for (const pattern of storagePatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = match[1];
        if (pattern.toString().includes('TB')) {
          return value + 'TB';
        } else {
          return value + 'GB';
        }
      }
    }
    return null;
  }

  /**
   * 解析產品顏色（支援中英文顏色）
   * @param {string} text 要解析的文字
   * @returns {string|null} 產品顏色
   */
  static parseColor(text) {
    const colors = [
      // 中文顏色
      "銀色", "太空灰色", "太空黑色", "星光色", "午夜色", 
      "天藍色", "玫瑰金色", "金色", "紫色", "綠色", 
      "藍色", "紅色", "黑色", "白色", "粉色", "橘色",
      // 英文顏色
      "Silver", "Space Gray", "Space Grey", "Space Black", 
      "Starlight", "Midnight", "Sky Blue", "Rose Gold", 
      "Gold", "Purple", "Green", "Blue", "Red", "Black", 
      "White", "Pink", "Orange",
      // 混合格式
      "太空灰", "玫瑰金", "深空灰"
    ];

    return this.findColor(text, colors);
  }

  /**
   * 驗證 PChome 產品規格的完整性
   * @param {Object} specs 產品規格
   * @returns {boolean} 是否為有效的 PChome 產品規格
   */
  static validateSpecs(specs) {
    // PChome 產品至少應該有產品類型或其他可識別資訊
    return specs.productType !== null || 
           specs.chip !== null || 
           specs.memory !== null || 
           specs.storage !== null;
  }

  /**
   * 格式化 PChome 產品規格為可讀字串
   * @param {Object} specs 產品規格
   * @returns {string} 格式化後的規格描述
   */
  static formatSpecs(specs) {
    const parts = [];
    
    if (specs.productType) parts.push(specs.productType);
    if (specs.screenSize) parts.push(specs.screenSize);
    if (specs.chip) parts.push(specs.chip);
    if (specs.memory) parts.push(specs.memory);
    if (specs.storage) parts.push(specs.storage);
    if (specs.color) parts.push(specs.color);
    
    return parts.join(' ') || `${specs.category} 產品`;
  }

  /**
   * 從 PChome 產品 URL 判斷分類
   * @param {string} url 產品 URL
   * @returns {string} 推測的產品分類
   */
  static getCategoryFromUrl(url) {
    if (!url) return "Other";
    
    const categoryMap = {
      'macbook': 'Mac',
      'imac': 'Mac', 
      'mac-mini': 'Mac',
      'mac-studio': 'Mac',
      'ipad': 'iPad',
      'apple-tv': 'Apple TV',
      'airpods': 'AirPods',
      'watch': 'Apple Watch'
    };

    const normalizedUrl = url.toLowerCase();
    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (normalizedUrl.includes(keyword)) {
        return category;
      }
    }
    
    return "Other";
  }
}

module.exports = PChomeParser;