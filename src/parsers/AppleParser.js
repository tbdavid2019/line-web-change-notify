const BaseParser = require('./BaseParser');

/**
 * Apple 產品規格解析器
 * 專門處理 Apple 官網產品的規格解析
 */
class AppleParser extends BaseParser {
  
  /**
   * 解析 Apple 產品規格
   * @param {string} name 產品名稱
   * @param {string} description 產品描述
   * @param {string} category 產品分類
   * @returns {Object} 解析後的規格物件
   */
  static parseSpecs(name, description, category) {
    const normalizedName = this.normalizeText(name);
    const normalizedDescription = this.normalizeText(description);

    const specs = this.createSpecsObject({ category: category || "Other" });

    // 解析產品類型
    specs.productType = this.parseProductType(normalizedName);
    
    // 解析螢幕尺寸
    specs.screenSize = this.parseScreenSize(normalizedName);
    
    // 解析晶片類型
    specs.chip = this.parseChip(normalizedName, normalizedDescription);
    
    // 解析記憶體
    specs.memory = this.parseMemory(normalizedName, normalizedDescription);
    
    // 解析儲存空間
    specs.storage = this.parseStorage(normalizedName, normalizedDescription);
    
    // 解析顏色
    specs.color = this.parseColor(normalizedName);

    return specs;
  }

  /**
   * 解析產品類型（Apple 官網特定格式）
   * @param {string} name 產品名稱
   * @returns {string|null} 產品類型
   */
  static parseProductType(name) {
    // 使用基礎解析器的通用邏輯
    return this.parseBasicProductType(name);
  }

  /**
   * 解析螢幕尺寸
   * @param {string} name 產品名稱
   * @returns {string|null} 螢幕尺寸
   */
  static parseScreenSize(name) {
    const sizeMatch = name.match(/(\d+(?:\.\d+)?)\s*吋/);
    return sizeMatch ? sizeMatch[1] + "吋" : null;
  }

  /**
   * 解析晶片類型
   * @param {string} name 產品名稱
   * @param {string} description 產品描述
   * @returns {string|null} 晶片類型
   */
  static parseChip(name, description) {
    const chipPatterns = [
      /Apple (M\d+(?:\s+(?:Pro|Max|Ultra))?)/i,
      /(M\d+(?:\s+(?:Pro|Max|Ultra))?)\s*晶片/i,
      /(M\d+(?:\s+(?:Pro|Max|Ultra))?)/i,
    ];

    for (const pattern of chipPatterns) {
      const chipMatch = name.match(pattern) || description.match(pattern);
      if (chipMatch) {
        return chipMatch[1]
          .replace(/Apple\s+/i, "")
          .replace(/晶片/i, "")
          .trim();
      }
    }
    return null;
  }

  /**
   * 解析記憶體容量
   * @param {string} name 產品名稱
   * @param {string} description 產品描述
   * @returns {string|null} 記憶體容量
   */
  static parseMemory(name, description) {
    const memoryPatterns = [
      /(\d+)GB\s*統一記憶體/i,
      /(\d+)GB\s*記憶體/i,
    ];

    for (const pattern of memoryPatterns) {
      const memoryMatch = description.match(pattern) || name.match(pattern);
      if (memoryMatch) {
        return memoryMatch[1] + "GB";
      }
    }
    return null;
  }

  /**
   * 解析儲存容量
   * @param {string} name 產品名稱
   * @param {string} description 產品描述
   * @returns {string|null} 儲存容量
   */
  static parseStorage(name, description) {
    const storagePatterns = [
      /(\d+(?:\.\d+)?)TB/i,
      /(\d+)GB.*SSD/i,
      /(\d+)GB\s*儲存/i,
    ];

    for (const pattern of storagePatterns) {
      const storageMatch = description.match(pattern) || name.match(pattern);
      if (storageMatch) {
        if (pattern.toString().includes("TB")) {
          return storageMatch[1] + "TB";
        } else {
          return storageMatch[1] + "GB";
        }
      }
    }
    return null;
  }

  /**
   * 解析產品顏色
   * @param {string} name 產品名稱
   * @returns {string|null} 產品顏色
   */
  static parseColor(name) {
    const colors = [
      "銀色",
      "太空灰色", 
      "太空黑色",
      "星光色",
      "午夜色",
      "天藍色",
      "玫瑰金色",
      "金色",
      "紫色",
      "綠色",
      "藍色",
      "紅色",
      "黑色",
      "白色"
    ];

    for (const color of colors) {
      if (name.includes(color)) {
        return color;
      }
    }
    return null;
  }

  /**
   * 驗證 Apple 產品規格的完整性
   * @param {Object} specs 產品規格
   * @returns {boolean} 是否為有效的 Apple 產品規格
   */
  static validateSpecs(specs) {
    // Apple 產品至少應該有產品類型
    return specs.productType !== null;
  }

  /**
   * 格式化 Apple 產品規格為可讀字串
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
    
    return parts.join(' ');
  }
}

module.exports = AppleParser;