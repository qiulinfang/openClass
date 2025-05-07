#include <jni.h>
#include <string.h>
#include "ts_muxer.h"

JNIEXPORT jint JNICALL
Java_com_cosinetech_imates_screencasting_TSMuxer_init(JNIEnv *env, jclass clazz, jstring dst_address, jint dst_port) {
    const char *address = (*env)->GetStringUTFChars(env, dst_address, NULL);
    int result = ts_muxter_init(address, dst_port);
    (*env)->ReleaseStringUTFChars(env, dst_address, address);
    return result;
}

JNIEXPORT void JNICALL
Java_com_cosinetech_imates_screencasting_TSMuxer_setDestination(JNIEnv *env, jclass clazz, jstring dst_ip, jint dst_port) {
    const char *ip = (*env)->GetStringUTFChars(env, dst_ip, NULL);
    ts_muxer_set_dst(ip, dst_port);
    (*env)->ReleaseStringUTFChars(env, dst_ip, ip);
}

JNIEXPORT jlong JNICALL
Java_com_cosinetech_imates_screencasting_TSMuxer_usTo90k(JNIEnv *env, jclass clazz, jlong microsecond_timestamp) {
    return (jlong)ts_muxer_us_to_90k((uint64_t)microsecond_timestamp);
}

JNIEXPORT void JNICALL
Java_com_cosinetech_imates_screencasting_TSMuxer_addH264(JNIEnv *env, jclass clazz, jbyteArray h264_frame, jlong pts, jboolean is_key_frame) {
    jbyte *frame_data = (*env)->GetByteArrayElements(env, h264_frame, NULL);
    jsize frame_length = (*env)->GetArrayLength(env, h264_frame);

    ts_muxer_add_h264((uint8_t*)frame_data,
                      (uint32_t)frame_length,
                      (uint64_t)pts,
                      is_key_frame == JNI_TRUE);

    (*env)->ReleaseByteArrayElements(env, h264_frame, frame_data, JNI_ABORT);
}

JNIEXPORT void JNICALL
Java_com_cosinetech_imates_screencasting_TSMuxer_addAAC(JNIEnv *env, jclass clazz, jbyteArray aac_frame, jlong pts) {
    jbyte *frame_data = (*env)->GetByteArrayElements(env, aac_frame, NULL);
    jsize frame_length = (*env)->GetArrayLength(env, aac_frame);

    ts_muxer_add_aac((uint8_t*)frame_data,
                     (uint32_t)frame_length,
                     (uint64_t)pts);

    (*env)->ReleaseByteArrayElements(env, aac_frame, frame_data, JNI_ABORT);
}

JNIEXPORT void JNICALL
Java_com_cosinetech_imates_screencasting_TSMuxer_sendStream(JNIEnv *env, jclass clazz) {
    ts_muxer_send_stream();
}

JNIEXPORT void JNICALL
Java_com_cosinetech_imates_screencasting_TSMuxer_uninit(JNIEnv *env, jclass clazz) {
    ts_muxter_uninit();
}