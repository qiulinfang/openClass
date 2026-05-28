import React, { useState } from 'react'
import { Dialog } from '../base/Dialog'
import './TeacherSelectionDialog.css'

export interface Teacher {
  subject: 'biology' | 'math'
  name: string
}

export interface TeacherSelectionDialogProps {
  open?: boolean
  availableTeachers?: Teacher[]
  onConfirm?: (subject: 'biology' | 'math') => void
  onCancel?: () => void
}

export const TeacherSelectionDialog: React.FC<TeacherSelectionDialogProps> = ({
  open = false,
  availableTeachers = [
    { subject: 'biology', name: '生物老师' },
    { subject: 'math', name: '数学老师' }
  ],
  onConfirm,
  onCancel,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<'biology' | 'math' | null>(null)

  const handleConfirm = () => {
    if (selectedSubject) {
      onConfirm?.(selectedSubject)
    }
  }

  const handleCancel = () => {
    onCancel?.()
  }

  return (
    <Dialog 
      open={open} 
      title="选择老师" 
      onClose={handleCancel}
    >
      <div className="teacher-selection-content">
        <div className="teacher-list">
          {availableTeachers.map((teacher) => (
            <div
              key={teacher.subject}
              className={`teacher-item ${selectedSubject === teacher.subject ? 'selected' : ''}`}
              onClick={() => setSelectedSubject(teacher.subject)}
            >
              <div className="teacher-avatar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div className="teacher-name">{teacher.name}</div>
              {selectedSubject === teacher.subject && (
                <div className="selection-indicator">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  )
}

export default TeacherSelectionDialog
