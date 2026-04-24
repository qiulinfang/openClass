const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(bodyParser.json());

// 持久化存储初始化：尝试从文件读取数据
let answerRecords = [];
try {
    if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        answerRecords = JSON.parse(fileContent || '[]');
        console.log(`[Storage] Loaded ${answerRecords.length} records from disk.`);
    }
} catch (error) {
    console.error('[Storage] Error loading data:', error);
    answerRecords = [];
}

// 辅助函数：保存数据到磁盘
const saveToDisk = () => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(answerRecords, null, 2));
    } catch (error) {
        console.error('[Storage] Error saving data:', error);
    }
};

/**
 * 1. 提交课前预习作答 (新接口)
 * 逻辑：根据 8 道题的正确数量进行分层
 */
app.post('/api/homework/preview-submit', (req, res) => {
    const { studentId, homeworkId, correctCount, date } = req.body;
    const submitDate = date || new Date().toISOString().split('T')[0];
    
    // 分层算法逻辑
    let layer = 'C'; // 基础层 (0-3题)
    if (correctCount >= 7) {
        layer = 'A'; // 冲刺层 (7-8题)
    } else if (correctCount >= 4) {
        layer = 'B'; // 提升层 (4-6题)
    }

    const record = {
        studentId,
        homeworkId,
        correctCount,
        layer,
        date: submitDate,
        type: 'preview',
        submittedAt: new Date()
    };
    
    // 覆盖逻辑：如果同一天已存在该学生的预习记录，先移除旧记录
    answerRecords = answerRecords.filter(r => 
        !(r.studentId === studentId && 
          r.homeworkId === homeworkId && 
          r.type === 'preview' && 
          r.date === submitDate)
    );
    
    // 存储新记录
    answerRecords.push(record);
    saveToDisk();
    
    console.log(`[Preview] Student ${studentId} correct: ${correctCount}/8, Assigned to Layer: ${layer}, Date: ${record.date} (Overwritten)`);
    
    res.json({
        success: true,
        data: { layer, correctCount }
    });
});

/**
 * 2. 获取班级分层统计 (更新接口)
 */
app.get('/api/homework/layer-stats', (req, res) => {
    const { homeworkId, date } = req.query;
    // 筛选预习记录，如果传了 date 则按日期过滤
    const previewRecords = answerRecords.filter(r => {
        const matchHomework = r.homeworkId === homeworkId;
        const matchType = r.type === 'preview';
        
        // 兼容性处理：如果记录没有 date 字段，尝试从 submittedAt 提取
        const recordDate = r.date || (r.submittedAt ? r.submittedAt.split('T')[0] : null);
        const matchDate = date ? recordDate === date : true;
        
        return matchHomework && matchType && matchDate;
    });
    
    // 按层级聚合学生名单
    const layers = [
        { level: 'A', students: previewRecords.filter(r => r.layer === 'A').map(r => r.studentId) },
        { level: 'B', students: previewRecords.filter(r => r.layer === 'B').map(r => r.studentId) },
        { level: 'C', students: previewRecords.filter(r => r.layer === 'C').map(r => r.studentId) }
    ];

    res.json({
        success: true,
        data: {
            homeworkId,
            date: date || 'all',
            layers,
            totalCount: previewRecords.length
        }
    });
});

/**
 * 3. 提交课堂练习作答 (新接口)
 * 逻辑：记录每道题的详细作答情况，包括选项和对错
 */
app.post('/api/homework/exercise-submit', (req, res) => {
    const { studentId, lessonId, results, date } = req.body;
    const submitDate = date || new Date().toISOString().split('T')[0];
    
    const record = {
        studentId,
        lessonId,
        results, // 结构：[{ questionId, isCorrect, selectedOption, type }]
        date: submitDate,
        type: 'exercise',
        submittedAt: new Date()
    };
    
    // 覆盖逻辑：只有当 同一个学生、同一天、针对同一道题 再次提交时，才移除旧记录
    // 逻辑：如果现有的 exercise 记录中包含了本次提交的任何一个 questionId，则需要清理或更新
    const newQuestionIds = results.map(res => res.questionId);
    
    answerRecords = answerRecords.filter(r => {
        if (r.studentId === studentId && r.lessonId === lessonId && r.type === 'exercise' && r.date === submitDate) {
            // 检查这条旧记录里是否包含正在提交的题目
            const hasOverlap = r.results.some(oldRes => newQuestionIds.includes(oldRes.questionId));
            // 如果有重叠题目，则移除旧记录（即执行覆盖）
            return !hasOverlap;
        }
        return true;
    });
    
    answerRecords.push(record);
    saveToDisk();
    
    console.log(`[Exercise] Student ${studentId} submitted ${results.length} answers for lesson ${lessonId}, Date: ${record.date} (Overwritten)`);
    
    res.json({
        success: true,
        message: '练习提交成功'
    });
});

