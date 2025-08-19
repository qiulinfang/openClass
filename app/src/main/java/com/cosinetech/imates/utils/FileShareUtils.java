package com.cosinetech.imates.utils;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
import androidx.core.content.FileProvider;

import com.cosinetech.imates.ui.activities.ImageViewerActivity;
import com.cosinetech.imates.ui.activities.VideoPlayActivity;
import com.cosinetech.imates.ui.mupdfviewer.activity.MuPDFActivity;

import java.io.File;

public class FileShareUtils {
    /**
     * 共享文件给其他应用（如Office）
     * @param context 上下文
     * @param relativePath 相对于getExternalFilesDir的子目录路径（如"Documents/Reports"）
     * @param fileName 文件名（如"report.docx"）
     * @param sectionName 章节名
     * @param serializedLocalPackages 序列化后的LocalLearnPackage
     */
    public static void shareOpenFile(Context context, String relativePath, String fileName, String sectionName, String serializedLocalPackages) {
        File parentDir = context.getExternalFilesDir(relativePath);
        File file = new File(parentDir, fileName);
        shareOpenFile(context, file.getAbsolutePath(), sectionName, serializedLocalPackages);
    }

    public static void shareOpenFile(Context context, String filePath, String sectionName, String serializedLocalPackages) {
        // 1. 构建文件对象
        File file = new File(filePath);

        // 2. 检查文件是否存在
        if (!file.exists()) {
            Toast.makeText(context, "文件不存在: " + file.getPath(), Toast.LENGTH_SHORT).show();
            return;
        }

        // 3. 获取MIME类型
        String mimeType = getMimeType(file.getName());

        if(mimeType.contains("pdf")) {
            Intent intent = new Intent(context, MuPDFActivity.class);
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.fromFile(file));
            intent.putExtra(MuPDFActivity.KEY_SECTION_NAME, sectionName);
            context.startActivity(intent);
        } else if(mimeType.contains("audio")
            || mimeType.contains("video")) {
            Intent intent = new Intent(context, VideoPlayActivity.class);
            intent.putExtra(VideoPlayActivity.KEY_VIDEO_START_PLAY_POS_MS, 0);
            intent.putExtra(VideoPlayActivity.KEY_VIDEO_PATH, filePath);
            intent.putExtra(VideoPlayActivity.KEY_TEXTBOOK_SECTION, sectionName);
            context.startActivity(intent);
        } else if(mimeType.contains("image")) {
            Intent intent = new Intent(context, ImageViewerActivity.class);
            intent.putExtra("image_path", filePath);
            context.startActivity(intent);
        }
        else {
            // 4. 获取文件URI
            Uri uri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    file
            );

            // 5. 创建Intent
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // 6. 启动Activity（带选择器）
            Intent chooser = Intent.createChooser(intent, "用Office应用打开");
            try {
                context.startActivity(chooser);
            } catch (Exception e) {
                Toast.makeText(context, "无法打开文件: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        }
    }
    /**
     * 根据文件名获取MIME类型
     */
    private static String getMimeType(String fileName) {
        String extension = fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
        return switch (extension) {
            // 文档类型
            case "pdf" -> "application/pdf";

            case "doc", "dot" -> "application/msword";
            case "docx" ->
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xls", "xlt", "xlm" -> "application/vnd.ms-excel";
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "ppt", "pot", "pps" -> "application/vnd.ms-powerpoint";
            case "pptx" ->
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case "txt" -> "text/plain";
//            case "rtf" -> "application/rtf";
//            case "csv" -> "text/csv";
//            case "html", "htm" -> "text/html";
//            case "xml" -> "text/xml";
//            case "json" -> "application/json";

            // 图片类型
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "bmp" -> "image/bmp";
            case "webp" -> "image/webp";
            case "svg" -> "image/svg+xml";
            case "ico" -> "image/x-icon";
            case "tif", "tiff" -> "image/tiff";

            // 音频类型
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "ogg" -> "audio/ogg";
            case "mid", "midi" -> "audio/midi";
            case "aac" -> "audio/aac";
            case "flac" -> "audio/flac";
            case "m4a" -> "audio/mp4";

            // 视频类型
            case "mp4" -> "video/mp4";
            case "webm" -> "video/webm";
            case "avi" -> "video/x-msvideo";
            case "mov" -> "video/quicktime";
            case "wmv" -> "video/x-ms-wmv";
            case "flv" -> "video/x-flv";
            case "mkv" -> "video/x-matroska";
            case "3gp" -> "video/3gpp";

            // 压缩包类型
//            case "zip" -> "application/zip";
//            case "rar" -> "application/x-rar-compressed";
//            case "7z" -> "application/x-7z-compressed";
//            case "tar" -> "application/x-tar";
//            case "gz" -> "application/gzip";

            // 其他常见类型
//            case "apk" -> "application/vnd.android.package-archive";
//            case "exe" -> "application/x-msdownload";
//            case "dmg" -> "application/x-apple-diskimage";
//            case "psd" -> "image/vnd.adobe.photoshop";
//            case "ai" -> "application/postscript";
//            case "eps" -> "application/postscript";
//            case "ps" -> "application/postscript";
            default -> "*/*"; // 默认通用类型
        };
    }
}
