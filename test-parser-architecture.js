/**
 * 測試解析器架構
 * 驗證 BaseParser、AppleParser 和 PChomeParser 的功能
 */

const BaseParser = require('./src/parsers/BaseParser');
const AppleParser = require('./src/parsers/AppleParser');
const PChomeParser = require('./src/parsers/PChomeParser');

console.log('🧪 開始測試解析器架構...\n');

// 測試 BaseParser 抽象方法
console.log('1️⃣ 測試 BaseParser 抽象方法...');
try {
  BaseParser.parseSpecs('test', 'test', 'test');
  console.log('❌ BaseParser 應該拋出錯誤');
} catch (error) {
  console.log('✅ BaseParser.parseSpecs() 正確拋出錯誤:', error.message);
}

try {
  BaseParser.validateSpecs({});
  console.log('❌ BaseParser 應該拋出錯誤');
} catch (error) {
  console.log('✅ BaseParser.validateSpecs() 正確拋出錯誤:', error.message);
}

try {
  BaseParser.formatSpecs({});
  console.log('❌ BaseParser 應該拋出錯誤');
} catch (error) {
  console.log('✅ BaseParser.formatSpecs() 正確拋出錯誤:', error.message);
}

console.log('\n2️⃣ 測試 BaseParser 工具方法...');

// 測試 normalizeText
const normalizedText = BaseParser.normalizeText('test\u00A0\u00A0text   more');
console.log('✅ normalizeText:', normalizedText === 'test text more' ? '通過' : '失敗');

// 測試 createSpecsObject
const specsObj = BaseParser.createSpecsObject({ productType: 'test' });
console.log('✅ createSpecsObject:', specsObj.productType === 'test' && specsObj.memory === null ? '通過' : '失敗');

// 測試 findFirstMatch
const patterns = [/test(\d+)/, /find(\d+)/];
const match = BaseParser.findFirstMatch('find123 test456', patterns);
console.log('✅ findFirstMatch:', match === '123' ? '通過' : `失敗 (得到: ${match})`);

// 測試 parseNumberWithUnit
const memory = BaseParser.parseNumberWithUnit('8GB memory', 'GB');
console.log('✅ parseNumberWithUnit:', memory === '8GB' ? '通過' : '失敗');

console.log('\n3️⃣ 測試 AppleParser...');

// 測試 Apple 官網格式
const appleTestCases = [
  {
    name: 'MacBook Air M2 晶片 13 吋',
    description: '8GB 統一記憶體 256GB SSD 儲存裝置 星光色',
    expected: {
      productType: 'MacBook Air',
      chip: 'M2',
      memory: '8GB',
      storage: '256GB',
      screenSize: '13吋',
      color: '星光色'
    }
  },
  {
    name: 'iPad Pro 12.9 吋 M2 晶片',
    description: '128GB Wi-Fi 機型 太空灰色',
    expected: {
      productType: 'iPad Pro',
      chip: 'M2',
      storage: '128GB',
      screenSize: '12.9吋',
      color: '太空灰色'
    }
  }
];

appleTestCases.forEach((testCase, index) => {
  const specs = AppleParser.parseSpecs(testCase.name, testCase.description, 'Mac');
  console.log(`📋 Apple 測試案例 ${index + 1}:`);
  console.log(`   名稱: ${testCase.name}`);
  console.log(`   描述: ${testCase.description}`);
  console.log(`   解析結果: ${AppleParser.formatSpecs(specs)}`);
  console.log(`   驗證: ${AppleParser.validateSpecs(specs) ? '✅ 通過' : '❌ 失敗'}`);
});

console.log('\n4️⃣ 測試 PChomeParser...');

// 測試 PChome 格式
const pchomeTestCases = [
  {
    name: 'Apple MacBook Air M2 13吋 筆電',
    description: '8GB/256GB SSD/星光色/MLXY3TA',
    expected: {
      productType: 'MacBook Air',
      chip: 'M2',
      memory: '8GB',
      storage: '256GB',
      screenSize: '13吋',
      color: '星光色'
    }
  },
  {
    name: '蘋果 iPad Pro 12.9" 平板電腦',
    description: '128GB WiFi版 太空灰',
    expected: {
      productType: 'iPad Pro',
      storage: '128GB',
      screenSize: '12.9吋',
      color: '太空灰'
    }
  },
  {
    name: 'Apple iPhone 15 Pro Max',
    description: '256GB 原色鈦金屬',
    expected: {
      productType: null, // PChome 主要處理 Mac/iPad
      storage: '256GB'
    }
  }
];

pchomeTestCases.forEach((testCase, index) => {
  const specs = PChomeParser.parseSpecs(testCase.name, testCase.description, 'Other');
  console.log(`📋 PChome 測試案例 ${index + 1}:`);
  console.log(`   名稱: ${testCase.name}`);
  console.log(`   描述: ${testCase.description}`);
  console.log(`   解析結果: ${PChomeParser.formatSpecs(specs)}`);
  console.log(`   驗證: ${PChomeParser.validateSpecs(specs) ? '✅ 通過' : '❌ 失敗'}`);
});

console.log('\n5️⃣ 測試解析器間的差異...');

const commonName = 'MacBook Air M2 13吋';
const appleDesc = '8GB 統一記憶體 256GB SSD 儲存裝置 星光色';
const pchomeDesc = '8GB/256GB SSD/星光色';

const appleResult = AppleParser.parseSpecs(commonName, appleDesc, 'Mac');
const pchomeResult = PChomeParser.parseSpecs(commonName, pchomeDesc, 'Mac');

console.log('📊 相同產品在不同平台的解析結果:');
console.log(`Apple 格式: ${AppleParser.formatSpecs(appleResult)}`);
console.log(`PChome 格式: ${PChomeParser.formatSpecs(pchomeResult)}`);

console.log('\n6️⃣ 測試 URL 分類功能...');
const testUrls = [
  'https://24h.pchome.com.tw/search/macbook',
  'https://24h.pchome.com.tw/search/ipad-pro',
  'https://24h.pchome.com.tw/search/unknown'
];

testUrls.forEach(url => {
  const category = PChomeParser.getCategoryFromUrl(url);
  console.log(`📎 ${url} → ${category}`);
});

console.log('\n🎉 解析器架構測試完成！');

console.log('\n📋 架構總結:');
console.log('├── BaseParser (抽象基類)');
console.log('│   ├── 定義通用介面');
console.log('│   ├── 提供工具方法');
console.log('│   └── 強制子類實作核心方法');
console.log('├── AppleParser (Apple 官網專用)');
console.log('│   ├── 處理繁體中文格式');
console.log('│   ├── 支援 Apple 官方術語');
console.log('│   └── 高精度規格解析');
console.log('└── PChomeParser (PChome 購物專用)');
console.log('    ├── 處理混合中英文格式');
console.log('    ├── 支援商品頁面格式');
console.log('    └── 彈性分類識別');