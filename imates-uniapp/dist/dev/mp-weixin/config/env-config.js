"use strict";
const common_vendor = require("../common/vendor.js");
var AppEnvType = /* @__PURE__ */ ((AppEnvType2) => {
  AppEnvType2["RELEASE"] = "RELEASE";
  AppEnvType2["INTERNAL_TEST"] = "INTERNAL_TEST";
  return AppEnvType2;
})(AppEnvType || {});
const ADDRESS_CATALOG = {
  IMATES_HTTP: "https://www.imates.com.cn",
  XUEBAN_RELEASE: "http://www.imates.com.cn:8222/blw-edu-service-alc",
  XUEBAN_TEST: "http://www.imates.com.cn:58443/blw-edu-service-alc",
  YANBAN_RELEASE: "https://www.imates.com.cn:9099"
};
const STORAGE_KEY = "app_env_type";
function getCurrentEnvType() {
  try {
    const stored = common_vendor.index.getStorageSync(STORAGE_KEY);
    if (stored && Object.values(AppEnvType).includes(stored)) {
      return stored;
    }
  } catch (error) {
    console.warn("[EnvConfig] 读取环境配置失败:", error);
  }
  return "RELEASE";
}
const getIsInternalTest = () => getCurrentEnvType() === "INTERNAL_TEST";
function getApiBaseUrl() {
  return getIsInternalTest() ? ADDRESS_CATALOG.XUEBAN_TEST : ADDRESS_CATALOG.XUEBAN_RELEASE;
}
function getYanbanBaseUrl() {
  return getIsInternalTest() ? ADDRESS_CATALOG.IMATES_HTTP : ADDRESS_CATALOG.YANBAN_RELEASE;
}
function getApiPaths() {
  if (getIsInternalTest()) {
    return {
      xueban: {
        admin: {
          login: "/xb-test/admin/login",
          info: "/xb-test/admin/info"
        }
      },
      yanban: {
        auth: {
          loginStudent: "/yb-test/blw-edu-yb/auth/login-student"
        }
      }
    };
  }
  return {
    xueban: {
      admin: {
        login: "/xb-release/admin/login",
        info: "/xb-release/admin/info"
      }
    },
    yanban: {
      auth: {
        loginStudent: "/yb-release/blw-edu-yb/auth/login-student"
      }
    }
  };
}
exports.getApiBaseUrl = getApiBaseUrl;
exports.getApiPaths = getApiPaths;
exports.getYanbanBaseUrl = getYanbanBaseUrl;
