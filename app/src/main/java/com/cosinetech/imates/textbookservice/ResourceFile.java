package com.cosinetech.imates.textbookservice;

public class ResourceFile {
    public String id;
    public String packageId;
    public String fileName;
    public String fileUrl;
    public String checksum;
    public long size;
    public String mimeType;
    public String directoryId;
    public String uploadTime;
    public int previewCount;
    public int downloadCount;

    public void eliminateNull() {
        if (id == null) id = "";
        if (packageId == null) packageId = "";
        if (fileName == null) fileName = "";
        if (fileUrl == null) fileUrl = "";
        if (checksum == null) checksum = "";
        if (mimeType == null) mimeType = "application/octet-stream";
        if (directoryId == null) directoryId = "";
        if (uploadTime == null) uploadTime = "";

        // 基本数据类型已经有默认值，不需要处理
        // size: 0 (long 默认值)
        // previewCount: 0 (int 默认值)
        // downloadCount: 0 (int 默认值)
    }
}
