import React, { useState } from 'react'
import './LearningView.css'

export interface LearningPackage {
  id: string
  packageName: string
  difficulty?: number
}

export interface LearningViewProps {
  visible?: boolean
  sectionName?: string
  onClose?: () => void
}

export const LearningView: React.FC<LearningViewProps> = ({
  visible = false,
  sectionName = '学习',
  onClose,
}) => {
  const [loadingPackages] = useState(false)
  const [selectedSchemeIndex, setSelectedSchemeIndex] = useState(0)
  const [learningPackages] = useState<LearningPackage[]>([])

  const filteredLearningPackages = learningPackages

  const selectScheme = (index: number) => {
    setSelectedSchemeIndex(index)
  }

  const getDifficultyValue = (scheme: LearningPackage) => {
    return scheme.difficulty || 3
  }

  const updateDifficulty = (id: string, value: number) => {
    console.log('[LearningView] 更新难度', id, value)
  }

  if (!visible) return null

  return (
    <div className="learning-modal-overlay">
      <div className="learning-modal">
        <div className="learning-header">
          <h2 className="learning-title">{sectionName}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="learning-content">
          <div className="main-content">
            <div className="left-panel">
              <div className="scheme-section">
                {loadingPackages ? (
                  <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">正在加载学习方案...</div>
                  </div>
                ) : filteredLearningPackages.length > 0 ? (
                  <div className="scheme-list">
                    {filteredLearningPackages.map((scheme, index) => (
                      <div
                        key={scheme.id}
                        className={`scheme-item ${selectedSchemeIndex === index ? 'scheme-selected' : ''}`}
                        onClick={() => selectScheme(index)}
                      >
                        <div className="scheme-header">
                          <span className="scheme-name">{scheme.packageName}</span>
                          <div className="difficulty-rating">
                            <span className="difficulty-label">难度</span>
                            <div className="rating-stars">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className={`star ${star <= getDifficultyValue(scheme) ? 'filled' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); updateDifficulty(scheme.id, star) }}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="#ccc">
                      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
                    </svg>
                    <div className="empty-text">该章节暂无学习方案</div>
                  </div>
                )}
              </div>
            </div>

            <div className="right-panel">
              <div className="content-placeholder">
                <span>选择学习方案开始学习</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LearningView
