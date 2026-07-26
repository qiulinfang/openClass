"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const common_vendor = require("../common/vendor.js");
class StorageService {
  // Token 相关
  static getXuebanToken() {
    return common_vendor.index.getStorageSync(this.KEYS.XUEBAN_TOKEN) || "";
  }
  static setXuebanToken(token) {
    common_vendor.index.setStorageSync(this.KEYS.XUEBAN_TOKEN, token);
  }
  static removeXuebanToken() {
    common_vendor.index.removeStorageSync(this.KEYS.XUEBAN_TOKEN);
  }
  // 账号密码
  static getSavedCredentials() {
    return {
      account: common_vendor.index.getStorageSync(this.KEYS.XUEBAN_USER_ID) || "",
      password: common_vendor.index.getStorageSync(this.KEYS.USER_PASSWORD) || ""
    };
  }
  static setSavedCredentials(account, password) {
    common_vendor.index.setStorageSync(this.KEYS.XUEBAN_USER_ID, account);
    common_vendor.index.setStorageSync(this.KEYS.USER_PASSWORD, password);
  }
  // 多历史账号管理
  static getSavedAccounts() {
    try {
      const data = common_vendor.index.getStorageSync(this.KEYS.SAVED_ACCOUNTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
  static setSavedAccounts(accounts) {
    try {
      common_vendor.index.setStorageSync(this.KEYS.SAVED_ACCOUNTS, JSON.stringify(accounts));
    } catch (e) {
      console.error("[StorageService] 保存账号失败:", e);
    }
  }
  // 清除全部登录数据
  static clearAllAuth() {
    common_vendor.index.removeStorageSync(this.KEYS.XUEBAN_TOKEN);
    common_vendor.index.removeStorageSync(this.KEYS.YANBAN_TOKEN);
    common_vendor.index.removeStorageSync(this.KEYS.USER_INFO);
  }
}
__publicField(StorageService, "KEYS", {
  XUEBAN_TOKEN: "XUEBAN_TOKEN",
  YANBAN_TOKEN: "YANBAN_TOKEN",
  XUEBAN_USER_ID: "xuebanuserid",
  USER_PASSWORD: "userPassword",
  USER_INFO: "userInfo",
  SAVED_ACCOUNTS: "saved_accounts"
});
exports.StorageService = StorageService;
