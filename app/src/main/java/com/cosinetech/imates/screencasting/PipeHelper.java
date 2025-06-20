package com.cosinetech.imates.screencasting;

public class PipeHelper {
    static {
        System.loadLibrary("pipehelper");
    }

    /**
     * 创建一个管道并返回文件描述符
     * @return 包含两个文件描述符的数组，[0]是读端，[1]是写端
     */
    public static native int[] createPipe();

    /**
     * 关闭文件描述符
     * @param fd 要关闭的文件描述符
     */
    public static native void closeFd(int fd);

    /**
     * 将数据写入文件描述符
     * @param fd 文件描述符
     * @param data 要写入的数据
     * @param offset 数据的起始偏移量
     * @param length 要写入的数据长度
     * @return 实际写入的字节数，-1表示错误
     */
    public static native int write(int fd, byte[] data, int offset, int length);

    /**
     * 获取文件描述符的路径
     * @param fd 文件描述符
     * @return 文件描述符的路径，格式为"pipe:<fd>"
     */
    public static native String getFdPath(int fd);
}