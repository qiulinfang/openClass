"use strict";
const common_vendor = require("../../common/vendor.js");
const services_authService = require("../../services/authService.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "login",
  setup(__props) {
    const loginForm = common_vendor.reactive({
      account: "",
      password: ""
    });
    const errors = common_vendor.reactive({
      account: "",
      password: ""
    });
    const isLoading = common_vendor.ref(false);
    const errorMessage = common_vendor.ref("");
    const savedAccounts = common_vendor.ref([]);
    const showAccountsDropdown = common_vendor.ref(false);
    const toggleAccountsDropdown = () => {
      showAccountsDropdown.value = !showAccountsDropdown.value;
    };
    const selectAccount = (item) => {
      loginForm.account = item.account;
      loginForm.password = item.password;
      showAccountsDropdown.value = false;
      validateAccount();
      validatePassword();
    };
    const deleteSavedAccount = (account) => {
      savedAccounts.value = services_authService.AuthService.deleteSavedAccount(account);
    };
    common_vendor.onMounted(() => {
      const initialState = services_authService.AuthService.getInitialLoginState();
      loginForm.account = initialState.account;
      loginForm.password = initialState.password;
      savedAccounts.value = initialState.savedAccounts;
    });
    const validateAccount = () => {
      if (!loginForm.account.trim()) {
        errors.account = "请输入账号";
        return false;
      }
      errors.account = "";
      return true;
    };
    const validatePassword = () => {
      if (!loginForm.password.trim()) {
        errors.password = "请输入密码";
        return false;
      }
      errors.password = "";
      return true;
    };
    const isFormValid = common_vendor.computed(() => {
      return loginForm.account.trim() !== "" && loginForm.password.trim() !== "" && !errors.account && !errors.password;
    });
    const handleLogin = async () => {
      errorMessage.value = "";
      if (!validateAccount() || !validatePassword())
        return;
      isLoading.value = true;
      try {
        await services_authService.AuthService.login({
          account: loginForm.account,
          password: loginForm.password
        });
        common_vendor.index.showToast({ title: "登录成功", icon: "success" });
        common_vendor.index.reLaunch({
          url: "/pages/index/index"
        });
      } catch (error) {
        errorMessage.value = (error == null ? void 0 : error.message) || "登录失败，请检查网络";
      } finally {
        isLoading.value = false;
      }
    };
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.o(validateAccount, "57"),
        b: common_vendor.o(($event) => showAccountsDropdown.value = true, "15"),
        c: loginForm.account,
        d: common_vendor.o(($event) => loginForm.account = $event.detail.value, "22"),
        e: savedAccounts.value.length > 0
      }, savedAccounts.value.length > 0 ? {
        f: common_vendor.o(toggleAccountsDropdown, "4b")
      } : {}, {
        g: showAccountsDropdown.value && savedAccounts.value.length > 0
      }, showAccountsDropdown.value && savedAccounts.value.length > 0 ? {
        h: common_vendor.f(savedAccounts.value, (item, k0, i0) => {
          return {
            a: common_vendor.t(item.account),
            b: common_vendor.o(($event) => deleteSavedAccount(item.account), item.account),
            c: item.account,
            d: common_vendor.o(($event) => selectAccount(item), item.account)
          };
        })
      } : {}, {
        i: !!errors.account ? 1 : "",
        j: errors.account
      }, errors.account ? {
        k: common_vendor.t(errors.account)
      } : {}, {
        l: common_vendor.o(validatePassword, "82"),
        m: loginForm.password,
        n: common_vendor.o(($event) => loginForm.password = $event.detail.value, "49"),
        o: !!errors.password ? 1 : "",
        p: errors.password
      }, errors.password ? {
        q: common_vendor.t(errors.password)
      } : {}, {
        r: isLoading.value
      }, isLoading.value ? {} : {}, {
        s: !isFormValid.value || isLoading.value,
        t: common_vendor.o(handleLogin, "34"),
        v: errorMessage.value
      }, errorMessage.value ? {
        w: common_vendor.t(errorMessage.value)
      } : {}, {
        x: common_vendor.o(handleLogin, "f7")
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-cdfe2409"]]);
wx.createPage(MiniProgramPage);
