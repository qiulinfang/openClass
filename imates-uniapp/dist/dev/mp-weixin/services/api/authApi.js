"use strict";
const utils_request = require("../../utils/request.js");
const config_envConfig = require("../../config/env-config.js");
class AuthApi {
  /**
   * 学伴登录接口 (/xb-release/admin/login 或 /xb-test/admin/login)
   */
  static async loginXueban(params) {
    var _a;
    const paths = config_envConfig.getApiPaths();
    const res = await utils_request.request({
      url: paths.xueban.admin.login,
      method: "POST",
      data: params
    });
    if (!res.success && res.message) {
      throw new Error(res.message);
    }
    const token = ((_a = res.data) == null ? void 0 : _a.token) || res.token;
    if (!token) {
      throw new Error("登录失败：未获取到token");
    }
    return token;
  }
  /**
   * 获取学伴用户信息接口 (/xb-release/admin/info 或 /xb-test/admin/info)
   */
  static async getUserInfo(token) {
    const paths = config_envConfig.getApiPaths();
    const res = await utils_request.request({
      url: `${paths.xueban.admin.info}?token=${token}`,
      method: "GET"
    });
    return res.data || res;
  }
  /**
   * 研伴学生同步登录接口 (/yb-release/blw-edu-yb/auth/login-student 或 /yb-test)
   */
  static async loginYanban(params) {
    const paths = config_envConfig.getApiPaths();
    const yanbanBaseUrl = config_envConfig.getYanbanBaseUrl();
    try {
      const res = await utils_request.request({
        url: paths.yanban.auth.loginStudent,
        method: "POST",
        baseUrl: yanbanBaseUrl,
        data: params
      });
      return res;
    } catch {
      return null;
    }
  }
}
exports.AuthApi = AuthApi;
