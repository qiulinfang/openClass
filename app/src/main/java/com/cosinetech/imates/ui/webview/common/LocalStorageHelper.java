package com.cosinetech.imates.ui.webview.common;

import android.util.Log;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Iterator;

/**
 * WebView localStorage访问工具类
 * 用于Android端从WebView的localStorage中获取数据
 * 
 * 使用示例：
 * <pre>
 * LocalStorageHelper helper = new LocalStorageHelper(webView);
 * 
 * // 获取单个key的值
 * helper.getItem("userToken", new LocalStorageHelper.ItemCallback() {
 *     @Override
 *     public void onResult(String value) {
 *         if (value != null) {
 *             Log.d(TAG, "userToken = " + value);
 *         } else {
 *             Log.d(TAG, "userToken不存在");
 *         }
 *     }
 * });
 * 
 * // 获取所有localStorage数据
 * helper.getAllItems(new LocalStorageHelper.AllItemsCallback() {
 *     @Override
 *     public void onResult(JSONObject storage) {
 *         Log.d(TAG, "获取所有localStorage，共" + storage.length() + "项");
 *     }
 * });
 * </pre>
 */
public class LocalStorageHelper {
    private static final String TAG = "LocalStorageHelper";
    private WebView webView;

    public LocalStorageHelper(WebView webView) {
        this.webView = webView;
    }

    /**
     * 获取单个localStorage项的回调接口
     */
    public interface ItemCallback {
        /**
         * 获取结果回调
         * @param value localStorage的值，如果不存在则为null
         */
        void onResult(String value);
    }

    /**
     * 获取所有localStorage项的回调接口
     */
    public interface AllItemsCallback {
        /**
         * 获取结果回调
         * @param storage 所有localStorage数据的JSONObject
         */
        void onResult(JSONObject storage);
    }

    /**
     * 获取指定key的localStorage值
     * 
     * @param key localStorage的key
     * @param callback 结果回调
     */
    public void getItem(String key, ItemCallback callback) {
        if (webView == null) {
            Log.e(TAG, "WebView为空，无法获取localStorage");
            if (callback != null) {
                callback.onResult(null);
            }
            return;
        }

        if (key == null || key.isEmpty()) {
            Log.e(TAG, "key为空，无法获取localStorage");
            if (callback != null) {
                callback.onResult(null);
            }
            return;
        }

        // 转义key中的特殊字符
        String safeKey = key.replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"");
        
        // 构造JavaScript代码：直接使用localStorage.getItem
        String jsCode = String.format(
            "(function(){" +
            "  try {" +
            "    var value = localStorage.getItem('%s');" +
            "    return value !== null ? value : null;" +
            "  } catch(e) {" +
            "    return null;" +
            "  }" +
            "})()",
            safeKey
        );

        // 执行JavaScript并获取返回值
        webView.evaluateJavascript(jsCode, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                try {
                    String result = null;
                    
                    // evaluateJavascript返回的值可能是：
                    // 1. 字符串值：带引号的JSON字符串，如 "\"actualValue\""
                    // 2. null值：字符串 "null"
                    // 3. 空值：null或空字符串
                    
                    if (value != null && !value.isEmpty() && !value.equals("null")) {
                        // 移除JSON字符串的引号
                        result = value.replaceAll("^\"|\"$", "");
                        // 处理转义字符
                        result = result.replace("\\\"", "\"")
                                      .replace("\\\\", "\\")
                                      .replace("\\n", "\n")
                                      .replace("\\r", "\r");
                    }
                    
                    Log.d(TAG, "获取localStorage[" + key + "] = " + (result != null ? result : "null"));
                    
                    if (callback != null) {
                        callback.onResult(result);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "处理localStorage返回值失败", e);
                    if (callback != null) {
                        callback.onResult(null);
                    }
                }
            }
        });
    }

    /**
     * 获取所有localStorage数据
     * 
     * @param callback 结果回调
     */
    public void getAllItems(AllItemsCallback callback) {
        if (webView == null) {
            Log.e(TAG, "WebView为空，无法获取localStorage");
            if (callback != null) {
                try {
                    callback.onResult(new JSONObject());
                } catch (Exception e) {
                    Log.e(TAG, "创建空JSONObject失败", e);
                }
            }
            return;
        }

        // 构造JavaScript代码：直接遍历localStorage获取所有数据
        String jsCode = "(function(){" +
                       "  try {" +
                       "    var storage = {};" +
                       "    for(var i = 0; i < localStorage.length; i++) {" +
                       "      var key = localStorage.key(i);" +
                       "      if(key) {" +
                       "        storage[key] = localStorage.getItem(key) || '';" +
                       "      }" +
                       "    }" +
                       "    return JSON.stringify(storage);" +
                       "  } catch(e) {" +
                       "    return '{}';" +
                       "  }" +
                       "})()";

        // 执行JavaScript并获取返回值
        webView.evaluateJavascript(jsCode, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String jsonStr) {
                try {
                    JSONObject storage = new JSONObject();
                    
                    if (jsonStr != null && !jsonStr.isEmpty() && !jsonStr.equals("null")) {
                        // 移除JSON字符串的引号并处理转义
                        String cleanJson = jsonStr.replaceAll("^\"|\"$", "")
                                                 .replace("\\\"", "\"")
                                                 .replace("\\\\", "\\");
                        storage = new JSONObject(cleanJson);
                    }
                    
                    Log.d(TAG, "获取所有localStorage，共" + storage.length() + "项");
                    
                    // 打印所有key-value（调试用）
                    if (Log.isLoggable(TAG, Log.DEBUG)) {
                        Iterator<String> keys = storage.keys();
                        while (keys.hasNext()) {
                            String key = keys.next();
                            String value = storage.getString(key);
                            Log.d(TAG, "  " + key + " = " + value);
                        }
                    }
                    
                    if (callback != null) {
                        callback.onResult(storage);
                    }
                } catch (JSONException e) {
                    Log.e(TAG, "解析localStorage数据失败", e);
                    if (callback != null) {
                        try {
                            callback.onResult(new JSONObject());
                        } catch (Exception ex) {
                            Log.e(TAG, "创建空JSONObject失败", ex);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "处理localStorage返回值失败", e);
                    if (callback != null) {
                        try {
                            callback.onResult(new JSONObject());
                        } catch (Exception ex) {
                            Log.e(TAG, "创建空JSONObject失败", ex);
                        }
                    }
                }
            }
        });
    }

    /**
     * 同步获取localStorage值（不推荐，因为evaluateJavascript是异步的）
     * 此方法会阻塞线程，仅用于特殊情况
     * 
     * @param key localStorage的key
     * @return localStorage的值，如果不存在则为null
     */
    @Deprecated
    public String getItemSync(String key) {
        // 注意：evaluateJavascript是异步的，无法真正同步获取
        // 此方法仅作为示例，实际使用请使用getItem方法
        final String[] result = {null};
        final Object lock = new Object();
        
        getItem(key, new ItemCallback() {
            @Override
            public void onResult(String value) {
                synchronized (lock) {
                    result[0] = value;
                    lock.notify();
                }
            }
        });
        
        try {
            synchronized (lock) {
                lock.wait(5000); // 最多等待5秒
            }
        } catch (InterruptedException e) {
            Log.e(TAG, "等待localStorage结果被中断", e);
        }
        
        return result[0];
    }
}

