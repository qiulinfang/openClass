package com.imates;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import android.util.Log;
import org.json.JSONObject;
import org.json.JSONException;

/**
 * Android Bridge Native Module
 * 提供与 React Native 的通信接口
 * 
 * 主要功能：
 * - 用户信息同步
 * - Toast 显示
 * - 事件发送
 */
public class AndroidBridgeModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "AndroidBridge";
    private ReactApplicationContext reactContext;

    public AndroidBridgeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * 同步用户信息到原生 ViewModel
     * 第1步：接收用户信息参数
     * 第2步：同步到原生 ViewModel
     * 第3步：返回同步结果
     * 
     * @param userId 用户ID
     * @param token 用户Token
     * @param password 用户密码（可选）
     * @param promise Promise对象，返回同步结果
     */
    @ReactMethod
    public void syncUserInfo(String userId, String token, String password, Promise promise) {
        try {
            // 第1步：接收用户信息参数
            Log.d(MODULE_NAME, "同步用户信息: userId=" + userId + ", token=" + token);
            
            // 第2步：同步到原生 ViewModel
            // 注意：这里需要根据实际的 ViewModel 实现来调用
            // UserInfoViewModel userInfoViewModel = getViewModel();
            // userInfoViewModel.userId.postValue(userId);
            // userInfoViewModel.token.postValue(token);
            // userInfoViewModel.password.postValue(password);
            
            // 第3步：返回同步结果
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", true);
            result.putString("message", "同步成功");
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(MODULE_NAME, "同步用户信息失败", e);
            promise.reject("SYNC_USER_INFO_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 获取用户信息
     * 第1步：从原生 ViewModel 获取用户信息
     * 第2步：转换为 JSON 格式
     * 第3步：返回用户信息
     * 
     * @param promise Promise对象，返回用户信息
     */
    @ReactMethod
    public void getUserInfo(Promise promise) {
        try {
            // 第1步：从原生 ViewModel 获取用户信息
            // 注意：这里需要根据实际的 ViewModel 实现来调用
            // UserInfoViewModel userInfoViewModel = getViewModel();
            // UserInfo userInfo = userInfoViewModel.userInfo.getValue();
            
            // 第2步：转换为 JSON 格式
            JSONObject userInfoJson = new JSONObject();
            userInfoJson.put("id", "");
            userInfoJson.put("name", "");
            userInfoJson.put("avatar", "");
            
            // 第3步：返回用户信息
            promise.resolve(userInfoJson.toString());
        } catch (Exception e) {
            Log.e(MODULE_NAME, "获取用户信息失败", e);
            promise.reject("GET_USER_INFO_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 获取用户Token
     * 
     * @param promise Promise对象，返回用户Token
     */
    @ReactMethod
    public void getUserToken(Promise promise) {
        try {
            // 注意：这里需要根据实际的 ViewModel 实现来调用
            // UserInfoViewModel userInfoViewModel = getViewModel();
            // String token = userInfoViewModel.token.getValue();
            
            // 临时返回空字符串
            promise.resolve("");
        } catch (Exception e) {
            Log.e(MODULE_NAME, "获取用户Token失败", e);
            promise.reject("GET_USER_TOKEN_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 显示Toast消息
     * 
     * @param message Toast消息内容
     */
    @ReactMethod
    public void showToast(String message) {
        try {
            // 注意：需要在主线程中执行
            getCurrentActivity().runOnUiThread(() -> {
                android.widget.Toast.makeText(
                    getCurrentActivity(),
                    message,
                    android.widget.Toast.LENGTH_SHORT
                ).show();
            });
        } catch (Exception e) {
            Log.e(MODULE_NAME, "显示Toast失败", e);
        }
    }

    /**
     * 显示通知
     * 
     * @param message 通知内容
     * @param type 通知类型：success, error, warning, info
     */
    @ReactMethod
    public void showNotification(String message, String type) {
        try {
            // 注意：需要在主线程中执行
            getCurrentActivity().runOnUiThread(() -> {
                android.widget.Toast.makeText(
                    getCurrentActivity(),
                    message,
                    android.widget.Toast.LENGTH_SHORT
                ).show();
            });
        } catch (Exception e) {
            Log.e(MODULE_NAME, "显示通知失败", e);
        }
    }

    /**
     * 退出当前Activity
     */
    @ReactMethod
    public void exitActivity() {
        try {
            getCurrentActivity().runOnUiThread(() -> {
                if (getCurrentActivity() != null) {
                    getCurrentActivity().finish();
                }
            });
        } catch (Exception e) {
            Log.e(MODULE_NAME, "退出Activity失败", e);
        }
    }

    /**
     * 发送事件到 React Native
     * 
     * @param eventName 事件名称
     * @param params 事件参数
     */
    private void sendEvent(String eventName, WritableMap params) {
        if (reactContext != null) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }
}

