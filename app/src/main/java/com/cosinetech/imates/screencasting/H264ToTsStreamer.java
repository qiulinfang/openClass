package com.cosinetech.imates.screencasting;

import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class H264ToTsStreamer {
    private static final String TAG = "H264ToTsStreamer";
    private static final int TS_PACKET_SIZE = 188;
    private static final int PACKETS_PER_UDP = 7;
    private static final int UDP_PACKET_SIZE = TS_PACKET_SIZE * PACKETS_PER_UDP; // 1316 bytes

    private final String destinationIp;
    private final int destinationPort;
    private DatagramSocket socket;
    private ExecutorService executor;

    // TS packet header constants
    private static final byte SYNC_BYTE = 0x47;
    private static final int VIDEO_PID = 0x100; // Program ID for video
    private static final int PMT_PID = 0x1000;
    private static final int PAT_PID = 0x0;

    // Counters for TS packets
    private byte patContinuityCounter = 0;
    private byte pmtContinuityCounter = 0;
    private byte videoContinuityCounter = 0;

    // PES packet related
    private long pesPacketCounter = 0;
    private long ptsBase = 0;
    private long pcrBase = 0;
    private long lastPcrTime = 0;
    private long lastPts = 0;

    // Buffer for TS packets until we have enough to send
    private ByteArrayOutputStream tsBuffer;

    // PCR frequency (27MHz)
    private static final long PCR_FREQUENCY = 27000000;

    // SPS and PPS storage
    private byte[] sps = null;
    private byte[] pps = null;
    private boolean spsAndPpsFound = false;

    // NAL unit types
    private static final int NAL_TYPE_SPS = 7;
    private static final int NAL_TYPE_PPS = 8;
    private static final int NAL_TYPE_IDR = 5;  // IDR picture (keyframe)

    public H264ToTsStreamer(String destinationIp, int destinationPort) {
        this.destinationIp = destinationIp;
        this.destinationPort = destinationPort;
        this.executor = Executors.newSingleThreadExecutor();
        this.tsBuffer = new ByteArrayOutputStream(UDP_PACKET_SIZE * 2);
    }

    public void start() {
        try {
            socket = new DatagramSocket();
            // Send PAT and PMT tables initially
            sendPATAndPMT();
            Log.d(TAG, "H264ToTsStreamer started");
        } catch (IOException e) {
            Log.e(TAG, "Failed to start streamer", e);
        }
    }

    public void stop() {
        // Send any remaining buffered data
        flushTsBuffer();

        if (socket != null) {
            socket.close();
        }
        executor.shutdown();
        Log.d(TAG, "H264ToTsStreamer stopped");
    }

    // This is the callback method that will receive H.264 data
    public void onH264DataReceived(byte[] h264Data, boolean isKeFrame, long presentationTimeUs) {
        executor.execute(() -> processH264Frame(h264Data, presentationTimeUs));
    }

    private void processH264Frame(byte[] h264Data, long presentationTimeUs) {
        try {
            // If this is the first frame, set the PTS and PCR base
            if (ptsBase == 0) {
                ptsBase = presentationTimeUs;
                pcrBase = presentationTimeUs * 27; // Convert to 27MHz clock
            }

            // Parse NAL units and extract SPS/PPS if present
            List<NalUnit> nalUnits = parseNalUnits(h264Data);

            // Check if this is a keyframe (I-frame)
            boolean isKeyframe = containsKeyframe(nalUnits);

            // Extract SPS and PPS if present
            for (NalUnit nal : nalUnits) {
                if (nal.type == NAL_TYPE_SPS) {
                    sps = nal.data;
                    Log.d(TAG, "SPS found, length: " + sps.length);
                } else if (nal.type == NAL_TYPE_PPS) {
                    pps = nal.data;
                    Log.d(TAG, "PPS found, length: " + pps.length);
                }
            }

            // If we have both SPS and PPS, mark them as found
            if (sps != null && pps != null) {
                spsAndPpsFound = true;
            }

            // If it's a keyframe, send PAT and PMT tables first
            if (isKeyframe) {
                // Flush any buffered data before sending PAT/PMT
                flushTsBuffer();
                sendPATAndPMT();
                Log.d(TAG, "Keyframe detected, sent PAT and PMT");
            }

            // Calculate PTS (Presentation Time Stamp) relative to base
            // Ensure PTS is monotonically increasing
            long pts = Math.max(lastPts + 1, (presentationTimeUs - ptsBase) * 90); // Convert to 90kHz clock
            lastPts = pts;

            // Calculate PCR (Program Clock Reference)
            long pcr = (presentationTimeUs - ptsBase) * 27 + pcrBase; // Convert to 27MHz clock

            // For keyframes, ensure SPS and PPS are sent before the frame data
            byte[] frameData;
            if (isKeyframe && spsAndPpsFound) {
                // Combine SPS, PPS, and frame data for keyframes
                frameData = prependSpsAndPps(h264Data, nalUnits);
            } else {
                frameData = h264Data;
            }

            // Create PES packet
            byte[] pesPacket = createPESPacket(frameData, pts);

            // Split PES packet into TS packets
            packetizePesIntoTs(pesPacket, pts, pcr, presentationTimeUs, isKeyframe);

            pesPacketCounter++;

        } catch (Exception e) {
            Log.e(TAG, "Error processing H264 frame", e);
        }
    }

    /**
     * Packetize PES packet into TS packets
     */
    private void packetizePesIntoTs(byte[] pesPacket, long pts, long pcr, long presentationTimeUs, boolean isKeyframe) throws IOException {
        boolean firstPacket = true;
        int offset = 0;

        while (offset < pesPacket.length) {
            byte[] tsPacket = new byte[TS_PACKET_SIZE];
            tsPacket[0] = SYNC_BYTE; // Sync byte

            // Set payload unit start indicator for first packet
            int headerFlags = firstPacket ? 0x4000 : 0x0000;
            headerFlags |= VIDEO_PID & 0x1FFF; // Add PID

            tsPacket[1] = (byte) ((headerFlags >> 8) & 0xFF);
            tsPacket[2] = (byte) (headerFlags & 0xFF);

            // Determine if we need to include PCR
            boolean includePcr = firstPacket && (isKeyframe || (presentationTimeUs - lastPcrTime >= 40000)); // Add PCR every 40ms or on keyframes

            // Adaptation field control
            int adaptationControl;
            int adaptationLength = 0;

            if (includePcr) {
                // Adaptation field + payload
                adaptationControl = 0x30;
                adaptationLength = 7; // 1 byte flags + 6 bytes PCR
                lastPcrTime = presentationTimeUs;
            } else if (offset + (TS_PACKET_SIZE - 4) >= pesPacket.length) {
                // Last packet might need stuffing - adaptation field + payload
                int remainingBytes = pesPacket.length - offset;
                adaptationLength = TS_PACKET_SIZE - 4 - remainingBytes;
                if (adaptationLength > 0) {
                    adaptationControl = 0x30; // Adaptation field + payload
                } else {
                    adaptationControl = 0x10; // Payload only
                }
            } else {
                // Payload only
                adaptationControl = 0x10;
            }

            // Set adaptation field control and continuity counter
            tsPacket[3] = (byte) (adaptationControl | (videoContinuityCounter & 0x0F));
            videoContinuityCounter = (byte) ((videoContinuityCounter + 1) & 0x0F);

            // Add adaptation field if needed
            int headerSize = 4; // TS header size
            if ((adaptationControl & 0x20) != 0) { // If adaptation field present
                tsPacket[4] = (byte) (adaptationLength - 1); // Adaptation field length

                if (adaptationLength > 1) {
                    // Set adaptation flags
                    byte adaptationFlags = 0;
                    if (includePcr) {
                        adaptationFlags |= 0x10; // PCR flag
                    }
                    tsPacket[5] = adaptationFlags;

                    // Add PCR if needed
                    if (includePcr) {
                        writePCR(tsPacket, 6, pcr);
                    }

                    // Fill remaining adaptation field with stuffing bytes
                    for (int i = 6 + (includePcr ? 6 : 0); i < 4 + adaptationLength; i++) {
                        tsPacket[i] = (byte) 0xFF;
                    }
                }

                headerSize += adaptationLength;
            }

            // Determine payload size
            int payloadSize = Math.min(TS_PACKET_SIZE - headerSize, pesPacket.length - offset);

            // Copy payload data
            System.arraycopy(pesPacket, offset, tsPacket, headerSize, payloadSize);

            // Fill remaining bytes with stuffing (0xFF) if needed
            for (int i = headerSize + payloadSize; i < TS_PACKET_SIZE; i++) {
                tsPacket[i] = (byte) 0xFF;
            }

            // Add to buffer and check if we need to send
            addToTsBufferAndSendIfFull(tsPacket);

            offset += payloadSize;
            firstPacket = false;
        }
    }

    /**
     * Prepends SPS and PPS to the frame data for keyframes
     */
    private byte[] prependSpsAndPps(byte[] originalData, List<NalUnit> nalUnits) {
        // Check if SPS and PPS are already in the frame data
        boolean hasSps = false;
        boolean hasPps = false;

        for (NalUnit nal : nalUnits) {
            if (nal.type == NAL_TYPE_SPS) hasSps = true;
            if (nal.type == NAL_TYPE_PPS) hasPps = true;
        }

        // If both SPS and PPS are already present, return the original data
        if (hasSps && hasPps) {
            return originalData;
        }

        // Create a new buffer with SPS and PPS prepended
        ByteArrayOutputStream newData = new ByteArrayOutputStream();

        try {
            // Add SPS if not already present
            if (!hasSps && sps != null) {
                newData.write(new byte[] {0x00, 0x00, 0x00, 0x01}); // Start code
                newData.write(sps);
            }

            // Add PPS if not already present
            if (!hasPps && pps != null) {
                newData.write(new byte[] {0x00, 0x00, 0x00, 0x01}); // Start code
                newData.write(pps);
            }

            // Add the original data
            newData.write(originalData);

            return newData.toByteArray();
        } catch (IOException e) {
            Log.e(TAG, "Error prepending SPS/PPS", e);
            return originalData; // Return original data on error
        }
    }

    /**
     * Parse H.264 data into individual NAL units
     */
    private List<NalUnit> parseNalUnits(byte[] h264Data) {
        List<NalUnit> nalUnits = new ArrayList<>();

        // Find all NAL units
        int startIndex = 0;

        // Find first NAL unit start code
        while (startIndex < h264Data.length - 3) {
            if ((h264Data[startIndex] == 0x00 && h264Data[startIndex + 1] == 0x00 && h264Data[startIndex + 2] == 0x01) ||
                    (h264Data[startIndex] == 0x00 && h264Data[startIndex + 1] == 0x00 && h264Data[startIndex + 2] == 0x00 && h264Data[startIndex + 3] == 0x01)) {
                break;
            }
            startIndex++;
        }

        while (startIndex < h264Data.length - 3) {
            // Determine start code length (3 or 4 bytes)
            int startCodeLength = (h264Data[startIndex + 2] == 0x01) ? 3 : 4;

            // Find the start of the next NAL unit
            int nextStartIndex = findNextNalUnit(h264Data, startIndex + startCodeLength);
            if (nextStartIndex == -1) {
                nextStartIndex = h264Data.length;
            }

            // Extract NAL unit type
            int nalTypeOffset = startIndex + startCodeLength;
            if (nalTypeOffset < h264Data.length) {
                int nalType = h264Data[nalTypeOffset] & 0x1F;

                // Extract NAL unit data (excluding start code)
                byte[] nalData = Arrays.copyOfRange(h264Data, nalTypeOffset, nextStartIndex);

                // Add to list
                nalUnits.add(new NalUnit(nalType, nalData));
            }

            // Move to next NAL unit
            startIndex = nextStartIndex;
        }

        return nalUnits;
    }

    /**
     * Find the start of the next NAL unit
     */
    private int findNextNalUnit(byte[] data, int startIndex) {
        for (int i = startIndex; i < data.length - 3; i++) {
            // Check for 0x000001 or 0x00000001
            if ((data[i] == 0x00 && data[i + 1] == 0x00 && data[i + 2] == 0x01) ||
                    (data[i] == 0x00 && data[i + 1] == 0x00 && data[i + 2] == 0x00 && data[i + 3] == 0x01)) {
                return i;
            }
        }
        return -1; // Not found
    }

    /**
     * Check if the NAL units contain a keyframe
     */
    private boolean containsKeyframe(List<NalUnit> nalUnits) {
        for (NalUnit nal : nalUnits) {
            if (nal.type == NAL_TYPE_IDR) {
                return true;
            }
        }
        return false;
    }

    /**
     * Writes PCR value to the specified position in the buffer
     */
    private void writePCR(byte[] buffer, int offset, long pcr) {
        // PCR base (33 bits)
        long pcrBase = pcr / 300;
        // PCR extension (9 bits)
        int pcrExt = (int)(pcr % 300);

        buffer[offset] = (byte) ((pcrBase >> 25) & 0xFF);
        buffer[offset + 1] = (byte) ((pcrBase >> 17) & 0xFF);
        buffer[offset + 2] = (byte) ((pcrBase >> 9) & 0xFF);
        buffer[offset + 3] = (byte) ((pcrBase >> 1) & 0xFF);
        buffer[offset + 4] = (byte) (((pcrBase & 0x01) << 7) | 0x7E | ((pcrExt >> 8) & 0x01));
        buffer[offset + 5] = (byte) (pcrExt & 0xFF);
    }

    /**
     * Adds a TS packet to the buffer and sends if the buffer is full
     */
    private void addToTsBufferAndSendIfFull(byte[] tsPacket) throws IOException {
        tsBuffer.write(tsPacket);

        // If we have enough TS packets for a UDP packet, send it
        if (tsBuffer.size() >= UDP_PACKET_SIZE) {
            byte[] data = tsBuffer.toByteArray();
            // Only send complete UDP packets (multiples of UDP_PACKET_SIZE)
            int packetsToSend = data.length / UDP_PACKET_SIZE;
            int bytesToSend = packetsToSend * UDP_PACKET_SIZE;

            if (bytesToSend > 0) {
                sendUdpPacket(data, bytesToSend);

                // Keep any remaining bytes in the buffer
                int remainingBytes = data.length - bytesToSend;
                if (remainingBytes > 0) {
                    byte[] remaining = new byte[remainingBytes];
                    System.arraycopy(data, bytesToSend, remaining, 0, remainingBytes);
                    tsBuffer.reset();
                    tsBuffer.write(remaining);
                } else {
                    tsBuffer.reset();
                }
            }
        }
    }

    /**
     * Flushes any remaining data in the TS buffer
     * This is used when we need to ensure all data is sent, like before PAT/PMT or on stop
     */
    private void flushTsBuffer() {
        try {
            if (tsBuffer.size() > 0) {
                // We don't have a full UDP packet, but we need to send what we have
                byte[] data = tsBuffer.toByteArray();

                // Pad to a multiple of TS_PACKET_SIZE if needed
                if (data.length % TS_PACKET_SIZE != 0) {
                    int paddedSize = ((data.length / TS_PACKET_SIZE) + 1) * TS_PACKET_SIZE;
                    byte[] paddedData = new byte[paddedSize];
                    System.arraycopy(data, 0, paddedData, 0, data.length);
                    // Fill remaining with stuffing
                    for (int i = data.length; i < paddedSize; i++) {
                        paddedData[i] = (byte) 0xFF;
                    }
                    data = paddedData;
                }

                sendUdpPacket(data, data.length);
                tsBuffer.reset();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error flushing TS buffer", e);
        }
    }

    /**
     * Checks if the H.264 data contains a keyframe (I-frame)
     * In H.264, NAL unit type 5 indicates an IDR picture (keyframe)
     */
    private boolean isKeyframe(byte[] h264Data) {
        // Look for NAL units in the data
        for (int i = 0; i < h264Data.length - 4; i++) {
            // Check for NAL unit start code (0x00 0x00 0x00 0x01 or 0x00 0x00 0x01)
            if ((h264Data[i] == 0x00 && h264Data[i + 1] == 0x00 && h264Data[i + 2] == 0x00 && h264Data[i + 3] == 0x01) ||
                    (h264Data[i] == 0x00 && h264Data[i + 1] == 0x00 && h264Data[i + 2] == 0x01)) {

                // Determine the position of the NAL unit type
                int nalTypeOffset = (h264Data[i + 2] == 0x01) ? i + 3 : i + 4;

                // Make sure we're not out of bounds
                if (nalTypeOffset < h264Data.length) {
                    // Extract NAL unit type (5 bits)
                    int nalType = (h264Data[nalTypeOffset] & 0x1F);

                    // NAL unit type 5 is an IDR picture (keyframe)
                    if (nalType == NAL_TYPE_IDR) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private byte[] createPESPacket(byte[] h264Data, long pts) {
        ByteArrayOutputStream pesStream = new ByteArrayOutputStream();

        try {
            // PES packet header (start code)
            pesStream.write(new byte[] {0x00, 0x00, 0x01, (byte) 0xE0});

            // Calculate PES packet length (h264Data + PES header after length field)
            // PES header after length field is 3 bytes of flags + 5 bytes for PTS = 8 bytes
            int pesHeaderDataLength = 8;
            int totalLength = h264Data.length + pesHeaderDataLength;

            // For packets larger than 64KB, set length to 0
            if (totalLength > 0xFFFF) {
                pesStream.write(0x00);
                pesStream.write(0x00);
            } else {
                pesStream.write((totalLength >> 8) & 0xFF);
                pesStream.write(totalLength & 0xFF);
            }

            // PES header flags
            pesStream.write(0x80); // Marker bits + scrambling control + priority
            pesStream.write(0x80); // PTS flag set, DTS flag not set
            pesStream.write(0x05); // PES header data length (5 bytes for PTS)

            // Write PTS (33 bits)
            writePTS(pesStream, 0x20, pts); // 0x20 = '0010' for PTS only

            // Write H.264 data
            pesStream.write(h264Data);

            return pesStream.toByteArray();
        } catch (IOException e) {
            Log.e(TAG, "Error creating PES packet", e);
            return new byte[0];
        }
    }

    private void writePTS(ByteArrayOutputStream out, int firstByte, long pts) throws IOException {
        // PTS is 33 bits, encoded as 5 bytes with markers
        int pts1 = (int) ((pts >> 30) & 0x07); // 3 bits
        int pts2 = (int) ((pts >> 15) & 0x7FFF); // 15 bits
        int pts3 = (int) (pts & 0x7FFF); // 15 bits

        // First byte: 4 bits marker + 3 bits PTS high + 1 bit marker
        out.write(firstByte | pts1 << 1 | 0x01);

        // Second & third bytes: 15 bits PTS middle + 1 bit marker
        out.write((pts2 >> 7) & 0xFF);
        out.write(((pts2 & 0x7F) << 1) | 0x01);

        // Fourth & fifth bytes: 15 bits PTS low + 1 bit marker
        out.write((pts3 >> 7) & 0xFF);
        out.write(((pts3 & 0x7F) << 1) | 0x01);
    }

    private void sendPATAndPMT() {
        try {
            // Create PAT (Program Association Table)
            byte[] patPacket = createPATPacket();

            // Create PMT (Program Map Table)
            byte[] pmtPacket = createPMTPacket();

            // Add PAT and PMT to the buffer
            addToTsBufferAndSendIfFull(patPacket);
            addToTsBufferAndSendIfFull(pmtPacket);

        } catch (IOException e) {
            Log.e(TAG, "Error sending PAT and PMT", e);
        }
    }

    private byte[] createPATPacket() {
        byte[] tsPacket = new byte[TS_PACKET_SIZE];
        Arrays.fill(tsPacket, (byte)0xFF); // Fill with stuffing bytes

        // TS Header
        tsPacket[0] = SYNC_BYTE;
        tsPacket[1] = (byte) 0x40; // Payload unit start indicator
        tsPacket[2] = (byte) 0x00; // PAT PID = 0x0000
        tsPacket[3] = (byte) (0x10 | (patContinuityCounter & 0x0F)); // No adaptation field, payload only
        patContinuityCounter = (byte) ((patContinuityCounter + 1) & 0x0F);

        // PAT pointer field
        tsPacket[4] = 0x00;

        // PAT table
        int index = 5;
        tsPacket[index++] = 0x00; // Table ID for PAT
        tsPacket[index++] = (byte) 0xB0; // Section syntax indicator + reserved bits + section length high
        tsPacket[index++] = 0x0D; // Section length low (13 bytes)

        // Transport stream ID
        tsPacket[index++] = 0x00;
        tsPacket[index++] = 0x01;

        // Reserved bits + version + current/next indicator
        tsPacket[index++] = (byte) 0xC1; // 11000001

        // Section number and last section number
        tsPacket[index++] = 0x00;
        tsPacket[index++] = 0x00;

        // Program number
        tsPacket[index++] = 0x00;
        tsPacket[index++] = 0x01;

        // Reserved bits + PMT PID
        tsPacket[index++] = (byte) ((PMT_PID >> 8) & 0x1F | 0xE0);
        tsPacket[index++] = (byte) (PMT_PID & 0xFF);

        // CRC32
        int crc = calculateCRC32(tsPacket, 5, index - 5);
        tsPacket[index++] = (byte) ((crc >> 24) & 0xFF);
        tsPacket[index++] = (byte) ((crc >> 16) & 0xFF);
        tsPacket[index++] = (byte) ((crc >> 8) & 0xFF);
        tsPacket[index++] = (byte) (crc & 0xFF);

        // Add adaptation field if needed to fill the packet
        if (index < TS_PACKET_SIZE) {
            // Move everything after the TS header to make room for adaptation field
            int dataLength = index - 4;
            System.arraycopy(tsPacket, 4, tsPacket, 5, dataLength);

            // Set adaptation field flag
            tsPacket[3] |= 0x20;

            // Set adaptation field length
            tsPacket[4] = (byte) (TS_PACKET_SIZE - 5 - dataLength);

            // Fill adaptation field with stuffing bytes (already filled with 0xFF)
        }

        return tsPacket;
    }

    private byte[] createPMTPacket() {
        byte[] tsPacket = new byte[TS_PACKET_SIZE];
        Arrays.fill(tsPacket, (byte)0xFF); // Fill with stuffing bytes

        // TS Header
        tsPacket[0] = SYNC_BYTE;
        tsPacket[1] = (byte) 0x40; // Payload unit start indicator
        tsPacket[1] |= (byte) ((PMT_PID >> 8) & 0x1F);
        tsPacket[2] = (byte) (PMT_PID & 0xFF);
        tsPacket[3] = (byte) (0x10 | (pmtContinuityCounter & 0x0F)); // No adaptation field, payload only
        pmtContinuityCounter = (byte) ((pmtContinuityCounter + 1) & 0x0F);

        // PMT pointer field
        tsPacket[4] = 0x00;

        // PMT table
        int index = 5;
        tsPacket[index++] = 0x02; // Table ID for PMT

        // Section length will be filled later
        int sectionLengthIndex = index;
        tsPacket[index++] = (byte) 0xB0; // Section syntax indicator + reserved bits + section length high
        tsPacket[index++] = 0x00; // Section length low (placeholder)

        // Program number
        tsPacket[index++] = 0x00;
        tsPacket[index++] = 0x01;

        // Reserved bits + version + current/next indicator
        tsPacket[index++] = (byte) 0xC1; // 11000001

        // Section number and last section number
        tsPacket[index++] = 0x00;
        tsPacket[index++] = 0x00;

        // Reserved bits + PCR PID (same as video PID)
        tsPacket[index++] = (byte) ((VIDEO_PID >> 8) & 0x1F | 0xE0);
        tsPacket[index++] = (byte) (VIDEO_PID & 0xFF);

        // Reserved bits + program info length (0 for now)
        tsPacket[index++] = (byte) 0xF0;
        tsPacket[index++] = 0x00;

        // H.264 video stream
        tsPacket[index++] = 0x1B; // Stream type for H.264 video

        // Reserved bits + elementary PID
        tsPacket[index++] = (byte) ((VIDEO_PID >> 8) & 0x1F | 0xE0);
        tsPacket[index++] = (byte) (VIDEO_PID & 0xFF);

        // Reserved bits + ES info length (0 for now)
        tsPacket[index++] = (byte) 0xF0;
        tsPacket[index++] = 0x00;

        // Update section length
        int sectionLength = index - sectionLengthIndex - 2 + 4; // +4 for CRC
        tsPacket[sectionLengthIndex + 1] = (byte) (sectionLength & 0xFF);

        // CRC32
        int crc = calculateCRC32(tsPacket, 5, index - 5);
        tsPacket[index++] = (byte) ((crc >> 24) & 0xFF);
        tsPacket[index++] = (byte) ((crc >> 16) & 0xFF);
        tsPacket[index++] = (byte) ((crc >> 8) & 0xFF);
        tsPacket[index++] = (byte) (crc & 0xFF);

        // Add adaptation field if needed to fill the packet
        if (index < TS_PACKET_SIZE) {
            // Move everything after the TS header to make room for adaptation field
            int dataLength = index - 4;
            System.arraycopy(tsPacket, 4, tsPacket, 5, dataLength);

            // Set adaptation field flag
            tsPacket[3] |= 0x20;

            // Set adaptation field length
            tsPacket[4] = (byte) (TS_PACKET_SIZE - 5 - dataLength);

            // Fill adaptation field with stuffing bytes (already filled with 0xFF)
        }

        return tsPacket;
    }

    private void sendUdpPacket(byte[] data, int length) {
        try {
            DatagramPacket packet = new DatagramPacket(
                    data,
                    length,
                    InetAddress.getByName(destinationIp),
                    destinationPort);
            socket.send(packet);
        } catch (IOException e) {
            Log.e(TAG, "Error sending UDP packet", e);
        }
    }

    // CRC32 calculation for MPEG-TS tables
    private int calculateCRC32(byte[] data, int offset, int length) {
        int crc = 0xFFFFFFFF;
        for (int i = 0; i < length; i++) {
            crc ^= (data[offset + i] & 0xFF) << 24;
            for (int j = 0; j < 8; j++) {
                if ((crc & 0x80000000) != 0) {
                    crc = (crc << 1) ^ 0x04C11DB7;
                } else {
                    crc = crc << 1;
                }
            }
        }
        return crc;
    }

    public void setSendStreamEnable(boolean b) {}

    /**
     * Class to represent a NAL unit
     */
    private static class NalUnit {
        public final int type;
        public final byte[] data;

        public NalUnit(int type, byte[] data) {
            this.type = type;
            this.data = data;
        }
    }
}