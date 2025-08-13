package com.cosinetech.imates.textbookservice;

import java.util.List;

public class UserTextbookInfo {
    public String textbookId;
    public String textbookName;
    public String textbookSubjectLabel;
    public String textbookGradeLabel;
    public String textbookSemesterLabel;
    public String textbookUpdateTime;
    public String lastDownloadTime;
    public boolean isDownloaded;
    public long totalSize;
    public int totalFiles;
    public int downloadedFiles;
    
    public String textbookCover;
    public String textbookPublisher;
    public String textbookEditionYear;
    public String textbookIsbn;
    
    public UserTextbookInfo() {}
    
    public UserTextbookInfo(TextbookVersion textbook) {
        this.textbookId = textbook.id;
        this.textbookName = textbook.textbookName;
        this.textbookSubjectLabel = textbook.textbookSubjectLabel;
        this.textbookGradeLabel = textbook.textbookGradeLabel;
        this.textbookSemesterLabel = textbook.textbookSemesterLabel;
        this.textbookUpdateTime = textbook.textbookUpdateTime;
        this.textbookCover = textbook.textbookCover;
        this.textbookPublisher = textbook.textbookPublisher;
        this.textbookEditionYear = textbook.textbookEditionYear;
        this.textbookIsbn = textbook.textbookIsbn;
        
        this.isDownloaded = false;
        this.totalSize = 0;
        this.totalFiles = 0;
        this.downloadedFiles = 0;
    }
    
    public enum DownloadStatus {
        NOT_DOWNLOADED,
        PARTIALLY_DOWNLOADED,
        FULLY_DOWNLOADED,
        UPDATE_AVAILABLE
    }

    public DownloadStatus getDownloadStatus() {
        if (!isDownloaded && downloadedFiles == 0) {
            return DownloadStatus.NOT_DOWNLOADED;
        } else if (isDownloaded && downloadedFiles == totalFiles) {
            return DownloadStatus.FULLY_DOWNLOADED;
        } else if (downloadedFiles > 0 && downloadedFiles < totalFiles) {
            return DownloadStatus.PARTIALLY_DOWNLOADED;
        } else {
            return DownloadStatus.NOT_DOWNLOADED;
        }
    }

    public int getDownloadProgress() {
        if (totalFiles == 0) return 0;
        return (downloadedFiles * 100) / totalFiles;
    }

    public String getFormattedSize() {
        if (totalSize < 1024) return totalSize + " B";
        if (totalSize < 1024 * 1024) return String.format("%.1f KB", totalSize / 1024.0);
        return String.format("%.1f MB", totalSize / (1024.0 * 1024.0));
    }
}
