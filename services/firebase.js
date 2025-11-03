const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

class FirebaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.offlineMode = false;
    this.memoryStore = {
      users: new Map(),
      trackingRules: new Map(),
      products: new Map(),
      notifications: [],
      systemState: { isTracking: false, lastUpdated: null },
      dailySnapshots: new Map()
    };
  }

  isPersistent() {
    return !this.offlineMode;
  }

  enableOfflineMode(reason) {
    if (!this.offlineMode) {
      const message = reason ? `⚠️  ${reason}` : '⚠️  Firebase 未設定或初始化失敗，改用離線模式（資料僅存在記憶體）';
      console.warn(message);
      console.warn('⚠️  系統將以離線模式運行（記憶體儲存，不會持久化）');
    }
    this.offlineMode = true;
    this.initialized = true;
    this.db = null;
  }

  serverTimestamp() {
    return new Date();
  }

  clone(data) {
    return data ? JSON.parse(JSON.stringify(data)) : data;
  }

  async initialize() {
    if (this.initialized) {
      return this.isPersistent();
    }

    try {
      let serviceAccount;

      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } else if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_PRIVATE_KEY &&
        process.env.FIREBASE_CLIENT_EMAIL
      ) {
        serviceAccount = {
          type: 'service_account',
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL
        };
      } else {
        const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
        if (fs.existsSync(serviceAccountPath)) {
          serviceAccount = require(serviceAccountPath);
        } else {
          this.enableOfflineMode('Firebase 設定缺失，啟用離線模式');
          return this.isPersistent();
        }
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

      this.db = admin.firestore();

      // 確認連線狀態
      await this.db.collection('_test').doc('connection').set({
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      await this.db.collection('_test').doc('connection').delete();

      this.initialized = true;
      this.offlineMode = false;
      console.log('✅ Firebase 已初始化並測試連接成功');
      return this.isPersistent();
    } catch (error) {
      console.error('❌ Firebase 初始化失敗:', error.message);
      this.enableOfflineMode();
      return this.isPersistent();
    }
  }

  // 用戶管理
  async getUser(lineUserId) {
    if (this.offlineMode) {
      return this.clone(this.memoryStore.users.get(lineUserId) || null);
    }

    const userRef = this.db.collection('users').doc(lineUserId);
    const doc = await userRef.get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async createUser(lineUserId) {
    const now = this.serverTimestamp();
    const userData = {
      lineUserId,
      createdAt: now,
      isActive: true,
      settings: {
        notifications: {
          line: true,
          email: false
        }
      }
    };

    if (this.offlineMode) {
      this.memoryStore.users.set(lineUserId, {
        ...this.clone(userData),
        updatedAt: now
      });
      return this.clone({ id: lineUserId, ...userData });
    }

    await this.db.collection('users').doc(lineUserId).set({
      ...userData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return userData;
  }

  async getOrCreateUser(lineUserId) {
    let user = await this.getUser(lineUserId);
    if (!user) {
      user = await this.createUser(lineUserId);
    }
    return user;
  }

  async updateUserNotificationSettings(lineUserId, notificationSettings) {
    if (this.offlineMode) {
      const user = this.memoryStore.users.get(lineUserId);
      if (user) {
        user.settings = user.settings || {};
        user.settings.notifications = notificationSettings;
        user.updatedAt = this.serverTimestamp();
      }
      return;
    }

    const userRef = this.db.collection('users').doc(lineUserId);
    await userRef.update({
      'settings.notifications': notificationSettings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async updateUserEmail(lineUserId, email) {
    if (this.offlineMode) {
      const user = this.memoryStore.users.get(lineUserId);
      if (user) {
        user.email = email;
        user.updatedAt = this.serverTimestamp();
      }
      return;
    }

    const userRef = this.db.collection('users').doc(lineUserId);
    await userRef.update({
      email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async updateUserSummarySettings(lineUserId, summarySettings) {
    if (this.offlineMode) {
      const user = this.memoryStore.users.get(lineUserId);
      if (user) {
        user.summarySettings = summarySettings;
        user.updatedAt = this.serverTimestamp();
      }
      return;
    }

    const userRef = this.db.collection('users').doc(lineUserId);
    await userRef.update({
      summarySettings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async updateUserLastSummaryDate(lineUserId, date) {
    if (this.offlineMode) {
      const user = this.memoryStore.users.get(lineUserId);
      if (user) {
        user.lastSummaryDate = date;
        user.updatedAt = this.serverTimestamp();
      }
      return;
    }

    const userRef = this.db.collection('users').doc(lineUserId);
    await userRef.update({
      lastSummaryDate: date,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 產品資料
  async getProductsFromDate(date) {
    if (this.offlineMode) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const products = [];
      for (const product of this.memoryStore.products.values()) {
        const createdAt = product.createdAt ? new Date(product.createdAt) : null;
        if (createdAt && createdAt >= startOfDay && createdAt <= endOfDay) {
          products.push(this.clone(product));
        }
      }
      return products;
    }

    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const snapshot = await this.db.collection('products')
        .where('createdAt', '>=', startOfDay)
        .where('createdAt', '<=', endOfDay)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('獲取特定日期產品失敗:', error);
      return [];
    }
  }

  async getProductsFromDateRange(startDate, endDate) {
    if (this.offlineMode) {
      const products = [];
      for (const product of this.memoryStore.products.values()) {
        const createdAt = product.createdAt ? new Date(product.createdAt) : null;
        if (createdAt && createdAt >= startDate && createdAt <= endDate) {
          products.push(this.clone(product));
        }
      }
      return products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    try {
      const snapshot = await this.db.collection('products')
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('獲取日期範圍產品失敗:', error);
      return [];
    }
  }

  async getAllProducts() {
    if (this.offlineMode) {
      return Array.from(this.memoryStore.products.values()).map(product => this.clone(product));
    }

    try {
      const snapshot = await this.db.collection('products')
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('獲取所有產品失敗:', error);
      return [];
    }
  }

  // 追蹤規則管理
  ensureTrackingRuleStore(lineUserId) {
    if (!this.memoryStore.trackingRules.has(lineUserId)) {
      this.memoryStore.trackingRules.set(lineUserId, new Map());
    }
    return this.memoryStore.trackingRules.get(lineUserId);
  }

  async getUserTrackingRules(lineUserId) {
    if (this.offlineMode) {
      const rulesStore = this.ensureTrackingRuleStore(lineUserId);
      const allRules = Array.from(rulesStore.values()).map(rule => this.clone(rule));
      return allRules.filter(rule => rule.enabled !== false);
    }

    const rulesRef = this.db.collection('users').doc(lineUserId).collection('trackingRules');
    const snapshot = await rulesRef.get();

    const allRules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return allRules.filter(rule => rule.enabled !== false);
  }

  generateRuleId() {
    return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async addTrackingRule(lineUserId, rule) {
    const timestamp = this.serverTimestamp();
    const ruleData = {
      ...rule,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    if (this.offlineMode) {
      const rulesStore = this.ensureTrackingRuleStore(lineUserId);
      const id = rule.id || this.generateRuleId();
      rulesStore.set(id, { id, ...this.clone(ruleData) });
      return id;
    }

    if (rule.id) {
      await this.db.collection('users').doc(lineUserId).collection('trackingRules').doc(rule.id).set({
        ...ruleData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return rule.id;
    }

    const docRef = await this.db.collection('users').doc(lineUserId).collection('trackingRules').add({
      ...rule,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  }

  async updateTrackingRule(lineUserId, ruleId, updates) {
    const timestamp = this.serverTimestamp();
    const updateData = {
      ...updates,
      updatedAt: timestamp
    };

    if (this.offlineMode) {
      const rulesStore = this.ensureTrackingRuleStore(lineUserId);
      if (!rulesStore.has(ruleId)) {
        throw new Error(`規則 ${ruleId} 不存在`);
      }
      const existing = rulesStore.get(ruleId);
      rulesStore.set(ruleId, { ...existing, ...this.clone(updateData) });
      return;
    }

    await this.db.collection('users').doc(lineUserId).collection('trackingRules').doc(ruleId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async deleteTrackingRule(lineUserId, ruleId) {
    if (this.offlineMode) {
      const rulesStore = this.ensureTrackingRuleStore(lineUserId);
      if (!rulesStore.has(ruleId)) {
        throw new Error(`規則 ${ruleId} 不存在`);
      }
      rulesStore.delete(ruleId);
      return;
    }

    const ruleRef = this.db.collection('users').doc(lineUserId).collection('trackingRules').doc(ruleId);
    const doc = await ruleRef.get();

    if (!doc.exists) {
      throw new Error(`規則 ${ruleId} 不存在`);
    }

    await ruleRef.delete();
  }

  // 產品歷史管理
  async getProductHistory() {
    if (this.offlineMode) {
      return new Map(this.memoryStore.products);
    }

    const snapshot = await this.db.collection('products').get();
    const products = new Map();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const productKey = data.productKey || this.getProductKey(data.url);
      products.set(productKey, data);
    });

    return products;
  }

  async saveProductHistory(products) {
    const timestamp = this.serverTimestamp();

    if (this.offlineMode) {
      products.forEach(product => {
        const productKey = this.getProductKey(product.url);
        this.memoryStore.products.set(productKey, {
          ...this.clone(product),
          productKey,
          lastSeen: timestamp,
          updatedAt: timestamp,
          createdAt: product.createdAt || timestamp
        });
      });
      return;
    }

    const batchSize = 450;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = this.db.batch();
      const batchProducts = products.slice(i, i + batchSize);

      batchProducts.forEach(product => {
        const productKey = this.getProductKey(product.url);
        const productRef = this.db.collection('products').doc(this.getProductId(productKey));
        batch.set(productRef, {
          ...product,
          productKey,
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
    }
  }

  getProductKey(url) {
    return url.split('?')[0];
  }

  getProductId(url) {
    const urlPath = url.replace(/^https?:\/\/[^\/]+/, '');
    return urlPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  // 通知歷史
  async saveNotification(lineUserId, message, productIds = []) {
    const notificationData = {
      id: `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      userId: lineUserId,
      message,
      productIds,
      sentAt: this.serverTimestamp(),
      status: 'sent'
    };

    if (this.offlineMode) {
      this.memoryStore.notifications.push(notificationData);
      return notificationData.id;
    }

    const docRef = await this.db.collection('notifications').add({
      userId: lineUserId,
      message,
      productIds,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent'
    });
    return docRef.id;
  }

  async getActiveUsers() {
    if (this.offlineMode) {
      return Array.from(this.memoryStore.users.values())
        .filter(user => user.isActive !== false)
        .map(user => this.clone({ ...user, id: user.lineUserId || user.id || null }));
    }

    const snapshot = await this.db.collection('users').where('isActive', '==', true).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // 系統狀態管理
  async getSystemState() {
    if (this.offlineMode) {
      return this.clone(this.memoryStore.systemState);
    }

    try {
      const doc = await this.db.collection('system').doc('tracking_state').get();
      const state = doc.exists ? doc.data() : { isTracking: false };
      console.log('📖 從 Firebase 讀取系統狀態:', state);
      return state;
    } catch (error) {
      console.error('❌ 取得系統狀態錯誤:', error);
      return { isTracking: false };
    }
  }

  async saveSystemState(isTracking) {
    if (this.offlineMode) {
      this.memoryStore.systemState = {
        isTracking,
        lastUpdated: this.serverTimestamp()
      };
      console.log('💾 系統狀態已保存（離線模式）:', { isTracking });
      return;
    }

    try {
      const stateData = {
        isTracking,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
      await this.db.collection('system').doc('tracking_state').set(stateData);
      console.log('💾 系統狀態已保存到 Firebase:', { isTracking });
    } catch (error) {
      console.error('❌ 儲存系統狀態錯誤:', error);
      throw error;
    }
  }

  async getSystemStats() {
    if (this.offlineMode) {
      const totalUsers = this.memoryStore.users.size;
      let activeRules = 0;
      for (const rules of this.memoryStore.trackingRules.values()) {
        for (const rule of rules.values()) {
          if (rule.enabled !== false) {
            activeRules += 1;
          }
        }
      }

      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;
      const notificationsLast24h = this.memoryStore.notifications.filter(notification => {
        const sentAt = new Date(notification.sentAt).getTime();
        return sentAt >= dayAgo;
      }).length;

      return {
        totalUsers,
        activeRules,
        notificationsLast24h
      };
    }

    try {
      const usersSnapshot = await this.db.collection('users').get();

      let totalActiveRules = 0;
      for (const userDoc of usersSnapshot.docs) {
        try {
          const rulesSnapshot = await userDoc.ref.collection('trackingRules').where('enabled', '==', true).get();
          totalActiveRules += rulesSnapshot.size;
        } catch (error) {
          // ignore
        }
      }

      let notificationsCount = 0;
      try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const notificationsSnapshot = await this.db.collection('notifications')
          .where('sentAt', '>=', admin.firestore.Timestamp.fromDate(yesterday))
          .get();
        notificationsCount = notificationsSnapshot.size;
      } catch (error) {
        // ignore
      }

      return {
        totalUsers: usersSnapshot.size,
        activeRules: totalActiveRules,
        notificationsLast24h: notificationsCount
      };
    } catch (error) {
      console.error('取得統計資料錯誤:', error.message);
      return {
        totalUsers: 0,
        activeRules: 0,
        notificationsLast24h: 0
      };
    }
  }

  // 每日快照管理
  async saveDailySnapshot(date, products) {
    const timestamp = this.serverTimestamp();
    const dateStr = this.formatDateString(date);

    if (this.offlineMode) {
      this.memoryStore.dailySnapshots.set(dateStr, {
        date: dateStr,
        products: this.clone(products),
        totalCount: products.length,
        createdAt: timestamp
      });
      console.log(`💾 每日快照已保存（離線模式）: ${dateStr} (${products.length} 個產品)`);
      return true;
    }

    try {
      const snapshotData = {
        date: dateStr,
        products,
        totalCount: products.length,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('daily_snapshots').doc(dateStr).set(snapshotData);
      console.log(`💾 每日快照已保存: ${dateStr} (${products.length} 個產品)`);
      return true;
    } catch (error) {
      console.error('保存每日快照失敗:', error);
      return false;
    }
  }

  async getDailySnapshot(date) {
    const dateStr = this.formatDateString(date);

    if (this.offlineMode) {
      return this.clone(this.memoryStore.dailySnapshots.get(dateStr) || null);
    }

    try {
      const doc = await this.db.collection('daily_snapshots').doc(dateStr).get();

      if (doc.exists) {
        return doc.data();
      }
      return null;
    } catch (error) {
      console.error('獲取每日快照失敗:', error);
      return null;
    }
  }

  async getLatestSnapshot() {
    if (this.offlineMode) {
      if (this.memoryStore.dailySnapshots.size === 0) {
        return null;
      }
      const latestEntry = Array.from(this.memoryStore.dailySnapshots.values())
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return this.clone(latestEntry);
    }

    try {
      const snapshot = await this.db.collection('daily_snapshots')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs[0].data();
      }
      return null;
    } catch (error) {
      console.error('獲取最新快照失敗:', error);
      return null;
    }
  }

  formatDateString(date) {
    return date.toISOString().split('T')[0];
  }

  async cleanupOldSnapshots(keepDays = 30) {
    if (this.offlineMode) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      const cutoffStr = this.formatDateString(cutoffDate);

      for (const key of Array.from(this.memoryStore.dailySnapshots.keys())) {
        if (key < cutoffStr) {
          this.memoryStore.dailySnapshots.delete(key);
        }
      }
      return;
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      const cutoffStr = this.formatDateString(cutoffDate);

      const querySnapshot = await this.db.collection('daily_snapshots')
        .where('date', '<', cutoffStr)
        .get();

      const batch = this.db.batch();
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`🗑️  清理了 ${querySnapshot.size} 個舊快照`);
    } catch (error) {
      console.error('清理舊快照失敗:', error);
    }
  }
}

module.exports = FirebaseService;
