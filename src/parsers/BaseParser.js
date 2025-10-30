/**
 * 基礎解析器抽象類別
 * 定義所有解析器的通用介面
 */
class BaseParser {
  
  /**
   * 解析產品規格（抽象方法，子類必須實作）
   * @param {string} name 產品名稱
   * @param {string} description 產品描述  
   * @param {string} category 產品分類
   * @returns {Object} 標準化的產品規格物件
   */
  static parseSpecs(name, description, category) {
    throw new Error('parseSpecs() 必須在子類中實作');
  }

  /**
   * 驗證產品規格的完整性（抽象方法）
   * @param {Object} specs 產品規格
   * @returns {boolean} 是否為有效的產品規格
   */
  static validateSpecs(specs) {
    throw new Error('validateSpecs() 必須在子類中實作');
  }

  /**
   * 格式化產品規格為可讀字串（抽象方法）
   * @param {Object} specs 產品規格
   * @returns {string} 格式化後的規格描述
   */
  static formatSpecs(specs) {
    throw new Error('formatSpecs() 必須在子類中實作');
  }

  /**
   * 創建標準化的規格物件
   * @param {Object} overrides 要覆蓋的屬性
   * @returns {Object} 標準化的規格物件
   */
  static createSpecsObject(overrides = {}) {
    return {
      screenSize: null,
      chip: null,
      memory: null,
      storage: null,
      color: null,
      productType: null,
      category: "Other",
      ...overrides
    };
  }

  /**
   * 正規化文字（移除特殊字符、統一空格）
   * @param {string} text 要正規化的文字
   * @returns {string} 正規化後的文字
   */
  static normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\u00A0/g, ' ')  // 移除不間斷空格
      .replace(/\s+/g, ' ')     // 統一多個空格為單一空格
      .trim();
  }

  /**
   * 使用正則表達式陣列尋找匹配項
   * @param {string} text 要搜尋的文字
   * @param {Array<RegExp>} patterns 正則表達式陣列
   * @returns {string|null} 第一個匹配的結果，無匹配則返回 null
   */
  static findFirstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];  // 返回捕獲組或整個匹配
      }
    }
    return null;
  }

  /**
   * 解析數字+單位格式（如 8GB, 256GB, 13吋）
   * @param {string} text 要解析的文字
   * @param {string} unit 單位（如 'GB', '吋'）
   * @param {Array<string>} excludeWords 要排除的詞語（如 ['SSD', '儲存']）
   * @returns {string|null} 解析結果，格式為 "數字+單位"
   */
  static parseNumberWithUnit(text, unit, excludeWords = []) {
    const excludePattern = excludeWords.length > 0 
      ? `(?!.*(?:${excludeWords.join('|')}))` 
      : '';
    
    const pattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}${excludePattern}`, 'i');
    const match = text.match(pattern);
    
    return match ? `${match[1]}${unit}` : null;
  }

  /**
   * 從文字中尋找顏色
   * @param {string} text 要搜尋的文字
   * @param {Array<string>} colorList 顏色清單
   * @returns {string|null} 找到的顏色，無匹配則返回 null
   */
  static findColor(text, colorList) {
    for (const color of colorList) {
      if (text.includes(color)) {
        return color;
      }
    }
    return null;
  }

  /**
   * 基本產品類型識別（通用邏輯）
   * @param {string} name 產品名稱
   * @returns {string|null} 識別的產品類型
   */
  static parseBasicProductType(name) {
    const productTypes = [
      { patterns: [/MacBook Air/i, /MacBook\s*Air/i], type: "MacBook Air" },
      { patterns: [/MacBook Pro/i, /MacBook\s*Pro/i], type: "MacBook Pro" },
      { patterns: [/Mac Studio/i, /Mac\s*Studio/i], type: "Mac Studio" },
      { patterns: [/Mac mini/i, /Mac\s*mini/i], type: "Mac mini" },
      { patterns: [/iMac/i], type: "iMac" },
      { patterns: [/iPad Pro/i, /iPad\s*Pro/i], type: "iPad Pro" },
      { patterns: [/iPad Air/i, /iPad\s*Air/i], type: "iPad Air" },
      { patterns: [/iPad mini/i, /iPad\s*mini/i], type: "iPad mini" },
      { patterns: [/iPad/i], type: "iPad" },
      { patterns: [/Apple TV/i, /Apple\s*TV/i], type: "Apple TV" },
    ];

    for (const { patterns, type } of productTypes) {
      for (const pattern of patterns) {
        if (pattern.test(name)) {
          return type;
        }
      }
    }
    return null;
  }
}

module.exports = BaseParser;