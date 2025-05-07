package com.cosinetech.imates.screencasting;

import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
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
    private final ExecutorService executor;

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

    public H264ToTsStreamer(String destinationIp, int destinationPort) {
        this.destinationIp = destinationIp;
        this.destinationPort = destinationPort;
        this.executor = Executors.newSingleThreadExecutor();
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
        if (socket != null) {
            socket.close();
        }
        executor.shutdown();
        Log.d(TAG, "H264ToTsStreamer stopped");
    }

    // This is the callback method that will receive H.264 data
    public void onH264DataReceived(byte[] h264Data, long presentationTimeUs) {
        executor.execute(() -> processH264Frame(h264Data, presentationTimeUs));
    }

    private void processH264Frame(byte[] h264Data, long presentationTimeUs) {
        try {
            // If this is the first frame, set the PTS base
            if (ptsBase == 0) {
                ptsBase = presentationTimeUs;
            }

            // Calculate PTS (Presentation Time Stamp) relative to base
            long pts = (presentationTimeUs - ptsBase) * 90; // Convert to 90kHz clock

            // Create PES packet
            byte[] pesPacket = createPESPacket(h264Data, pts);

            // Split PES packet into TS packets
            ByteArrayOutputStream tsStream = new ByteArrayOutputStream();

            // First TS packet with PES header
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

                // Adaptation field control and continuity counter
                tsPacket[3] = (byte) (0x10 | (videoContinuityCounter & 0x0F));
                videoContinuityCounter = (byte) ((videoContinuityCounter + 1) & 0x0F);

                // Determine payload size
                int headerSize = 4; // TS header size
                int payloadSize = Math.min(TS_PACKET_SIZE - headerSize, pesPacket.length - offset);

                // Copy payload data
                System.arraycopy(pesPacket, offset, tsPacket, headerSize, payloadSize);

                // Fill remaining bytes with stuffing (0xFF)
                for (int i = headerSize + payloadSize; i < TS_PACKET_SIZE; i++) {
                    tsPacket[i] = (byte) 0xFF;
                }

                tsStream.write(tsPacket);
                offset += payloadSize;
                firstPacket = false;

                // If we have enough TS packets for a UDP packet, send it
                if (tsStream.size() >= UDP_PACKET_SIZE) {
                    sendUdpPacket(tsStream.toByteArray(), UDP_PACKET_SIZE);
                    tsStream.reset();
                }
            }

            // Send any remaining TS packets
            if (tsStream.size() > 0) {
                // Pad to full UDP packet size if needed
                byte[] finalData = tsStream.toByteArray();
                if (finalData.length < UDP_PACKET_SIZE) {
                    byte[] paddedData = new byte[UDP_PACKET_SIZE];
                    System.arraycopy(finalData, 0, paddedData, 0, finalData.length);
                    // Fill remaining with null TS packets
                    for (int i = finalData.length; i < UDP_PACKET_SIZE; i++) {
                        if (i % TS_PACKET_SIZE == 0) {
                            paddedData[i] = SYNC_BYTE;
                        } else {
                            paddedData[i] = (byte) 0xFF;
                        }
                    }
                    finalData = paddedData;
                }
                sendUdpPacket(finalData, UDP_PACKET_SIZE);
            }

            pesPacketCounter++;

        } catch (Exception e) {
            Log.e(TAG, "Error processing H264 frame", e);
        }
    }

    private byte[] createPESPacket(byte[] h264Data, long pts) {
        ByteArrayOutputStream pesStream = new ByteArrayOutputStream();

        try {
            // PES packet header (start code)
            pesStream.write(new byte[] {0x00, 0x00, 0x01, (byte) 0xE0});

            // Calculate PES packet length (will be filled later)
            int pesLength = h264Data.length + 13; // 13 bytes for PES header after length field
            if (pesLength > 0xFFFF) {
                pesLength = 0; // For packets larger than 64KB, set length to 0
            }
            pesStream.write((pesLength >> 8) & 0xFF);
            pesStream.write(pesLength & 0xFF);

            // PES header flags
            pesStream.write(0x80); // Marker bits + scrambling control + priority
            pesStream.write(0x80); // PTS flag set, DTS flag not set
            pesStream.write(0x05); // PES header length (5 bytes for PTS)

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

            // Combine PAT and PMT into one UDP packet
            ByteArrayOutputStream tsStream = new ByteArrayOutputStream();
            tsStream.write(patPacket);
            tsStream.write(pmtPacket);

            // Fill the rest with null packets to reach UDP_PACKET_SIZE
            int remainingBytes = UDP_PACKET_SIZE - tsStream.size();
            for (int i = 0; i < remainingBytes; i += TS_PACKET_SIZE) {
                byte[] nullPacket = createNullPacket();
                tsStream.write(nullPacket);
            }

            // Send the UDP packet
            sendUdpPacket(tsStream.toByteArray(), UDP_PACKET_SIZE);

        } catch (IOException e) {
            Log.e(TAG, "Error sending PAT and PMT", e);
        }
    }

    private byte[] createPATPacket() {
        byte[] tsPacket = new byte[TS_PACKET_SIZE];

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

        // Fill remaining bytes with stuffing (0xFF)
        for (int i = index; i < TS_PACKET_SIZE; i++) {
            tsPacket[i] = (byte) 0xFF;
        }

        return tsPacket;
    }

    private byte[] createPMTPacket() {
        byte[] tsPacket = new byte[TS_PACKET_SIZE];

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

        // Fill remaining bytes with stuffing (0xFF)
        for (int i = index; i < TS_PACKET_SIZE; i++) {
            tsPacket[i] = (byte) 0xFF;
        }

        return tsPacket;
    }

    private byte[] createNullPacket() {
        byte[] tsPacket = new byte[TS_PACKET_SIZE];
        tsPacket[0] = SYNC_BYTE;
        tsPacket[1] = (byte) 0x1F;
        tsPacket[2] = (byte) 0xFF;
        tsPacket[3] = (byte) 0x10;

        // Fill remaining bytes with stuffing (0xFF)
        for (int i = 4; i < TS_PACKET_SIZE; i++) {
            tsPacket[i] = (byte) 0xFF;
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
}