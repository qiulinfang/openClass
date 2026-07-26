"use strict";
const common_vendor = require("../common/vendor.js");
const services_api_authApi = require("./api/authApi.js");
const services_storageService = require("./storageService.js");
const store_user = require("../store/user.js");
class AuthService {
  /**
   * 执行用户登录业务（对齐 imates-web：包含学伴登录 + 研伴同步登录）
   */
  static async login(params) {
    var _a, _b;
    const userStore = store_user.useUserStore();
    const token = await services_api_authApi.AuthApi.loginXueban(params);
    services_storageService.StorageService.setXuebanToken(token);
    services_storageService.StorageService.setSavedCredentials(params.account, params.password);
    userStore.setToken(token);
    try {
      const userInfo = await services_api_authApi.AuthApi.getUserInfo(token);
      if (userInfo) {
        userStore.setUserInfo(userInfo);
      }
    } catch (e) {
      console.warn("[AuthService] 获取用户信息失败:", e);
    }
    try {
      const yanbanRes = await services_api_authApi.AuthApi.loginYanban(params);
      const yanbanToken = (_a = yanbanRes == null ? void 0 : yanbanRes.data) == null ? void 0 : _a.token;
      if (yanbanToken) {
        common_vendor.index.setStorageSync("YANBAN_TOKEN", yanbanToken);
        if ((_b = yanbanRes == null ? void 0 : yanbanRes.data) == null ? void 0 : _b.userId) {
          common_vendor.index.setStorageSync("yanbanuserid", yanbanRes.data.userId);
        }
      }
    } catch (yanbanErr) {
      console.warn("[AuthService] 研伴同步登录异常:", yanbanErr);
    }
    this.updateSavedAccounts(params.account, params.password);
    return true;
  }
  /**
   * 加载保存的账号密码与多账号列表
   */
  static getInitialLoginState() {
    const credentials = services_storageService.StorageService.getSavedCredentials();
    const savedAccounts = services_storageService.StorageService.getSavedAccounts().sort((a, b) => b.lastUsed - a.lastUsed);
    return {
      account: credentials.account,
      password: credentials.password,
      savedAccounts
    };
  }
  /**
   * 更新历史多账号记录
   */
  static updateSavedAccounts(account, password) {
    const list = services_storageService.StorageService.getSavedAccounts();
    const index = list.findIndex((a) => a.account === account);
    if (index !== -1) {
      list[index].password = password;
      list[index].lastUsed = Date.now();
    } else {
      list.push({
        account,
        password,
        lastUsed: Date.now()
      });
    }
    services_storageService.StorageService.setSavedAccounts(list);
    return list;
  }
  /**
   * 删除某个历史账号记录
   */
  static deleteSavedAccount(account) {
    const list = services_storageService.StorageService.getSavedAccounts().filter((a) => a.account !== account);
    services_storageService.StorageService.setSavedAccounts(list);
    return list;
  }
  /**
   * 退出登录
   */
  static logout() {
    const userStore = store_user.useUserStore();
    userStore.logout();
    services_storageService.StorageService.clearAllAuth();
  }
}
exports.AuthService = AuthService;
