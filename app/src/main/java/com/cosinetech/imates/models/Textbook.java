package com.cosinetech.imates.models;

import android.annotation.SuppressLint;

import com.google.gson.annotations.SerializedName;

public class Textbook {
    private String title;

    @SerializedName("downloadUrl")
    private String downloadUrl;

    @SerializedName("cover")
    private String coverUrl;

    @SerializedName("learningPath")
    private String learningPath;

    @SerializedName("fileSize")
    private long fileSize;

    private String checksum;

    // Download status
    private DownloadStatus downloadStatus = DownloadStatus.NOT_DOWNLOADED;
    private int downloadProgress = 0;
    private String localFilePath;

    public enum DownloadStatus {
        NOT_DOWNLOADED,
        DOWNLOADING,
        DOWNLOADED,
        PARTIAL,
        UPDATE_AVAILABLE,
        DOWNLOAD_FAILED
    }

    // Constructors
    public Textbook() {}

    public Textbook(String title, String downloadUrl, String coverUrl, long fileSize) {
        this.title = title;
        this.downloadUrl = downloadUrl;
        this.coverUrl = coverUrl;
        this.fileSize = fileSize;
    }

    // Getters and Setters
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDownloadUrl() { return downloadUrl; }
    public void setDownloadUrl(String downloadUrl) { this.downloadUrl = downloadUrl; }

    public String getCoverUrl() { return coverUrl; }
    public void setCoverUrl(String coverUrl) { this.coverUrl = coverUrl; }

    public String getLearningPath() { return learningPath; }
    public void setLearningPath(String learningPath) { this.learningPath = learningPath; }

    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }

    public String getChecksum() { return checksum; }
    public void setChecksum(String checksum) { this.checksum = checksum; }

    public DownloadStatus getDownloadStatus() { return downloadStatus; }
    public void setDownloadStatus(DownloadStatus downloadStatus) { this.downloadStatus = downloadStatus; }

    public int getDownloadProgress() { return downloadProgress; }
    public void setDownloadProgress(int downloadProgress) { this.downloadProgress = downloadProgress; }

    public String getLocalFilePath() { return localFilePath; }
    public void setLocalFilePath(String localFilePath) { this.localFilePath = localFilePath; }

    @SuppressLint("DefaultLocale")
    public String getFormattedFileSize() {
        if (fileSize <= 0) return "0 B";

        String[] units = {"B", "KB", "MB", "GB"};
        int digitGroups = (int) (Math.log10(fileSize) / Math.log10(1024));

        return String.format("%.1f %s",
                fileSize / Math.pow(1024, digitGroups),
                units[digitGroups]);
    }
}
