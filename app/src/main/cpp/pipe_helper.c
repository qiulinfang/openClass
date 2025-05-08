#include <jni.h>
#include <unistd.h>
#include <fcntl.h>
#include <stddef.h>
#include <errno.h>
#include <string.h>
#include <stdio.h>
#include <android/log.h>

#define TAG "PipeHelper"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

JNIEXPORT jintArray JNICALL
Java_com_cosinetech_imates_screencasting_PipeHelper_createPipe(JNIEnv *env, jclass clazz) {
    int pipefd[2];

    // 创建管道
    if (pipe(pipefd) == -1) {
        LOGE("Failed to create pipe: %s", strerror(errno));
        return NULL;
    }

    // 设置非阻塞模式
    fcntl(pipefd[0], F_SETFL, O_NONBLOCK);
    fcntl(pipefd[1], F_SETFL, O_NONBLOCK);

    int32_t pipeSize = 1024 * 1024 * 10;
    fcntl(pipefd[0], F_SETPIPE_SZ, pipeSize);
    fcntl(pipefd[1], F_SETPIPE_SZ, pipeSize);

    // 创建返回数组
    jintArray result = (*env)->NewIntArray(env, 2);
    if (result == NULL) {
        close(pipefd[0]);
        close(pipefd[1]);
        return NULL;
    }

    // 填充数组
    jint fds[2] = {pipefd[0], pipefd[1]};
    (*env)->SetIntArrayRegion(env, result, 0, 2, fds);

    LOGI("Created pipe: read_fd=%d, write_fd=%d", pipefd[0], pipefd[1]);
    return result;
}

JNIEXPORT void JNICALL
Java_com_cosinetech_imates_screencasting_PipeHelper_closeFd(JNIEnv *env, jclass clazz, jint fd) {
    if (fd >= 0) {
        close(fd);
        LOGI("Closed fd: %d", fd);
    }
}

JNIEXPORT jint JNICALL
Java_com_cosinetech_imates_screencasting_PipeHelper_write(JNIEnv *env, jclass clazz, jint fd,
                                            jbyteArray data, jint offset, jint length) {
    if (fd < 0 || data == NULL) {
        return -1;
    }

    // 获取Java字节数组
    jbyte *buffer = (*env)->GetByteArrayElements(env, data, NULL);
    if (buffer == NULL) {
        return -1;
    }

    // 写入数据
    ssize_t bytesWritten = write(fd, buffer + offset, length);

    // 释放Java字节数组
    (*env)->ReleaseByteArrayElements(env, data, buffer, JNI_ABORT);

    return (jint)bytesWritten;
}

JNIEXPORT jstring JNICALL
Java_com_cosinetech_imates_screencasting_PipeHelper_getFdPath(JNIEnv *env, jclass clazz, jint fd) {
    char path[32];
    snprintf(path, sizeof(path), "pipe:%d", fd);
    return (*env)->NewStringUTF(env, path);
}