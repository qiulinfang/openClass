package com.cosinetech.imates.textbookservice;

import java.util.ArrayList;
import java.util.List;

public class LocalPackageInfo {
    public String packageId;
    public String packageName;

    public String description;
    public String sectionId;
    public String updateTime;
    public List<LocalFileInfo> localFiles;
    public int totalFiles;
    public int downloadedFiles;
    public boolean isFullyDownloaded;
    
    public LocalPackageInfo() {
        this.localFiles = new ArrayList<>();
    }
    
    public void updateDownloadStatus() {
        this.totalFiles = localFiles.size();
        this.downloadedFiles = 0;
        
        for (LocalFileInfo file : localFiles) {
            if (file.isDownloaded) {
                this.downloadedFiles++;
            }
        }
        
        this.isFullyDownloaded = (this.downloadedFiles == this.totalFiles && this.totalFiles > 0);
    }
    
    public LocalFileInfo findLocalFile(String fileName) {
        for (LocalFileInfo file : localFiles) {
            if (file.fileName.equals(fileName)) {
                return file;
            }
        }
        return null;
    }
}
