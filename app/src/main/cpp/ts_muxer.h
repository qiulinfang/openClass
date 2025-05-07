// ============================================================================
// Created by dingtao.
//
// This code and information is provided ”as is” without warranty of any kind,
// either expressed or implied, including but not limited to the implied
// warranties of merchantability and/or fitness for any particular purpose.
// 
// Copyright (c) 2021, All rights reserved.
// ============================================================================

#ifndef GFXTV_TSMUXER_H
#define GFXTV_TSMUXER_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

int ts_muxter_init(const char *dstAddress, int dstPort);
void ts_muxer_set_dst(const char* dstIp, int dstPort);
uint64_t ts_muxer_us_to_90k(uint64_t microsecond_timestamp);
void ts_muxer_add_h264(const uint8_t* h264_frame, uint32_t h264_len, uint64_t pts, int is_key_frame);
void ts_muxer_add_aac(const uint8_t *aac_frame, uint32_t aac_len, uint64_t pts);
void ts_muxer_send_stream();
void ts_muxter_uninit();

#ifdef __cplusplus
}
#endif

#endif //GFXTV_TSMUXER_H
