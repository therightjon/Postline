import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { postsApi } from '../services/api';
import PostCard from '../components/dashboard/PostCard';
import { PenSquare, Filter } from 'lucide-react';
import './DashboardPage.css';

const STATUS_FILTERS = ['all', 'draft', 'scheduled', 'published', 'failed'];

// Demo data for when API is not connected
const DEMO_POSTS = [
  {
    id: '1',
    content: '🚀 Excited to announce our new product launch! Stay tuned for something amazing coming your way this week. #innovation #launch',
    platforms: ['twitter', 'linkedin', 'facebook'],
    status: 'published',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    mediaUrl: null,
  },
  {
    id: '2',
    content: 'Behind the scenes look at our creative process. We believe great design starts with understanding the user. What do you think makes a product truly great? 🎨✨',
    platforms: ['instagram', 'facebook'],
    status: 'scheduled',
    createdAt: new Date(Date.now() - 43200000).toISOString(),
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    mediaUrl: null,
  },
  {
    id: '3',
    content: 'Quick tip: Consistency is key in social media marketing. Post regularly and engage with your audience to build a loyal following. 📈',
    platforms: ['twitter', 'linkedin'],
    status: 'draft',
    createdAt: new Date().toISOString(),
    mediaUrl: null,
  },
  {
    id: '4',
    content: 'We\'re hiring! Join our team of passionate creators and innovators. Check the link in bio for open positions. 💼',
    platforms: ['instagram', 'linkedin', 'facebook', 'twitter'],
    status: 'failed',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    mediaUrl: null,
    error: 'Instagram: Token expired',
  },
];

export default function DashboardPage() {
  const [posts, setPosts] = useState(DEMO_POSTS);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      setLoading(true);
      const data = await postsApi.list();
      if (data && data.length > 0) {
        setPosts(data);
      }
    } catch (err) {
      // API not connected — keep demo data as fallback
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(post) {
    setError(null);
    try {
      await postsApi.publish(post.id);
      await loadPosts();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not publish the post. Please try again.');
    }
  }

  const filteredPosts = filter === 'all'
    ? posts
    : posts.filter(p => p.status === filter);

  const stats = {
    total: posts.length,
    draft: posts.filter(p => p.status === 'draft').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    failed: posts.filter(p => p.status === 'failed').length,
  };

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Dashboard</h1>
            <p>Manage and monitor your social media posts</p>
          </div>
          <Link to="/compose" className="button">
            <PenSquare size={16} />
            Create Post
          </Link>
        </div>
      </div>

      {error && (
        <div className="card" role="alert" data-variant="error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="stats-grid">
        <article className="card stat-card">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total Posts</span>
        </article>
        <article className="card stat-card">
          <span className="stat-number" style={{ color: 'var(--color-info)' }}>{stats.scheduled}</span>
          <span className="stat-label">Scheduled</span>
        </article>
        <article className="card stat-card">
          <span className="stat-number" style={{ color: 'var(--color-success)' }}>{stats.published}</span>
          <span className="stat-label">Published</span>
        </article>
        <article className="card stat-card">
          <span className="stat-number" style={{ color: 'var(--color-error)' }}>{stats.failed}</span>
          <span className="stat-label">Failed</span>
        </article>
      </div>

      <div className="filter-bar">
        <Filter size={16} />
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            className={`filter-chip ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s}
            {s !== 'all' && <span className="filter-count">{stats[s]}</span>}
          </button>
        ))}
      </div>

      <div className="posts-list">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, marginBottom: 12, borderRadius: 'var(--radius)' }} />
          ))
        ) : filteredPosts.length === 0 ? (
          <article className="card empty-state">
            <PenSquare size={40} style={{ color: 'var(--muted-foreground)' }} />
            <h3>No posts yet</h3>
            <p>Create your first post to get started</p>
            <Link to="/compose" className="button">Create Post</Link>
          </article>
        ) : (
          filteredPosts.map(post => (
            <PostCard key={post.id} post={post} onPublish={handlePublish} />
          ))
        )}
      </div>
    </div>
  );
}
