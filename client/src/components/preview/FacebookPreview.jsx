import React from 'react';
import { ThumbsUp, MessageSquare, Share2, MoreHorizontal, Globe } from 'lucide-react';

export default function FacebookPreview({ content, mediaUrl }) {
  const displayContent = content || '';
  const isPlaceholder = !content;

  return (
    <div className="preview-card">
      <div className="preview-card-label" style={{ background: '#1877f2', color: 'white' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Facebook Preview
      </div>
      <div className="fb-post">
        {/* Header */}
        <div className="fb-header">
          <div className="fb-avatar">P</div>
          <div className="fb-meta">
            <div className="fb-name">Postline</div>
            <div className="fb-time-row">
              <span>Just now</span>
              <span>·</span>
              <Globe size={12} />
            </div>
          </div>
          <div className="fb-more-btn">
            <MoreHorizontal size={20} />
          </div>
        </div>

        {/* Content */}
        <div className="fb-content">
          {isPlaceholder ? (
            <span className="fb-content-placeholder">What's on your mind?</span>
          ) : (
            displayContent
          )}
        </div>

        {/* Image */}
        {mediaUrl && (
          <div className="fb-image-area">
            <img src={mediaUrl} alt="Post" />
          </div>
        )}

        {/* Reactions bar */}
        <div className="fb-reactions-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="fb-reaction-icons">
              <div className="fb-reaction-icon" style={{ background: '#1877f2' }}>👍</div>
              <div className="fb-reaction-icon" style={{ background: '#f33e58' }}>❤️</div>
              <div className="fb-reaction-icon" style={{ background: '#f7b928' }}>😆</div>
            </div>
            <span style={{ marginLeft: '4px' }}>24</span>
          </div>
          <span>3 comments · 2 shares</span>
        </div>

        <div className="fb-divider" />

        {/* Action buttons */}
        <div className="fb-actions">
          <div className="fb-action-btn">
            <ThumbsUp size={18} />
            Like
          </div>
          <div className="fb-action-btn">
            <MessageSquare size={18} />
            Comment
          </div>
          <div className="fb-action-btn">
            <Share2 size={18} />
            Share
          </div>
        </div>
      </div>
    </div>
  );
}
