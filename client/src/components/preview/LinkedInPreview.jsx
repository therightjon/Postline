import React, { useState } from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, MoreHorizontal, Globe } from 'lucide-react';

export default function LinkedInPreview({ content, mediaUrl }) {
  const displayContent = content || '';
  const isPlaceholder = !content;
  const isLong = displayContent.length > 200;
  const [expanded, setExpanded] = useState(false);

  // Render content with hashtag highlighting
  function renderContent(text) {
    return text.split(/(#\w+)/g).map((part, i) =>
      part.startsWith('#') ? (
        <span key={i} className="li-hashtag">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  const shownContent = isLong && !expanded ? displayContent.slice(0, 200) : displayContent;

  return (
    <div className="preview-card">
      <div className="preview-card-label" style={{ background: '#0a66c2', color: 'white' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        LinkedIn Preview
      </div>
      <div className="li-post">
        {/* Header */}
        <div className="li-header">
          <div className="li-avatar">P</div>
          <div className="li-meta">
            <div className="li-name">Postline</div>
            <div className="li-headline">Social Media Management Platform</div>
            <div className="li-time-row">
              <span>1m</span>
              <span>·</span>
              <Globe size={14} />
            </div>
          </div>
          <div className="li-more-btn">
            <MoreHorizontal size={20} />
          </div>
        </div>

        {/* Content */}
        <div className="li-content">
          {isPlaceholder ? (
            <span className="li-content-placeholder">Share your thoughts with your network...</span>
          ) : (
            <>
              {renderContent(shownContent)}
              {isLong && !expanded && (
                <>
                  {'... '}
                  <span className="li-see-more" onClick={() => setExpanded(true)}>see more</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Image */}
        {mediaUrl && (
          <div className="li-image-area">
            <img src={mediaUrl} alt="Post" />
          </div>
        )}

        {/* Reactions bar */}
        <div className="li-reactions-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className="li-reaction-emojis">
              <div className="li-reaction-emoji" style={{ background: '#378fe9' }}>👍</div>
              <div className="li-reaction-emoji" style={{ background: '#df704d' }}>🎉</div>
              <div className="li-reaction-emoji" style={{ background: '#c37d16' }}>💡</div>
            </div>
            <span style={{ marginLeft: '4px' }}>18</span>
          </div>
          <span>4 comments · 1 repost</span>
        </div>

        <div className="li-divider" />

        {/* Action buttons */}
        <div className="li-actions">
          <div className="li-action-btn">
            <ThumbsUp size={20} />
            Like
          </div>
          <div className="li-action-btn">
            <MessageSquare size={20} />
            Comment
          </div>
          <div className="li-action-btn">
            <Repeat2 size={20} />
            Repost
          </div>
          <div className="li-action-btn">
            <Send size={20} />
            Send
          </div>
        </div>
      </div>
    </div>
  );
}