/**
 * 4. 获取题目详细作答统计 (更新接口)
 * 逻辑：基于 data.json 中的真实练习数据和预习分层进行聚合计算
 */
app.get('/api/exercise/stats', (req, res) => {
    const { lessonId, sort, date } = req.query;
    
    // 1. 获取该课节的练习记录，如果传了 date 则过滤
    const exerciseRecords = answerRecords.filter(r => {
        const matchLesson = r.lessonId === lessonId;
        const matchType = r.type === 'exercise';
        
        // 兼容性处理：如果记录没有 date 字段，尝试从 submittedAt 提取
        const recordDate = r.date || (r.submittedAt ? r.submittedAt.split('T')[0] : null);
        const matchDate = date ? recordDate === date : true;
        
        return matchLesson && matchType && matchDate;
    });

    // 2. 获取预习分层信息 (分层统计也应基于相同日期或全部，这里建议基于所有日期的最新画像，或按需过滤)
    const previewRecords = answerRecords.filter(r => r.type === 'preview' && (date ? r.date === date : true));
    const studentLayerMap = {};
    previewRecords.forEach(r => {
        studentLayerMap[r.studentId] = r.layer; // A, B, C
    });

    // 3. 提取所有涉及到的题目 ID
    const questionIds = [...new Set(exerciseRecords.flatMap(r => r.results.map(q => q.questionId)))];

    // 4. 计算每道题的统计指标
    let stats = questionIds.map(qId => {
        const qRecords = exerciseRecords.map(r => ({
            layer: studentLayerMap[r.studentId] || 'C', // 默认为基础层
            result: r.results.find(res => res.questionId === qId)
        })).filter(item => item.result);

        const totalCount = qRecords.length;
        const correctCount = qRecords.filter(item => item.result.isCorrect).length;

        // 分层统计计算
        const layerStats = {};
        ['A', 'B', 'C'].forEach(lKey => {
            const lRecords = qRecords.filter(item => item.layer === lKey);
            const lTotal = lRecords.length;
            const lCorrect = lRecords.filter(item => item.result.isCorrect).length;
            
            // 选项分布统计
            const optionMap = {};
            lRecords.forEach(item => {
                const opt = item.result.selectedOption;
                optionMap[opt] = (optionMap[opt] || 0) + 1;
            });

            layerStats[lKey === 'A' ? '1' : lKey === 'B' ? '2' : '3'] = {
                accuracy: lTotal > 0 ? Math.round((lCorrect / lTotal) * 100) : 0,
                totalCount: lTotal,
                optionDist: Object.keys(optionMap).map(opt => ({
                    label: opt,
                    count: optionMap[opt],
                    percent: lTotal > 0 ? Math.round((optionMap[opt] / lTotal) * 100) : 0
                }))
            };
        });

        return {
            questionId: qId,
            accuracy: totalCount > 0 ? (correctCount / totalCount) : 0,
            classAccuracy: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
            submitCount: totalCount,
            layerStats
        };
    });

    // 5. 排序逻辑
    if (sort === 'accuracy_asc') {
        stats.sort((a, b) => a.accuracy - b.accuracy);
    } else if (sort === 'accuracy_desc') {
        stats.sort((a, b) => b.accuracy - a.accuracy);
    }

    res.json({
        success: true,
        data: stats
    });
});

/**
 * 5. 检查今天是否有预习提交
 */
app.get('/api/homework/preview-check', (req, res) => {
    const { studentId, date } = req.query;
    const checkDate = date || new Date().toISOString().split('T')[0];
    
    // 查找是否存在该学生在该日期的预习记录
    const record = answerRecords.find(r => 
        r.studentId === studentId && 
        r.type === 'preview' && 
        (r.date === checkDate || (r.submittedAt && r.submittedAt.split('T')[0] === checkDate))
    );

    res.json({
        success: true,
        hasSubmitted: !!record
    });
});

app.listen(PORT, () => {
    console.log(`Mock Server is running at http://localhost:${PORT}`);
});
