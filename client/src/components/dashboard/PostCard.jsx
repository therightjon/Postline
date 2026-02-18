import React from 'react';
import { Link } from 'react-router-dom';
import { Edit3, Trash2, Send, Clock, CheckCircle, XCircle, Instagram, Facebook, Twitter, Linkedin } from 'lucide-react';
import './PostCard.css';

const PLATFORM_META = {
  instagram: { label: 'Instagram', color: 'var(--color-instagram)', icon: Instagram },
  facebook: { label: 'Facebook', color: 'var(--color-facebook)', icon: Facebook },
  twitter: { label: 'X (Twitter)', color: 'var(--color-twitter)', icon: Twitter },
  linkedin: { label: 'LinkedIn', color: 'var(--color-linkedin)', icon: Linkedin },
};

const STATUS_ICONS = {
  draft: Edit3,
  scheduled: Clock,
  published: CheckCircle,
  failed: XCircle,
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PostCard({ post }) {
  const StatusIcon = STATUS_ICONS[post.status] || Edit3;

  return (
    <article className="card post-card">
      <div className="post-card-header">
        <div className="post-card-platforms">
          {post.platforms?.map(p => {
            const platform = PLATFORM_META[p];
            if (!platform) return null;
            const Icon = platform.icon;
            return (
              <span
                key={p}
                className="post-platform-badge"
                style={{
                  background: platform.color,
                  color: '#fff',
                  borderColor: platform.color,
                }}
              >
                <Icon size={12} />
                {platform.label}
              </span>
            );
          })}
        </div>
        <span className={`badge badge-${post.status}`}>
          <StatusIcon size={12} />
          {post.status}
        </span>
      </div>

      <p className="post-card-content">{post.content}</p>

      {post.mediaUrl && (
        <div className="post-card-media">
          <img src={post.mediaUrl} alt="Post media" />
        </div>
      )}

      <div className="post-card-footer">
        <div className="post-card-dates">
          <span className="post-card-date">
            Created {formatDate(post.createdAt)}
          </span>
          {post.scheduledAt && post.status === 'scheduled' && (
            <span className="post-card-date post-card-scheduled">
              <Clock size={12} />
              Scheduled for {formatDate(post.scheduledAt)}
            </span>
          )}
          {post.publishedAt && (
            <span className="post-card-date post-card-published">
              <CheckCircle size={12} />
              Published {formatDate(post.publishedAt)}
            </span>
          )}
        </div>
        <div className="post-card-actions">
          <Link to={`/compose/${post.id}`}>
            <button className="ghost small">
              <Edit3 size={14} />
              Edit
            </button>
          </Link>
          {post.status === 'draft' && (
            <button className="small">
              <Send size={14} />
              Publish
            </button>
          )}
        </div>
      </div>

      {post.error && (
        <div className="post-card-error" role="alert" data-variant="error">
          {post.error}
        </div>
      )}
    </article>
  );
}
