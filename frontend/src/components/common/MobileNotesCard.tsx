import React, { useState, useRef } from 'react';
import { useSwipe } from '../../hooks/useMobileInteractions';
import { useResponsive } from '../../hooks/useResponsive';
import MobileOptimizedButton from '../common/MobileOptimizedButton';
import './MobileNotesCard.css';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  color?: string;
}

interface MobileNotesCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onShare?: (note: Note) => void;
  onPin?: (id: string) => void;
  isPinned?: boolean;
  className?: string;
}

export const MobileNotesCard: React.FC<MobileNotesCardProps> = ({
  note,
  onEdit,
  onDelete,
  onShare,
  onPin,
  isPinned = false,
  className = '',
}) => {
  const { isMobile } = useResponsive();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Swipe handlers for mobile interactions
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      if (isMobile) {
        setShowActions(true);
        // Auto-hide actions after 3 seconds
        setTimeout(() => setShowActions(false), 3000);
      }
    },
    onSwipeRight: () => {
      if (isMobile) {
        setShowActions(false);
      }
    },
  });

  const formatDate = (date: Date) => {
    if (isMobile) {
      // Show shorter format on mobile
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleCardTap = () => {
    if (isMobile) {
      setIsExpanded(!isExpanded);
    } else {
      onEdit(note);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(note);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this note?')) {
      onDelete(note.id);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) {
      onShare(note);
    } else if (navigator.share) {
      navigator.share({
        title: note.title,
        text: note.content,
      }).catch(console.error);
    }
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPin) {
      onPin(note.id);
    }
  };

  const truncateContent = (content: string, maxLength: number) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div
      ref={cardRef}
      className={`mobile-notes-card ${className} ${isExpanded ? 'expanded' : ''} ${showActions ? 'show-actions' : ''} ${isPinned ? 'pinned' : ''}`}
      style={{ '--note-color': note.color || '#ffffff' } as React.CSSProperties}
      onClick={handleCardTap}
      {...swipeHandlers}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardTap();
        }
      }}
      aria-expanded={isExpanded}
      aria-label={`Note: ${note.title}`}
    >
      {/* Pin indicator */}
      {isPinned && (
        <div className="pin-indicator" aria-label="Pinned note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1zm-6 20l-1-1v-6H8.5l-.5-2h8l-.5 2H14v6l-1 1z"/>
          </svg>
        </div>
      )}

      {/* Card header */}
      <div className="card-header">
        <h3 className="note-title">{note.title}</h3>
        <div className="note-meta">
          <time className="note-date" dateTime={note.updatedAt.toISOString()}>
            {formatDate(note.updatedAt)}
          </time>
        </div>
      </div>

      {/* Card content */}
      <div className="card-content">
        <p className="note-content">
          {isExpanded || !isMobile 
            ? note.content 
            : truncateContent(note.content, isMobile ? 100 : 200)
          }
        </p>
        
        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="note-tags">
            {note.tags.slice(0, isMobile && !isExpanded ? 2 : note.tags.length).map((tag, index) => (
              <span key={index} className="tag">
                #{tag}
              </span>
            ))}
            {isMobile && !isExpanded && note.tags.length > 2 && (
              <span className="tag more-tags">+{note.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Mobile action buttons - shown on swipe or expanded */}
      <div className="card-actions" aria-hidden={!showActions && !isExpanded}>
        <div className="action-buttons">
          <MobileOptimizedButton
            variant="ghost"
            size="small"
            onClick={handleEdit}
            aria-label="Edit note"
            className="action-btn edit-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            {!isMobile && 'Edit'}
          </MobileOptimizedButton>

          {onPin && (
            <MobileOptimizedButton
              variant="ghost"
              size="small"
              onClick={handlePin}
              aria-label={isPinned ? "Unpin note" : "Pin note"}
              className={`action-btn pin-btn ${isPinned ? 'active' : ''}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h10c.55 0 1-.45 1-1s-.45-1-1-1zm-6 20l-1-1v-6H8.5l-.5-2h8l-.5 2H14v6l-1 1z"/>
              </svg>
              {!isMobile && (isPinned ? 'Unpin' : 'Pin')}
            </MobileOptimizedButton>
          )}

          {(onShare || ('share' in navigator)) && (
            <MobileOptimizedButton
              variant="ghost"
              size="small"
              onClick={handleShare}
              aria-label="Share note"
              className="action-btn share-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
              </svg>
              {!isMobile && 'Share'}
            </MobileOptimizedButton>
          )}

          <MobileOptimizedButton
            variant="ghost"
            size="small"
            onClick={handleDelete}
            aria-label="Delete note"
            className="action-btn delete-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            {!isMobile && 'Delete'}
          </MobileOptimizedButton>
        </div>
      </div>

      {/* Swipe indicator */}
      {isMobile && !showActions && (
        <div className="swipe-indicator" aria-hidden="true">
          <div className="swipe-hint">← Swipe for actions</div>
        </div>
      )}
    </div>
  );
};

export default MobileNotesCard;
