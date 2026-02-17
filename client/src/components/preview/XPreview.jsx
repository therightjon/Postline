import React from 'react';
import { Heart, MessageCircle, Repeat2, BarChart3, Bookmark, Share, MoreHorizontal, Check } from 'lucide-react';

export default function XPreview({ content, mediaUrl }) {
  const displayContent = content || '';
  const isPlaceholder = !content;
  const charCount = content ? content.length : 0;
  const isOver = charCount > 280;

  return (
    <div className="preview-card">
      <div className="preview-card-label" style={{ background: '#000', color: '#e7e9ea', border: '1px solid #2f3336' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#e7e9ea"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        X Preview
      </div>
      <div className="x-post">
        {/* Header row */}
        <div className="x-header">
          <div className="x-avatar">P</div>
          <div className="x-meta">
            <div className="x-name-row">
              <span className="x-display-name">Postline</span>
              <div className="x-verified">
                <Check size={12} strokeWidth={3} />
              </div>
              <span className="x-handle">@postline</span>
              <span className="x-dot">·</span>
              <span className="x-time">now</span>
            </div>
          </div>
          <div className="x-more-btn">
            <MoreHorizontal size={18} />
          </div>
        </div>

        {/* Post content — aligned with text, not avatar */}
        <div className={`x-content ${isOver ? 'x-content-over' : ''}`}>
          {isPlaceholder ? (
            <span className="x-content-placeholder">What is happening?!</span>
          ) : isOver ? (
            <>
              {displayContent.slice(0, 280)}
              <span className="x-content-over-fade">{displayContent.slice(280)}</span>
            </>
          ) : (
            displayContent
          )}
        </div>

        {/* Image */}
        {mediaUrl && (
          <div className="x-image-area">
            <img src={mediaUrl} alt="Post" />
          </div>
        )}

        {/* Engagement actions */}
        <div className="x-actions">
          <span className="x-action reply">
            <MessageCircle size={18} />
          </span>
          <span className="x-action repost">
            <Repeat2 size={18} />
          </span>
          <span className="x-action like">
            <Heart size={18} />
          </span>
          <span className="x-action views">
            <BarChart3 size={18} />
          </span>
          <span className="x-action bookmark">
            <Bookmark size={18} />
          </span>
          <span className="x-action share">
            <Share size={18} />
          </span>
        </div>
      </div>
    </div>
  );
}
