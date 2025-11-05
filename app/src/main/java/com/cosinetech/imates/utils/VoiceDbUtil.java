package com.cosinetech.imates.utils;

import android.media.MediaMetadataRetriever;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

public class VoiceDbUtil {
    public static class VoiceDbItem {
        //时长,秒
        public int duration;

        //路径
        public String voicePath;
    }
    
    /**
     * 日志收集器，用于收集详细的调试信息
     */
    public static class VoiceDebugLogs {
        private List<String> logs = new ArrayList<>();
        
        public void addLog(String log) {
            logs.add(log);
            Log.d("VoiceDebug", log);
        }
        
        public List<String> getLogs() {
            return new ArrayList<>(logs);
        }
        
        public String getLogsAsString() {
            return String.join("\n", logs);
        }
        
        public void clear() {
            logs.clear();
        }
    }

    public static void saveVoiceFile(String base64VoiceData, String filePath) {
        saveVoiceFile(base64VoiceData, filePath, null);
    }
    
    public static boolean saveVoiceFile(String base64VoiceData, String filePath, VoiceDebugLogs debugLogs) {
        if (debugLogs != null) {
            debugLogs.addLog("[saveVoiceFile] 开始保存音频文件: " + filePath);
            debugLogs.addLog("[saveVoiceFile] Base64数据长度: " + (base64VoiceData != null ? base64VoiceData.length() : 0));
            // 添加原始数据预览（前200个字符，或全部如果小于200）
            if (base64VoiceData != null && base64VoiceData.length() > 0) {
                int previewLength = Math.min(200, base64VoiceData.length());
                String preview = base64VoiceData.substring(0, previewLength);
                debugLogs.addLog("[saveVoiceFile] 原始数据预览（前" + previewLength + "字符）: " + preview + (base64VoiceData.length() > previewLength ? "..." : ""));
            } else {
                debugLogs.addLog("[saveVoiceFile] ⚠️ Base64数据为null或空");
            }
        }
        
        String base64Voice;
        if(!base64VoiceData.startsWith("data:audio")) {
            base64Voice = base64VoiceData;
            if (debugLogs != null) {
                debugLogs.addLog("[saveVoiceFile] Base64数据不包含data:audio前缀，直接使用");
            }
        } else {
            // 安全地分割字符串，检查数组长度
            String[] parts = base64VoiceData.split(",");
            if (debugLogs != null) {
                debugLogs.addLog("[saveVoiceFile] 检测到data:audio前缀，分割后parts数量: " + parts.length);
                if (parts.length > 0) {
                    debugLogs.addLog("[saveVoiceFile] parts[0]（前缀部分）: " + parts[0]);
                }
                if (parts.length > 1) {
                    debugLogs.addLog("[saveVoiceFile] parts[1]（Base64数据部分）长度: " + parts[1].length());
                } else {
                    debugLogs.addLog("[saveVoiceFile] ⚠️ parts[1]不存在，Base64数据部分为空");
                }
            }
            if (parts.length >= 2) {
                base64Voice = parts[1];
                if (debugLogs != null) {
                    debugLogs.addLog("[saveVoiceFile] 从data:audio前缀中提取Base64数据，提取后长度: " + base64Voice.length());
                    if (base64Voice.isEmpty()) {
                        debugLogs.addLog("[saveVoiceFile] ⚠️ 提取的Base64数据为空字符串");
                    }
                }
            } else {
                // 更精确的错误信息
                String errorMsg;
                if (parts.length == 1) {
                    // 只有前缀，没有Base64数据
                    errorMsg = "Base64数据为空（只有前缀没有数据），无法保存：" + filePath;
                } else {
                    // 完全不包含逗号（理论上不会到这里，因为已经检查了startsWith）
                    errorMsg = "Base64数据格式错误（缺少逗号分隔符），无法保存：" + filePath;
                }
                Log.e("VoiceUtils", errorMsg);
                String fullData = base64VoiceData != null ? base64VoiceData : "null";
                Log.e("VoiceUtils", "原始数据（完整）: " + fullData);
                Log.e("VoiceUtils", "原始数据长度: " + (base64VoiceData != null ? base64VoiceData.length() : 0));
                if (debugLogs != null) {
                    debugLogs.addLog("[saveVoiceFile] ❌ " + errorMsg);
                    debugLogs.addLog("[saveVoiceFile] 原始数据（完整）: " + fullData);
                    debugLogs.addLog("[saveVoiceFile] 原始数据长度: " + (base64VoiceData != null ? base64VoiceData.length() : 0));
                    debugLogs.addLog("[saveVoiceFile] 数据是否以data:audio开头: " + (base64VoiceData != null && base64VoiceData.startsWith("data:audio")));
                    debugLogs.addLog("[saveVoiceFile] 分割后parts数量: " + parts.length);
                    if (parts.length == 1) {
                        debugLogs.addLog("[saveVoiceFile] ⚠️ 问题分析: 数据只有前缀部分，Base64数据部分缺失");
                        debugLogs.addLog("[saveVoiceFile] ⚠️ 可能原因: 1) RabbitMQ消息中的content字段不完整 2) 发送端未正确编码base64数据");
                    }
                }
                return false;
            }
        }
        if (base64Voice == null || base64Voice.isEmpty()) {
            String errorMsg = "Base64数据为空，无法保存：" + filePath;
            Log.e("VoiceUtils", errorMsg);
            if (debugLogs != null) {
                debugLogs.addLog("[saveVoiceFile] ❌ " + errorMsg);
                debugLogs.addLog("[saveVoiceFile] ⚠️ 问题分析: 提取的Base64数据为空");
                debugLogs.addLog("[saveVoiceFile] ⚠️ 可能原因:");
                debugLogs.addLog("[saveVoiceFile]   1. RabbitMQ消息中的content字段不完整（只有前缀data:audio/aac;base64,）");
                debugLogs.addLog("[saveVoiceFile]   2. 发送端未正确编码base64数据");
                debugLogs.addLog("[saveVoiceFile]   3. 数据在传输过程中被截断");
                debugLogs.addLog("[saveVoiceFile]   4. JSON解析时base64数据被错误处理");
                debugLogs.addLog("[saveVoiceFile] 原始输入数据长度: " + (base64VoiceData != null ? base64VoiceData.length() : 0));
                debugLogs.addLog("[saveVoiceFile] 提取后的Base64数据长度: " + (base64Voice != null ? base64Voice.length() : 0));
            }
            return false;
        }

        // 解码 Base64 数据
        byte[] decodedBytes;
        try {
            decodedBytes = Base64.getDecoder().decode(base64Voice);
            if (debugLogs != null) {
                debugLogs.addLog("[saveVoiceFile] Base64解码成功，解码后字节数: " + decodedBytes.length);
            }
        } catch (IllegalArgumentException e) {
            String errorMsg = "Base64 解码失败：" + filePath + "\n" + e.getMessage();
            Log.e("VoiceUtils", errorMsg);
            if (debugLogs != null) {
                debugLogs.addLog("[saveVoiceFile] ❌ " + errorMsg);
                debugLogs.addLog("[saveVoiceFile] ⚠️ 问题分析: Base64数据格式不正确，无法解码");
                debugLogs.addLog("[saveVoiceFile] ⚠️ 可能原因:");
                debugLogs.addLog("[saveVoiceFile]   1. Base64数据包含非法字符");
                debugLogs.addLog("[saveVoiceFile]   2. Base64数据长度不正确（不是4的倍数）");
                debugLogs.addLog("[saveVoiceFile]   3. Base64数据被截断或损坏");
                debugLogs.addLog("[saveVoiceFile]   4. 数据中混入了其他字符（如换行符、空格等）");
                debugLogs.addLog("[saveVoiceFile] 尝试解码的Base64数据长度: " + (base64Voice != null ? base64Voice.length() : 0));
                debugLogs.addLog("[saveVoiceFile] 解码异常详情: " + e.getMessage());
            }
            return false;
        }

        // 确保目标目录存在
        File file = new File(filePath);
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            boolean dirCreated = parentDir.mkdirs();
            if (debugLogs != null) {
                debugLogs.addLog("[saveVoiceFile] 创建目录: " + parentDir.getAbsolutePath() + ", 结果: " + dirCreated);
            }
            if (!dirCreated) {
                String errorMsg = "无法创建目标目录：" + parentDir.getAbsolutePath();
                Log.e("VoiceUtils", errorMsg);
                if (debugLogs != null) {
                    debugLogs.addLog("[saveVoiceFile] ❌ " + errorMsg);
                }
                return false;
            }
        } else if (debugLogs != null) {
            debugLogs.addLog("[saveVoiceFile] 目录已存在: " + (parentDir != null ? parentDir.getAbsolutePath() : "null"));
        }

