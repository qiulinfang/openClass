var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
import { a as androidBridge, h as httpClient, s as setBaseUrl } from "./findExercise.Cq6-bjSm.js";
import "./vendor.r57rLZDD.js";
import "./tiptap.CO2u2T2d.js";
function initializeAppConfig() {
  return __async(this, arguments, function* (initData = {}) {
    const baseUrl = "http://www.imates.com.cn:8222/blw-edu-service-alc";
    httpClient.setBaseURL(baseUrl);
    setBaseUrl(baseUrl);
    let token = "";
    if (initData && typeof initData === "object" && "token" in initData) {
      token = initData.token || "";
      console.log("🔑 从配置数据获取Token:", token ? `${token.substring(0, 10)}...` : "空");
    }
    if (!token) {
      token = androidBridge.getUserToken();
      console.log("🔑 从Android Bridge获取Token:", token ? `${token.substring(0, 10)}...` : "空");
      console.log("🔑 Android Bridge 可用性:", androidBridge.isAndroidBridgeAvailable());
    }
    if (!token) {
      token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "";
      console.log("🔑 从本地存储获取Token:", token ? `${token.substring(0, 10)}...` : "空");
    }
    if (token) {
      httpClient.setAuthToken(token);
      console.log("🔑 Token 已设置到 HTTP 客户端");
    } else {
      console.warn("🔑 警告：未获取到有效的 Token，API 请求可能失败");
    }
    if (initData && typeof initData === "object") {
      console.log("初始化配置数据:", initData);
    }
  });
}
function getUserInfo(initData = {}) {
  if (androidBridge.isAndroidBridgeAvailable()) {
    const userInfo = androidBridge.getUserInfo();
    if (userInfo == null ? void 0 : userInfo.userId) return userInfo;
  }
  if (initData && typeof initData === "object" && "userInfo" in initData) {
    const userInfo = initData.userInfo;
    if (userInfo == null ? void 0 : userInfo.userId) {
      return userInfo;
    }
  }
  try {
    const stored = localStorage.getItem("userInfo");
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}
export {
  getUserInfo,
  initializeAppConfig
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLXV0aWxzLkNuRG1ETk85LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdXRpbHMvY29uZmlnLXV0aWxzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog6YWN572u5bel5YW35Ye95pWwXG4gKiDnroDljZXnmoTphY3nva7liJ3lp4vljJblkoznrqHnkIZcbiAqL1xuXG5pbXBvcnQgeyBodHRwQ2xpZW50IH0gZnJvbSAnLi4vc2VydmljZXMvaHR0cC1jbGllbnQnXG5pbXBvcnQgeyBhbmRyb2lkQnJpZGdlIH0gZnJvbSAnLi4vc2VydmljZXMvYW5kcm9pZC1icmlkZ2UnXG5pbXBvcnQgeyBzZXRCYXNlVXJsIH0gZnJvbSAnLi4vc2VydmljZXMvYXBpLWVuZHBvaW50cydcblxuLyoqXG4gKiDliJ3lp4vljJblupTnlKjphY3nva5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGluaXRpYWxpemVBcHBDb25maWcoaW5pdERhdGE6IHVua25vd24gPSB7fSkge1xuICAvLyAxLiDorr7nva5BUEnln7rnoYBVUkwgLSDlkIzml7borr7nva7kuKTkuKrlnLDmlrlcbiAgY29uc3QgYmFzZVVybCA9IFwiaHR0cDovL3d3dy5pbWF0ZXMuY29tLmNuOjgyMjIvYmx3LWVkdS1zZXJ2aWNlLWFsY1wiXG4gIGh0dHBDbGllbnQuc2V0QmFzZVVSTChiYXNlVXJsKVxuICBzZXRCYXNlVXJsKGJhc2VVcmwpIC8vIOiuvue9riBhcGktZW5kcG9pbnRzIOS4reeahOWfuuehgFVSTFxuXG4gIC8vIDIuIOiuvue9ruiupOivgVRva2VuIC0g5LyY5YWI57qn77yaaW5pdERhdGEgPiBBbmRyb2lkIEJyaWRnZSA+IOacrOWcsOWtmOWCqFxuICBsZXQgdG9rZW4gPSAnJ1xuICBcbiAgLy8g6aaW5YWI5bCd6K+V5LuO5Lyg5YWl55qE6YWN572u5pWw5o2u5Lit6I635Y+WXG4gIGlmIChpbml0RGF0YSAmJiB0eXBlb2YgaW5pdERhdGEgPT09ICdvYmplY3QnICYmICd0b2tlbicgaW4gaW5pdERhdGEpIHtcbiAgICB0b2tlbiA9IChpbml0RGF0YSBhcyB7IHRva2VuPzogc3RyaW5nIH0pLnRva2VuIHx8ICcnXG4gICAgY29uc29sZS5sb2coJ/CflJEg5LuO6YWN572u5pWw5o2u6I635Y+WVG9rZW46JywgdG9rZW4gPyBgJHt0b2tlbi5zdWJzdHJpbmcoMCwgMTApfS4uLmAgOiAn56m6JylcbiAgfVxuICBcbiAgLy8g5aaC5p6c6YWN572u5pWw5o2u5Lit5rKh5pyJ77yM5bCd6K+V5LuOIEFuZHJvaWQgQnJpZGdlIOiOt+WPllxuICBpZiAoIXRva2VuKSB7XG4gICAgdG9rZW4gPSBhbmRyb2lkQnJpZGdlLmdldFVzZXJUb2tlbigpXG4gICAgY29uc29sZS5sb2coJ/CflJEg5LuOQW5kcm9pZCBCcmlkZ2Xojrflj5ZUb2tlbjonLCB0b2tlbiA/IGAke3Rva2VuLnN1YnN0cmluZygwLCAxMCl9Li4uYCA6ICfnqbonKVxuICAgIGNvbnNvbGUubG9nKCfwn5SRIEFuZHJvaWQgQnJpZGdlIOWPr+eUqOaApzonLCBhbmRyb2lkQnJpZGdlLmlzQW5kcm9pZEJyaWRnZUF2YWlsYWJsZSgpKVxuICB9XG4gIFxuICAvLyDlpoLmnpzov5jmmK/msqHmnInvvIzlsJ3or5Xku47mnKzlnLDlrZjlgqjojrflj5ZcbiAgaWYgKCF0b2tlbikge1xuICAgIHRva2VuID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2F1dGhUb2tlbicpIHx8IHNlc3Npb25TdG9yYWdlLmdldEl0ZW0oJ2F1dGhUb2tlbicpIHx8ICcnXG4gICAgY29uc29sZS5sb2coJ/CflJEg5LuO5pys5Zyw5a2Y5YKo6I635Y+WVG9rZW46JywgdG9rZW4gPyBgJHt0b2tlbi5zdWJzdHJpbmcoMCwgMTApfS4uLmAgOiAn56m6JylcbiAgfVxuICBcbiAgaWYgKHRva2VuKSB7XG4gICAgaHR0cENsaWVudC5zZXRBdXRoVG9rZW4odG9rZW4pXG4gICAgY29uc29sZS5sb2coJ/CflJEgVG9rZW4g5bey6K6+572u5YiwIEhUVFAg5a6i5oi356uvJylcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oJ/CflJEg6K2m5ZGK77ya5pyq6I635Y+W5Yiw5pyJ5pWI55qEIFRva2Vu77yMQVBJIOivt+axguWPr+iDveWksei0pScpXG4gIH1cbiAgXG4gIC8vIDMuIOWkhOeQhuS8oOWFpeeahOWIneWni+WMluaVsOaNru+8iOWmguaenOmcgOimgeeahOivne+8iVxuICBpZiAoaW5pdERhdGEgJiYgdHlwZW9mIGluaXREYXRhID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnNvbGUubG9nKCfliJ3lp4vljJbphY3nva7mlbDmja46JywgaW5pdERhdGEpXG4gIH1cbn1cblxuLyoqXG4gKiDojrflj5bnlKjmiLfkv6Hmga9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJJbmZvKGluaXREYXRhOiB1bmtub3duID0ge30pIHtcbiAgLy8g5LyY5YWI57qn77yaQW5kcm9pZCBCcmlkZ2UgPiBpbml0RGF0YSA+IOacrOWcsOWtmOWCqFxuICBpZiAoYW5kcm9pZEJyaWRnZS5pc0FuZHJvaWRCcmlkZ2VBdmFpbGFibGUoKSkge1xuICAgIGNvbnN0IHVzZXJJbmZvID0gYW5kcm9pZEJyaWRnZS5nZXRVc2VySW5mbygpXG4gICAgaWYgKHVzZXJJbmZvPy51c2VySWQpIHJldHVybiB1c2VySW5mb1xuICB9XG5cbiAgaWYgKGluaXREYXRhICYmIHR5cGVvZiBpbml0RGF0YSA9PT0gJ29iamVjdCcgJiYgJ3VzZXJJbmZvJyBpbiBpbml0RGF0YSkge1xuICAgIGNvbnN0IHVzZXJJbmZvID0gKGluaXREYXRhIGFzIHsgdXNlckluZm8/OiB7IHVzZXJJZD86IHN0cmluZyB9IH0pLnVzZXJJbmZvXG4gICAgaWYgKHVzZXJJbmZvPy51c2VySWQpIHtcbiAgICAgIHJldHVybiB1c2VySW5mb1xuICAgIH1cbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3Qgc3RvcmVkID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3VzZXJJbmZvJylcbiAgICByZXR1cm4gc3RvcmVkID8gSlNPTi5wYXJzZShzdG9yZWQpIDogbnVsbFxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFZQSxTQUFzQixzQkFBNEM7QUFBQSw2Q0FBeEIsV0FBb0IsSUFBSTtBQUVoRSxVQUFNLFVBQVU7QUFDaEIsZUFBVyxXQUFXLE9BQU87QUFDN0IsZUFBVyxPQUFPO0FBR2xCLFFBQUksUUFBUTtBQUdaLFFBQUksWUFBWSxPQUFPLGFBQWEsWUFBWSxXQUFXLFVBQVU7QUFDbkUsY0FBUyxTQUFnQyxTQUFTO0FBQ2xELGNBQVEsSUFBSSxvQkFBb0IsUUFBUSxHQUFHLE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQyxRQUFRLEdBQUc7QUFBQSxJQUM5RTtBQUdBLFFBQUksQ0FBQyxPQUFPO0FBQ1YsY0FBUSxjQUFjLGFBQUE7QUFDdEIsY0FBUSxJQUFJLDhCQUE4QixRQUFRLEdBQUcsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDLFFBQVEsR0FBRztBQUN0RixjQUFRLElBQUksMEJBQTBCLGNBQWMseUJBQUEsQ0FBMEI7QUFBQSxJQUNoRjtBQUdBLFFBQUksQ0FBQyxPQUFPO0FBQ1YsY0FBUSxhQUFhLFFBQVEsV0FBVyxLQUFLLGVBQWUsUUFBUSxXQUFXLEtBQUs7QUFDcEYsY0FBUSxJQUFJLG9CQUFvQixRQUFRLEdBQUcsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDLFFBQVEsR0FBRztBQUFBLElBQzlFO0FBRUEsUUFBSSxPQUFPO0FBQ1QsaUJBQVcsYUFBYSxLQUFLO0FBQzdCLGNBQVEsSUFBSSx3QkFBd0I7QUFBQSxJQUN0QyxPQUFPO0FBQ0wsY0FBUSxLQUFLLGdDQUFnQztBQUFBLElBQy9DO0FBR0EsUUFBSSxZQUFZLE9BQU8sYUFBYSxVQUFVO0FBQzVDLGNBQVEsSUFBSSxZQUFZLFFBQVE7QUFBQSxJQUNsQztBQUFBLEVBQ0Y7QUFBQTtBQUtPLFNBQVMsWUFBWSxXQUFvQixJQUFJO0FBRWxELE1BQUksY0FBYyw0QkFBNEI7QUFDNUMsVUFBTSxXQUFXLGNBQWMsWUFBQTtBQUMvQixRQUFJLHFDQUFVLE9BQVEsUUFBTztBQUFBLEVBQy9CO0FBRUEsTUFBSSxZQUFZLE9BQU8sYUFBYSxZQUFZLGNBQWMsVUFBVTtBQUN0RSxVQUFNLFdBQVksU0FBZ0Q7QUFDbEUsUUFBSSxxQ0FBVSxRQUFRO0FBQ3BCLGFBQU87QUFBQSxJQUNUO0FBQUEsRUFDRjtBQUVBLE1BQUk7QUFDRixVQUFNLFNBQVMsYUFBYSxRQUFRLFVBQVU7QUFDOUMsV0FBTyxTQUFTLEtBQUssTUFBTSxNQUFNLElBQUk7QUFBQSxFQUN2QyxTQUFRO0FBQ04sV0FBTztBQUFBLEVBQ1Q7QUFDRjsifQ==
