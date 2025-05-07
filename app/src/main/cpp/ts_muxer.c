// ============================================================================
// Created by dingtao.
//
// This code and information is provided ”as is” without warranty of any kind,
// either expressed or implied, including but not limited to the implied
// warranties of merchantability and/or fitness for any particular purpose.
// 
// Copyright (c) 2021, All rights reserved.
// ============================================================================

#include "ts_muxer.h"
#include "litets.h"
#include <string.h>
#include <stdio.h>
#include <unistd.h>
#include <sys/time.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <linux/in.h>
#include <jni.h>

static uint8_t ts_buffer[1024 * 1024];
static int ts_stream_len = 0;
static int  sock_fd = -1;
static struct sockaddr_in dst_ep;
static lt_ts_program programInfo;
static int sendEnable = 0;

// 定义90kHz时钟频率
#define CLOCK_RATE 90000u

// 转换微秒级别的时间戳为90kHz时钟频率的时间戳
uint64_t ts_muxer_us_to_90k(uint64_t microsecond_timestamp) {
    return (microsecond_timestamp * CLOCK_RATE) / 1000000u;
}

void ts_muxer_send_stream() {
#define PACK_SIZE 1316
    int pkt_cnt = ts_stream_len / PACK_SIZE;
    if(pkt_cnt <= 0) {
        return;
    }

    if(sendEnable) {
        for (int i = 0; i < pkt_cnt; i++) {
            sendto(sock_fd, ts_buffer + i * PACK_SIZE, PACK_SIZE, 0, (struct sockaddr *) &dst_ep,
                   sizeof dst_ep);
        }
    }

    int rest = ts_stream_len % PACK_SIZE;
    memcpy(ts_buffer, ts_buffer + pkt_cnt * PACK_SIZE, rest);
    ts_stream_len = rest;
}

void ts_muxer_add_h264(const uint8_t* h264_frame, uint32_t h264_len, uint64_t pts, int is_key_frame) {
    lt_es_frame es = {0};
    es.program_number = 0;
    es.stream_number = 0;
    es.frame = h264_frame;
    es.length = h264_len;
    es.is_key = is_key_frame;					// 这里简单处理，认为信息帧（非数据帧）为关键帧。
    es.pts = pts;
    es.ps_pes_length = MAX_PES_LENGTH;

    int tsLen = lts_ts_stream(&es, ts_buffer + ts_stream_len, sizeof ts_buffer - ts_stream_len, &programInfo);
    ts_stream_len += tsLen;
}

void ts_muxer_add_aac(const uint8_t *aac_frame, uint32_t aac_len, uint64_t pts) {
    lt_es_frame es = {0};
    es.program_number = 0;
    es.stream_number = 1;
    es.frame = aac_frame;
    es.length = aac_len;
    es.is_key = 0;
    es.pts = pts;
    es.ps_pes_length = MAX_PES_LENGTH;

    int tsLen = lts_ts_stream(&es, ts_buffer + ts_stream_len, sizeof ts_buffer - ts_stream_len, &programInfo);
    ts_stream_len += tsLen;
}

static int init_net_socket(const char* dstIp, int dstPort) {
    if(sock_fd > 0) {
        close(sock_fd);
        sock_fd = -1;
    }

    sock_fd = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if(sock_fd == -1) {
        return -1;
    }

    dst_ep.sin_family = AF_INET;
    dst_ep.sin_port = htons(dstPort);
    dst_ep.sin_addr.s_addr = inet_addr(dstIp);
    return 0;
}

void ts_muxer_set_dst(const char* dstIp, int dstPort) {
    dst_ep.sin_family = AF_INET;
    dst_ep.sin_port = htons(dstPort);
    dst_ep.sin_addr.s_addr = inet_addr(dstIp);
}

void ts_muxer_set_send_enable(int enable) {
    sendEnable = enable;
}


int ts_muxter_init(const char *dst_doman, int port) {
    if(init_net_socket(dst_doman, port) != 0) {
        return -1;
    }

    memset(&programInfo, 0, sizeof(programInfo));
    programInfo.program_num = 1;
    programInfo.prog[0].stream_num = 2;
    programInfo.prog[0].stream[0].type = STREAM_TYPE_VIDEO_H264;
    programInfo.prog[0].stream[1].type = STREAM_TYPE_AUDIO_AAC;
    return 0;
}

void ts_muxter_uninit() {
    if(sock_fd != -1) {
        close(sock_fd);
        sock_fd = -1;
    }
}