        // 保存文件
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(decodedBytes);
            fos.flush();
            Log.e("VoiceUtils", "音频文件保存成功：" + filePath);
            if (debugLogs != null) {
                debugLogs.addLog("[saveVoiceFile] ✅ 文件保存成功: " + filePath);
                // 验证文件是否真的存在
                boolean fileExists = file.exists();
                long fileSize = fileExists ? file.length() : 0;
                debugLogs.addLog("[saveVoiceFile] 文件验证 - 存在: " + fileExists + ", 大小: " + fileSize + " 字节");
            }
            return true;
        } catch (IOException e) {
            String errorMsg = "音频文件保存失败：" + filePath + "\n" + e.getMessage();
            Log.e("VoiceUtils", errorMsg);
            if (debugLogs != null) {
                debugLogs.addLog("[saveVoiceFile] ❌ " + errorMsg);
            }
            return false;
        }
    }

    public static String getRawVoiceBase64(String voicePath) {
        try {
            // 读取文件内容为字节数组
            byte[] fileContent = Files.readAllBytes(Paths.get(voicePath));

            // 将字节数组编码为 Base64 字符串, 带audio前缀
            return "data:audio/aac;base64," + Base64.getEncoder().encodeToString(fileContent);
        } catch (Exception e) {
            // 处理异常
            Log.e(VoiceDbUtil.class.toString(),"读取文件或编码失败: " + e.getMessage());
            return "null"; // 返回 null 表示失败
        }
    }

    // 生成数据库存储的语音格式
    public static String makeVoiceDbContent(VoiceDbItem item) {
        return item.duration + "," + item.voicePath;
    }

    // 从数据库记录的数据里解码出实际路径, 格式: 时长,路径
    public static VoiceDbItem extractDbVoiceContent(String dbContent) {
        VoiceDbItem vi = new VoiceDbItem();
        // 安全地分割字符串，检查数组长度
        String[] parts = dbContent.split(",");
        if (parts.length >= 2) {
            vi.duration = Integer.valueOf(parts[0]);
            vi.voicePath = parts[1];
        } else {
            Log.e("VoiceUtils", "数据库内容格式错误（缺少逗号分隔符）：" + dbContent);
            // 设置默认值，避免返回null导致后续错误
            vi.duration = 0;
            vi.voicePath = "";
        }

        return  vi;
    }

    // 直接返回秒数，失败返回 -1
    public static long getDuration(String filePath) {
        return getDuration(filePath, null);
    }
    
    // 直接返回秒数，失败返回 0，支持日志收集
    public static long getDuration(String filePath, VoiceDebugLogs debugLogs) {
        if (debugLogs != null) {
            debugLogs.addLog("[getDuration] 开始获取音频时长: " + filePath);
        }
        
        // 首先检查文件是否存在
        File file = new File(filePath);
        boolean fileExists = file.exists();
        long fileSize = fileExists ? file.length() : 0;
        
        if (debugLogs != null) {
            debugLogs.addLog("[getDuration] 文件检查 - 存在: " + fileExists + ", 大小: " + fileSize + " 字节");
        }
        
        if (!fileExists) {
            if (debugLogs != null) {
                debugLogs.addLog("[getDuration] ❌ 文件不存在，无法获取时长");
            }
            return 0;
        }
        
        if (fileSize == 0) {
            if (debugLogs != null) {
                debugLogs.addLog("[getDuration] ⚠️ 文件大小为0，可能文件已损坏");
            }
        }

        try (MediaMetadataRetriever retriever = new MediaMetadataRetriever()){
            retriever.setDataSource(filePath);
            String durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            long durationSeconds = durationMs != null ? Long.parseLong(durationMs) / 1000 : 0;
            
            if (debugLogs != null) {
                debugLogs.addLog("[getDuration] MediaMetadataRetriever提取时长 - 原始值(ms): " + durationMs + ", 转换后(秒): " + durationSeconds);
            }
            
            return durationSeconds;
        } catch (Exception e) {
            String errorMsg = "获取音频时长失败: " + e.getMessage();
            if (debugLogs != null) {
                debugLogs.addLog("[getDuration] ❌ " + errorMsg);
                debugLogs.addLog("[getDuration] 异常类型: " + e.getClass().getName());
            }
            Log.e("VoiceUtils", errorMsg, e);
            return 0;
        }
    }
}
