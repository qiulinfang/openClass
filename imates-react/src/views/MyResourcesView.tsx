import React, { useState } from 'react'
import './MyResourcesView.css'

export interface ResourceItem {
  id: string
  name: string
  subject?: string
  grade?: string
  version?: string
  status?: 'downloaded' | 'downloading' | 'not_downloaded'
  progress?: number
}

export const MyResourcesView: React.FC = () => {
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [resourceList] = useState<ResourceItem[]>([])

  const gradeOptions = [
    { label: '全部', value: '' },
    { label: '一年级', value: '1' },
    { label: '二年级', value: '2' },
    { label: '三年级', value: '3' },
  ]

  const versionOptions = [
    { label: '全部', value: '' },
    { label: '人教版', value: 'pep' },
    { label: '北师大版', value: 'bsd' },
  ]

  const subjectOptions = [
    { label: '全部', value: '' },
    { label: '数学', value: 'math' },
    { label: '语文', value: 'chinese' },
    { label: '英语', value: 'english' },
  ]

  const statusOptions = [
    { label: '全部', value: '' },
    { label: '已下载', value: 'downloaded' },
    { label: '下载中', value: 'downloading' },
    { label: '未下载', value: 'not_downloaded' },
  ]

  const handleFilterChange = () => {
    console.log('[MyResourcesView] 筛选条件变化')
  }

  const handleDownload = (item: ResourceItem) => {
    console.log('[MyResourcesView] 下载', item)
  }

  const handleDelete = (item: ResourceItem) => {
    console.log('[MyResourcesView] 删除', item)
  }

  return (
    <div className="my-resources-view">
      <div className="filter-section">
        <div className="filter-title">资源下载</div>
        <div className="filter-content">
          <div className="filter-dropdown-item">
            <label className="filter-label">年级:</label>
            <select
              className="filter-select"
              value={selectedGrade}
              onChange={(e) => { setSelectedGrade(e.target.value); handleFilterChange() }}
            >
              {gradeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-dropdown-item">
            <label className="filter-label">教材版本:</label>
            <select
              className="filter-select"
              value={selectedVersion}
              onChange={(e) => { setSelectedVersion(e.target.value); handleFilterChange() }}
            >
              {versionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-dropdown-item">
            <label className="filter-label">学科:</label>
            <select
              className="filter-select"
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); handleFilterChange() }}
            >
              {subjectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-dropdown-item">
            <label className="filter-label">下载状态:</label>
            <select
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); handleFilterChange() }}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="resource-content">
        {resourceList.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" width="80" height="80" fill="#ccc">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
            <div className="empty-text">暂无资源</div>
          </div>
        ) : (
          <div className="resource-grid">
            {resourceList.map((item) => (
              <div key={item.id} className="resource-card">
                <div className="resource-info">
                  <div className="resource-name">{item.name}</div>
                  <div className="resource-meta">
                    {item.subject} · {item.grade} · {item.version}
                  </div>
                </div>
                <div className="resource-actions">
                  {item.status === 'downloaded' ? (
                    <button className="action-btn delete" onClick={() => handleDelete(item)}>删除</button>
                  ) : item.status === 'downloading' ? (
                    <div className="progress-bar">
                      <div className="progress" style={{ width: `${item.progress || 0}%` }}></div>
                    </div>
                  ) : (
                    <button className="action-btn download" onClick={() => handleDownload(item)}>下载</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyResourcesView
