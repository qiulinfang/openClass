const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 36566; // 使用不同端口
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(bodyParser.json());

// 日志助手
const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

// 数据存储
let studentRecords = [];
try {
    if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        studentRecords = JSON.parse(fileContent || '[]');
        console.log(`[Storage] Loaded ${studentRecords.length} records.`);
    }
} catch (error) {
    console.error('[Storage] Error loading data:', error);
}

// 异步保存数据，避免阻塞事件循环
let isSaving = false;
let pendingSave = false;

const saveToDisk = async () => {
    if (isSaving) {
        pendingSave = true;
        return;
    }
    isSaving = true;
    try {
        await fs.promises.writeFile(DATA_FILE, JSON.stringify(studentRecords, null, 2));
    } catch (error) {
        console.error('[Storage] Error saving data:', error);
    } finally {
        isSaving = false;
        if (pendingSave) {
            pendingSave = false;
            saveToDisk(); // 处理积压的写入请求
        }
    }
};

/**
 * 1. 提交学生信息与作答结果
 */
app.post('/api/sdsf/submit', (req, res) => {
    const { studentName, studentId, timestamp, isSuccess } = req.body;
    log(`[Submit] New submission from ${studentName} (${studentId}). Success: ${isSuccess}`);
    
    const record = {
        studentName,
        studentId,
        isSuccess: isSuccess === undefined ? null : isSuccess, // null表示进行中，true成功，false失败
        submittedAt: timestamp || new Date().toISOString()
    };
    
    // 覆盖逻辑：如果学生已存在，更新记录
    const index = studentRecords.findIndex(r => r.studentId === studentId);
    if (index !== -1) {
        // 保留之前的成功状态，除非明确传入了结果
        const prevSuccess = studentRecords[index].isSuccess;
        studentRecords[index] = {
            ...record,
            isSuccess: isSuccess !== undefined ? isSuccess : prevSuccess
        };
    } else {
        studentRecords.push(record);
    }
    
    saveToDisk();
    console.log(`[SDSF] Student ${studentName} (${studentId}) submitted. Success: ${isSuccess}`);
    
    res.json({ success: true, message: '提交成功' });
});

/**
 * 2. 获取统计数据
 */
app.get('/api/sdsf/stats', (req, res) => {
    log(`[Stats] Statistics requested. Total records: ${studentRecords.length}`);
    // 返回所有学生，包含成功状态
    res.json({
        success: true,
        data: {
            records: studentRecords,
            totalCount: studentRecords.length
        }
    });
});

/**
 * 3. 清除所有数据
 */
app.post('/api/sdsf/clear', (req, res) => {
    log(`[Clear] Data clear requested.`);
    studentRecords = [];
    saveToDisk();
    console.log(`[SDSF] Data cleared.`);
    res.json({ success: true, message: '数据已清除' });
});

app.listen(PORT, () => {
    console.log(`SDSF Server is running at http://localhost:${PORT}`);
});
