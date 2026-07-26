"use strict";
const common_vendor = require("../common/vendor.js");
const useUserStore = common_vendor.defineStore("user", () => {
  const token = common_vendor.ref(common_vendor.index.getStorageSync("XUEBAN_TOKEN") || "");
  const userInfo = common_vendor.ref(null);
  function setToken(newToken) {
    token.value = newToken;
    common_vendor.index.setStorageSync("XUEBAN_TOKEN", newToken);
  }
  function setUserInfo(info) {
    userInfo.value = info;
    common_vendor.index.setStorageSync("userInfo", JSON.stringify(info));
  }
  function logout() {
    token.value = "";
    userInfo.value = null;
    common_vendor.index.removeStorageSync("XUEBAN_TOKEN");
    common_vendor.index.removeStorageSync("userInfo");
  }
  return {
    token,
    userInfo,
    setToken,
    setUserInfo,
    logout
  };
});
exports.useUserStore = useUserStore;
