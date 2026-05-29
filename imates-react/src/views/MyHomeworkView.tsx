import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import type { HomeworkUndoItem, HomeworkQuestionDetail, ExerciseItem } from '@/types'
import { SUBJECT_ID_TO_NAME, HOMEWORK_SUBJECT_OPTIONS } from '@/constants/subjects'
import { 
  getHomeworkStatusText, 
  getHomeworkStatusType, 
  getHomeworkStatusTagType, 
  getHomeworkTagText, 
  getHomeworkButtonVariant 
} from '@/constants/homework'
import { mapHomeworkQuestionToExercise } from '@/utils/business/exercise-utils'

import Button from '@/components/base/Button'
import DatePicker from '@/components/base/DatePicker'
import Select from '@/components/base/Select'
import VirtualScroll, { VirtualScrollRef } from '@/components/base/VirtualScroll'
import Tag from '@/components/base/Tag'

import '@/views/MyHomeworkView.css'
import homeworkDeepIcon from '/icons/homework_deep.svg'

export const MyHomeworkView: React.FC = () => {
  const navigate = useNavigate()
  const fetchHomeworkListStore = useHomeworkStore(s => s.fetchHomeworkList)
  const setQuestions = useHomeworkStore(s => s.setQuestions)
  const setCurrentHomeworkInfo = useHomeworkStore(s => s.setCurrentHomeworkInfo)
  const setHomeworkName = useHomeworkStore(s => s.setHomeworkName)
  const setResubmitType = useHomeworkStore(s => s.setResubmitType)
  
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedSubject, setSelectedSubject] = useState('')
  
  const [homeworkList, setHomeworkList] = useState<HomeworkUndoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const pageSize = 20

  const rubberBandListRef = useRef<VirtualScrollRef>(null)
  const debounceTimer = useRef<number | null>(null)

  const subjects = HOMEWORK_SUBJECT_OPTIONS

  // 日期格式化辅助函数
  const formatDate = (dateString: string) => {
    return new Date(dateString).toISOString().slice(0, 10).replace(/-/g, '/')
  }

  const getTimeLeftText = (deadline?: string) => {
    if (!deadline) return ''
    const deadlineMs = new Date(deadline).getTime()
    if (!Number.isFinite(deadlineMs)) return ''
    const diff = deadlineMs - Date.now()
    if (diff <= 0) return '已截止'

    const totalMinutes = Math.floor(diff / 60000)
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const minutes = totalMinutes % 60

    const parts: string[] = []
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    if (parts.length === 0) parts.push(`${Math.max(1, minutes)}分钟`)
    return `还剩${parts.join('')}截止`
  }

  // 获取作业列表
  const fetchHomeworkList = useCallback(async (isRefresh = false) => {
    if (loading) return

    setLoading(true)
    try {
      const currentPage = isRefresh ? 0 : pageNumber
      const queryReq = {
        pageNumber: currentPage,
        pageSize: pageSize,
        subject: selectedSubject || undefined,
        date: selectedDate || undefined,
      }

      const result = await fetchHomeworkListStore(queryReq, isRefresh)
      
      if (currentPage === 0) {
        setHomeworkList(result)
      } else {
        setHomeworkList(prev => [...prev, ...result])
      }
      setHasMore(result.length >= pageSize)
    } catch (error) {
      console.error('[MyHomeworkView] 获取作业列表异常:', error)
      if (isRefresh || pageNumber === 0) {
        setHomeworkList([])
      }
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [loading, pageNumber, selectedSubject, selectedDate, fetchHomeworkListStore])

  // 下拉刷新
  const handleRefresh = async () => {
    try {
      setPageNumber(0)
      setHasMore(true)
      await fetchHomeworkList(true)
    } catch (error) {
      console.error('[MyHomeworkView] ❌ 下拉刷新失败:', error)
    } finally {
      rubberBandListRef.current?.finishRefresh()
    }
  }

  // 上拉加载更多
  const handleLoadMore = async () => {
    if (!loading && hasMore) {
      setPageNumber(prev => prev + 1)
    }
  }

  // 监听 pageNumber 变化执行加载更多
  useEffect(() => {
    if (pageNumber > 0) {
      fetchHomeworkList()
    }
  }, [pageNumber])

  // 监听筛选条件变化
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    debounceTimer.current = window.setTimeout(() => {
      setPageNumber(0)
      setHasMore(true)
      fetchHomeworkList(true)
      debounceTimer.current = null
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [selectedDate, selectedSubject])

  // 初始加载
  useEffect(() => {
    fetchHomeworkList(true)
  }, [])

  const displayHomeworkList = useMemo(() => {
    return homeworkList.map((homework) => {
      const statusText = getHomeworkStatusText(homework.status, homework.deadline)
      const statusType = getHomeworkStatusType(homework.status)
      const statusTagType = getHomeworkStatusTagType(statusType, homework.deadline)

      const tags = []
      if (homework.subject) {
        const subjectName = SUBJECT_ID_TO_NAME[homework.subject as keyof typeof SUBJECT_ID_TO_NAME] || homework.subject
        tags.push(subjectName)
      }
      if (homework.fullSubmit === '1') tags.push(getHomeworkTagText('fullSubmit'))
      if (homework.lateSubmit === '1') tags.push(getHomeworkTagText('lateSubmit'))
      if (homework.resubmit === '1') tags.push(getHomeworkTagText('resubmit'))

      const releaseText = homework.releaseTime ? formatDate(homework.releaseTime) : ''
      const deadlineText = homework.deadline ? formatDate(homework.deadline) : ''
      const rangeText = (releaseText && deadlineText)
        ? `${releaseText}-${deadlineText}`
        : (releaseText || deadlineText)

      const scoreText = homework.totalScore ? `总分：${homework.totalScore}分` : '总分：--'

      const deadlineMs = homework.deadline ? new Date(homework.deadline).getTime() : NaN
      const nowMs = Date.now()
      const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= nowMs : false
      const timeLeftText = getTimeLeftText(homework.deadline)

      const buttonDisabled = false
      const buttonText = '去查看'
      const buttonVariant = getHomeworkButtonVariant(buttonDisabled)

      return {
        id: homework.id,
        name: homework.title,
        tags: tags,
        statusText,
        statusType,
        statusTagType: statusTagType as 'green' | 'purple' | 'gray',
        scoreText,
        timeLeftText,
        isExpired,
        rangeText,
        buttonText,
        buttonVariant,
        buttonDisabled,
        date: homework.releaseTime ? formatDate(homework.releaseTime) : '暂无',
        remark: homework.remark || '',
        homework: homework,
      }
    })
  }, [homeworkList])

  const goAnswer = async (item: { id: string; homework: HomeworkUndoItem }) => {
    try {
      const questionDetails = await apiService.getHomeworkDetailList(item.id)

      if (questionDetails && questionDetails.length > 0) {
        const exerciseItems: ExerciseItem[] = questionDetails.map((question: HomeworkQuestionDetail, index: number) => {
          return mapHomeworkQuestionToExercise(question, index, item.homework.subject)
        })

        setQuestions(exerciseItems)
        setCurrentHomeworkInfo(item.homework)
        setHomeworkName(item.homework.title)
        setResubmitType(item.homework.resubmit || '0')

        navigate(`/app/homework-answer/${item.id}?scene=homework`)
      } else {
        console.error('[MyHomeworkView] 获取作业详情失败或无题目数据:', questionDetails)
        showMessage('作业题目为空，无法进入作答', 'warning')
      }
    } catch (error) {
      console.error('[MyHomeworkView] 获取作业详情异常:', error)
      showMessage('获取作业详情失败，请稍后重试', 'error')
    }
  }

  return (
    <div className="my-homework-view">
      <div className="title">作业查看</div>
      <div className="header">
        <div className="filters">
          <div className="filter-item">
            <span className="filter-label">日期：</span>
            <DatePicker 
              value={selectedDate} 
              onChange={(val) => setSelectedDate(val || '')} 
              placeholder="请选择日期" 
            />
          </div>
          <div className="filter-item">
            <span className="filter-label">学科：</span>
            <Select
              value={selectedSubject}
              onChange={(val) => setSelectedSubject(String(val))}
              options={subjects}
              placeholder="请选择学科"
            />
          </div>
        </div>
      </div>

      <div className="content">
        <VirtualScroll
          ref={rubberBandListRef}
          className="homework-list-wrapper"
          enableRefresh={true}
          enableLoadMore={hasMore}
          loading={loading}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
          footer={!hasMore && !loading && homeworkList.length > 0 ? (
            <div className="list-footer">没有更多了</div>
          ) : null}
        >
          {!loading && homeworkList.length === 0 ? (
            <div className="empty-state">
              <img src={homeworkDeepIcon} className="empty-icon" alt="作业图标" />
              <div className="empty-text">暂无作业</div>
              <div className="empty-desc">当前日期和学科条件下没有找到作业</div>
            </div>
          ) : (
            <div className="homework-grid">
              {displayHomeworkList.map((item) => (
                <div key={item.id} className="homework-card">
                  <div className="card-content">
                    <div className="card-left">
                      <div className="card-title">{item.name}</div>

                      <div className="card-tags">
                        {item.tags.map((tag) => (
                          <Tag
                            key={tag}
                            text={tag}
                            type="gray"
                            variant="text"
                            size="sm"
                          />
                        ))}
                      </div>

                      <div className="card-meta">
                        <span className="meta-score">{item.scoreText}</span>
                        {item.timeLeftText && (
                          <span
                            className={`meta-deadline ${item.isExpired ? 'is-expired' : ''}`}
                          >
                            {item.timeLeftText}
                          </span>
                        )}
                        {item.rangeText && <span className="meta-range">{item.rangeText}</span>}
                      </div>
                    </div>

                    <div className="card-right">
                      <Tag
                        text={item.statusText}
                        type={item.statusTagType}
                        size="sm"
                        dot
                      />
                      <Button
                        label={item.buttonText}
                        size="mdCompact"
                        variant={item.buttonVariant}
                        disabled={item.buttonDisabled}
                        onClick={() => goAnswer(item)}
                      />
                    </div>
                  </div>

                  {item.remark && (
                    <div className="card-footer">
                      <div className="homework-remark">{item.remark}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </VirtualScroll>
      </div>
    </div>
  )
}

export default MyHomeworkView
