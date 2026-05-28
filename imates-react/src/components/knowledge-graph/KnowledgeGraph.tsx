import React, { useState, useRef, useEffect } from 'react'
import './KnowledgeGraph.css'

export interface KnowledgeNode {
  id: string
  name: string
  level?: number
}

export interface KnowledgeGraphProps {
  chapterDetails?: {
    id: string
    name: string
    level?: number
    children?: KnowledgeNode[]
  }
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  chapterDetails = { id: '', name: '' },
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [hasExpandedGraph, setHasExpandedGraph] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const getCircularNodes = (details: typeof chapterDetails) => {
    return details.children || []
  }

  const getLearningStatus = (node: KnowledgeNode) => {
    return 'not_started'
  }

  const handleCenterNodeClick = () => {
    setIsExpanded(!isExpanded)
  }

  const handleToggleMenu = (nodeId: string) => {
    setActiveNodeId(activeNodeId === nodeId ? null : nodeId)
  }

  const handleLearn = (nodeId: string) => {
    console.log('[KnowledgeGraph] 学习', nodeId)
  }

  const handlePractice = (nodeId: string) => {
    console.log('[KnowledgeGraph] 练习', nodeId)
  }

  const handleContainerClick = () => {
    setActiveNodeId(null)
  }

  const circularNodes = getCircularNodes(chapterDetails)

  return (
    <div className="knowledge-graph-container" ref={containerRef} onClick={handleContainerClick}>
      <div className="knowledge-graph">
        <div 
          className={`containment-background ${isExpanded ? 'expanded' : ''}`}
          style={{ width: '400px', height: '400px' }}
        />
        
        <div 
          className="center-node"
          onClick={handleCenterNodeClick}
        >
          <div className="node-content">
            <span className="node-name">{chapterDetails.name || '知识点'}</span>
          </div>
        </div>

        {circularNodes.map((child, index) => (
          <div
            key={child.id}
            className="circular-node"
            style={{
              transform: `rotate(${index * (360 / circularNodes.length)}deg) translateY(-120px) rotate(-${index * (360 / circularNodes.length)}deg)`,
            }}
            onClick={(e) => { e.stopPropagation(); handleToggleMenu(child.id) }}
          >
            <div className="node-content">
              <span className="node-name">{child.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default KnowledgeGraph
