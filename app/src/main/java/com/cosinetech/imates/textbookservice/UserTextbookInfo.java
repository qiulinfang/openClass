package com.cosinetech.imates.textbookservice;

import java.util.ArrayList;
import java.util.List;

public class UserTextbookInfo {
    public enum TEXTBOOK_SUBJECT {
        MATH(2),
        BIOLOGY(6),
        ;

        TEXTBOOK_SUBJECT(int i) {
            value = i;
        }

        private final int value;

        public static TEXTBOOK_SUBJECT fromValue(int value) {
            for (TEXTBOOK_SUBJECT subject : values()) {
                if (subject.getValue() == value) {
                    return subject;
                }
            }
            return null;
        }

        public int getValue() {
            return value;
        }
    }

    public String id;
    public String textbookId;
    public int textbookGrade;
    public String textbookGradeLabel;
    public int textbookSemester;
    public String textbookSemesterLabel;
    public int textbookSubject;
    public String textbookSubjectLabel;
    public String textbookName;
    public String textbookEditionYear;
    public String textbookIsbn;
    public String textbookPublisher;
    public String textbookCover;
    public String textbookUpdateTime;


    public String newlyUpdateTime;
    public String lastDownloadTime;
    public boolean isDownloaded;
    public long totalSize;
    public int totalFiles;
    public int downloadedFiles;
    
    public List<ChapterNode> structure;
    public List<LocalPackageInfo> localPackages;
    public int downloadStatus; // Progress percentage 0-100
    public boolean hasUpdatesAvailable;

    public boolean downloadBeginning;
    
    public UserTextbookInfo() {
        this.structure = new ArrayList<>();
        this.localPackages = new ArrayList<>();
        this.downloadStatus = 0;
        this.hasUpdatesAvailable = false;
        this.downloadBeginning = false;
    }
    
    public UserTextbookInfo(TextbookVersion textbook) {
        this.id = textbook.id;
        this.textbookId = textbook.textbookId;
        this.textbookName = textbook.textbookName;
        this.textbookGrade = textbook.textbookGrade;
        this.textbookGradeLabel = textbook.textbookGradeLabel;
        this.textbookSubject = textbook.textbookSubject;
        this.textbookSubjectLabel = textbook.textbookSubjectLabel;
        this.textbookSemester = textbook.textbookSemester;
        this.textbookSemesterLabel = textbook.textbookSemesterLabel;
        this.textbookUpdateTime = textbook.textbookUpdateTime;
        this.textbookCover = textbook.textbookCover;
        this.textbookPublisher = textbook.textbookPublisher;
        this.textbookEditionYear = textbook.textbookEditionYear;
        this.textbookIsbn = textbook.textbookIsbn;
        this.newlyUpdateTime = textbook.textbookUpdateTime;
        this.isDownloaded = false;
        this.totalSize = 0;
        this.totalFiles = 0;
        this.downloadedFiles = 0;
        this.structure = new ArrayList<>();
        this.localPackages = new ArrayList<>();
        this.downloadStatus = 0;
        this.hasUpdatesAvailable = false;
        this.downloadBeginning = false;
    }
    
    public void updateStructure(List<ChapterNode> newStructure) {
        this.structure = newStructure != null ? new ArrayList<>(newStructure) : new ArrayList<>();
    }
    
    public void updatePackages(List<LearningPackage> packages) {
        this.localPackages = new ArrayList<>();
        if (packages != null) {
            for (LearningPackage pkg : packages) {
                LocalPackageInfo localPkg = new LocalPackageInfo();
                localPkg.packageId = pkg.id;
                localPkg.updateTime = pkg.updateTime;
                localPkg.description = pkg.description;
                localPkg.packageName = pkg.packageName;
                localPkg.sectionId = pkg.sectionId;
                localPkg.localFiles = new ArrayList<>();
                
                if (pkg.resourceList != null) {
                    for (ResourceFile resource : pkg.resourceList) {
                        LocalFileInfo localFile = new LocalFileInfo();
                        localFile.id = resource.id;
                        localFile.fileName = getLocalResourceFileName(resource);
                        localFile.displayName = resource.fileName;
                        localFile.originalUrl = resource.fileUrl;
                        localFile.checksum = resource.checksum;
                        localFile.isDownloaded = false;
                        localPkg.localFiles.add(localFile);
                    }
                }
                
                localPkg.updateDownloadStatus();
                this.localPackages.add(localPkg);
            }
        }
    }

    public static String getLocalResourceFileName(ResourceFile resource) {
        String fileName = resource.fileName;
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex == -1) {
            // 没有扩展名的情况
            return fileName + "_" + resource.checksum;
        } else {
            String name = fileName.substring(0, dotIndex);
            String ext = fileName.substring(dotIndex); // 包含点
            return name + "_" + resource.checksum + ext;
        }
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
            if (hasUpdatesAvailable) {
                return DownloadStatus.UPDATE_AVAILABLE;
            }
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
