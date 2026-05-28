import React, { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './LearningContentView.css'

export const LearningContentView: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const fileName = searchParams.get('fileName') || ''
  const fileExtension = useMemo(() => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    return ext
  }, [fileName])

  const viewerType = useMemo(() => {
    const ext = fileExtension
    switch (ext) {
      case 'pdf':
        return 'pdf'
      case 'html':
      case 'htm':
        return 'html'
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'flv':
      case 'webm':
        return 'video'
      default:
        return 'unsupported'
    }
  }, [fileExtension])

  const handleGoBack = () => {
    const fromLearning = searchParams.get('fromLearning')
    if (fromLearning === 'true') {
      navigate({
        pathname: '/learning',
        search: `?nodeId=${searchParams.get('learningNodeId') || ''}&sectionName=${searchParams.get('textbookName') || ''}&id=${searchParams.get('id') || ''}&level=${searchParams.get('learningLevel') || ''}`,
      })
    } else {
      navigate(-1)
    }
  }

  const renderViewer = () => {
    switch (viewerType) {
      case 'pdf':
        return <div className="viewer-placeholder">PDF 查看器</div>
      case 'html':
        return <div className="viewer-placeholder">HTML 查看器</div>
      case 'video':
        return <div className="viewer-placeholder">视频播放器</div>
      default:
        return (
          <div className="unsupported-viewer">
            <div className="unsupported-content">
              <svg viewBox="0 0 24 24" width="80" height="80" fill="#999">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div className="unsupported-title">不支持的文件类型</div>
              <div className="unsupported-desc">
                当前文件类型（{fileExtension}）暂不支持预览
              </div>
              <div className="unsupported-filename">
                文件名：{fileName}
              </div>
              <button className="back-btn" onClick={handleGoBack}>
                返回
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="learning-content-view">
      {renderViewer()}
    </div>
  )
}

export default LearningContentView
