import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/views/MyHomeworkView.css'

export interface HomeworkItem {
  id: string
  name: string
  tags?: string[]
  scoreText?: string
  timeLeftText?: string
  subject?: string
  date?: string
}

export const MyHomeworkView: React.FC = () => {
  const navigate = useNavigate()
  const [selectedDate] = useState('')
  const [selectedSubject] = useState('')
  const [loading] = useState(false)
  const [hasMore] = useState(false)
  const [homeworkList] = useState<HomeworkItem[]>([])

  const subjects = [
    { label: '数学', value: 'math' },
    { label: '语文', value: 'chinese' },
    { label: '英语', value: 'english' },
    { label: '物理', value: 'physics' },
    { label: '化学', value: 'chemistry' },
  ]

  const displayHomeworkList = homeworkList

  const handleRefresh = () => {
    console.log('[MyHomeworkView] 刷新')
  }

  const handleLoadMore = () => {
    console.log('[MyHomeworkView] 加载更多')
  }

  const handleHomeworkClick = (item: HomeworkItem) => {
    console.log('[MyHomeworkView] 点击作业', item)
  }

  return (
    <div className="my-homework-view">
      <div className="title">作业查看</div>
      <div className="header">
        <div className="filters">
          <div className="filter-item">
            <span className="filter-label">日期：</span>
            <input
              type="date"
              className="date-picker"
              value={selectedDate}
              onChange={(e) => console.log('日期选择', e.target.value)}
            />
          </div>
          <div className="filter-item">
            <span className="filter-label">学科：</span>
            <select
              className="subject-select"
              value={selectedSubject}
              onChange={(e) => console.log('学科选择', e.target.value)}
            >
              <option value="">请选择学科</option>
              {subjects.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="content">
        {!loading && homeworkList.length === 0 ? (
          <div className="empty-state">
            <img src="/icons/homework.svg" className="empty-icon" alt="作业图标" />
            <div className="empty-text">暂无作业</div>
            <div className="empty-desc">当前日期和学科条件下没有找到作业</div>
          </div>
        ) : (
          <div className="homework-grid">
            {displayHomeworkList.map((item) => (
              <div
                key={item.id}
                className="homework-card"
                onClick={() => handleHomeworkClick(item)}
              >
                <div className="card-content">
                  <div className="card-left">
                    <div className="card-title">{item.name}</div>
                    <div className="card-tags">
                      {item.tags?.map((tag) => (
                        <span key={tag} className="status-tag">{tag}</span>
                      ))}
                    </div>
                    <div className="card-meta">
                      {item.scoreText && <span className="meta-score">{item.scoreText}</span>}
                      {item.timeLeftText && <span className="meta-deadline">{item.timeLeftText}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyHomeworkView
