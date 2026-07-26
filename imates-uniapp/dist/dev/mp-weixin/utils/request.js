"use strict";
const common_vendor = require("../common/vendor.js");
const config_envConfig = require("../config/env-config.js");
const request = (options) => {
  return new Promise((resolve, reject) => {
    const baseUrl = options.baseUrl || config_envConfig.getApiBaseUrl();
    const xuebanToken = common_vendor.index.getStorageSync("XUEBAN_TOKEN") || "";
    const yanbanToken = common_vendor.index.getStorageSync("YANBAN_TOKEN") || "";
    common_vendor.index.request({
      url: options.url.startsWith("http") ? options.url : `${baseUrl}${options.url}`,
      method: options.method || "GET",
      data: options.data,
      header: {
        "Content-Type": "application/json",
        "Authorization": xuebanToken ? `Bearer ${xuebanToken}` : "",
        "Xueban-Token": xuebanToken,
        "Yanban-Token": yanbanToken,
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          common_vendor.index.showToast({
            title: `请求错误: ${res.statusCode}`,
            icon: "none"
          });
          reject(res);
        }
      },
      fail: (err) => {
        common_vendor.index.showToast({
          title: "网络连接失败",
          icon: "none"
        });
        reject(err);
      }
    });
  });
};
exports.request = request;
