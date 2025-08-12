package com.cosinetech.imates.coreapiservice;

import android.content.Context;

import com.cosinetech.imates.models.Textbook;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class TextbookDownloadManager {
    private static TextbookDownloadManager instance;
    private final Context context;
    private final ExecutorService executorService;
    private final ConcurrentHashMap<String, DownloadTask> activeDownloads;
    private final OkHttpClient httpClient;

    public interface DownloadListener {
        void onDownloadStart(Textbook textbook);
        void onDownloadProgress(Textbook textbook, int progress);
        void onDownloadComplete(Textbook textbook, String filePath);
        void onDownloadError(Textbook textbook, String error);
    }

    private TextbookDownloadManager(Context context) {
        this.context = context.getApplicationContext();
        this.executorService = Executors.newFixedThreadPool(3); // Max 3 concurrent downloads
        this.activeDownloads = new ConcurrentHashMap<>();
        this.httpClient = new OkHttpClient.Builder().build();
    }

    public static synchronized TextbookDownloadManager getInstance(Context context) {
        if (instance == null) {
            instance = new TextbookDownloadManager(context);
        }
        return instance;
    }

    public void downloadTextbook(Textbook textbook, DownloadListener listener) {
        String downloadId = generateDownloadId(textbook);

        if (activeDownloads.containsKey(downloadId)) {
            return; // Already downloading
        }

        DownloadTask task = new DownloadTask(textbook, listener);
        activeDownloads.put(downloadId, task);
        executorService.execute(task);
    }

    public void cancelDownload(Textbook textbook) {
        String downloadId = generateDownloadId(textbook);
        DownloadTask task = activeDownloads.get(downloadId);
        if (task != null) {
            task.cancel();
            activeDownloads.remove(downloadId);
        }
    }

    private String generateDownloadId(Textbook textbook) {
        return textbook.getTitle() + "_" + textbook.getDownloadUrl().hashCode();
    }

    private class DownloadTask implements Runnable {
        private Textbook textbook;
        private DownloadListener listener;
        private volatile boolean cancelled = false;

        public DownloadTask(Textbook textbook, DownloadListener listener) {
            this.textbook = textbook;
            this.listener = listener;
        }

        public void cancel() {
            cancelled = true;
        }

        @Override
        public void run() {
            try {
                if (cancelled) return;

                // Notify download start
                if (listener != null) {
                    listener.onDownloadStart(textbook);
                }

                // Create download directory
                File downloadDir = new File(context.getExternalFilesDir(null), "textbooks");
                if (!downloadDir.exists()) {
                    downloadDir.mkdirs();
                }

                // Generate file name
                String fileName = textbook.getTitle().replaceAll("[^a-zA-Z0-9\u4e00-\u9fa5]", "_") + ".tar";
                File outputFile = new File(downloadDir, fileName);

                // Download file
                Request request = new Request.Builder()
                        .url(textbook.getDownloadUrl())
                        .build();

                Response response = httpClient.newCall(request).execute();
                if (!response.isSuccessful()) {
                    throw new IOException("Download failed: " + response.code());
                }

                InputStream inputStream = response.body().byteStream();
                FileOutputStream outputStream = new FileOutputStream(outputFile);

                byte[] buffer = new byte[8192];
                long totalBytes = response.body().contentLength();
                long downloadedBytes = 0;
                int bytesRead;

                while ((bytesRead = inputStream.read(buffer)) != -1 && !cancelled) {
                    outputStream.write(buffer, 0, bytesRead);
                    downloadedBytes += bytesRead;

                    // Update progress
                    if (totalBytes > 0 && listener != null) {
                        int progress = (int) ((downloadedBytes * 100) / totalBytes);
                        listener.onDownloadProgress(textbook, progress);
                    }
                }

                inputStream.close();
                outputStream.close();

                if (cancelled) {
                    outputFile.delete();
                    return;
                }

                // Download completed
                textbook.setLocalFilePath(outputFile.getAbsolutePath());
                textbook.setDownloadStatus(Textbook.DownloadStatus.DOWNLOADED);

                if (listener != null) {
                    listener.onDownloadComplete(textbook, outputFile.getAbsolutePath());
                }

            } catch (Exception e) {
                if (listener != null) {
                    listener.onDownloadError(textbook, e.getMessage());
                }
            } finally {
                activeDownloads.remove(generateDownloadId(textbook));
            }
        }
    }
}
