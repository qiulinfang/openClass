package com.cosinetech.imates.textbookservice;

public class LocalFileInfo {
    public  String id;
    public String fileName;
    public String localPath;
    public String originalUrl;
    public String checksum;
    public boolean isDownloaded;
    public long fileSize;
    public String downloadTime;
    
    public LocalFileInfo() {
        this.isDownloaded = false;
        this.fileSize = 0;
    }
}
