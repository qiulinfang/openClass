const express = require('express');
const axios = require('axios');
const redis = require('redis');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 36567;

// Redis 配置
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', err => console.error('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis'));

app.use(cors());
app.use(express.json());

// 日志助手
const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

// 存储活跃的 SSE 连接，防止重复开启
const activeSseConnections = new Map();

/**
 * 1. 注册/启动命令代理
 * 前端在初始化或重置会话时调用，告知后端开始监听特定 thread_id 的 SSE 命令流
 */
app.post('/api/proxy/start', async (req, res) => {
    const { thread_id } = req.body;
    if (!thread_id) return res.status(400).json({ error: 'Missing thread_id' });

    if (activeSseConnections.has(thread_id)) {
        log(`[Proxy] Thread ${thread_id} already has an active listener.`);
        return res.json({ success: true, message: 'Already listening' });
    }

    log(`[Proxy] Starting command listener for thread: ${thread_id}`);
    
    try {
        const aiSseUrl = `https://kelvin-cosin.cloud/test/api/canvas/sse/${thread_id}`;
        log(`[Proxy] Connecting to AI SSE: ${aiSseUrl}`);
        
        const response = await axios({
            method: 'get',
            url: aiSseUrl,
            responseType: 'stream',
            headers: { 'Accept': 'text/event-stream' }
        });

        log(`[Proxy] Connected to AI SSE for thread ${thread_id}`);
        activeSseConnections.set(thread_id, response);

        response.data.on('data', async (chunk) => {
            const dataStr = chunk.toString();
            if (dataStr.includes(': keepalive')) return;
            
            log(`[Proxy] Received chunk from AI (${thread_id}): ${dataStr.substring(0, 100)}...`);
            
            // 存入 Redis 队列
            const key = `cmds:${thread_id}`;
            try {
                await redisClient.rPush(key, dataStr);
                await redisClient.expire(key, 3600); // 1小时过期
                log(`[Proxy] Stored in Redis for ${thread_id}, current key: ${key}`);
            } catch (rErr) {
                log(`[Proxy] Redis storage error: ${rErr.message}`);
            }
        });

        response.data.on('end', () => {
            log(`[Proxy] SSE stream ended for ${thread_id}`);
            activeSseConnections.delete(thread_id);
        });

        response.data.on('error', (err) => {
            log(`[Proxy] SSE stream error for ${thread_id}: ${err.message}`);
            activeSseConnections.delete(thread_id);
        });

        res.json({ success: true });
    } catch (err) {
        log(`[Proxy] Failed to connect to AI SSE: ${err.message}`);
        res.status(500).json({ error: 'Failed to connect to AI SSE' });
    }
});

/**
 * 2. 命令轮询接口
 * 前端通过此接口获取积攒的命令
 */
app.get('/api/proxy/poll', async (req, res) => {
    const { thread_id } = req.query;
    if (!thread_id) return res.status(400).json({ error: 'Missing thread_id' });

    const key = `cmds:${thread_id}`;
    try {
        const multi = redisClient.multi();
        multi.lRange(key, 0, -1);
        multi.del(key);
        const [cmds] = await multi.exec();

        if (cmds && cmds.length > 0) {
            log(`[Poll] Thread ${thread_id} picked up ${cmds.length} commands`);
        } else {
            // 只有当 Redis 中真的没有数据时才打这个 log，避免刷屏可以根据需要关闭
            // log(`[Poll] Thread ${thread_id} - No commands found in Redis`);
        }

        res.json({ success: true, data: cmds || [] });
    } catch (err) {
        log(`[Poll] Error for thread ${thread_id}: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// 健康检查
app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
    log(`Command Proxy running at http://localhost:${PORT}`);
});
