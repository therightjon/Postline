import React, { useState, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { postsApi } from '../services/api';
import './CalendarPage.css';

// Demo scheduled posts
const DEMO_SCHEDULED = [
  {
    id: '2',
    content: 'Behind the scenes look at our creative process...',
    platforms: ['instagram', 'facebook'],
    scheduledAt: (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString(); })(),
  },
  {
    id: '5',
    content: 'Weekly roundup: Top 5 social media trends you need to know about...',
    platforms: ['twitter', 'linkedin'],
    scheduledAt: (() => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(14, 30, 0, 0); return d.toISOString(); })(),
  },
  {
    id: '6',
    content: 'New blog post: How to grow your audience organically 🌱',
    platforms: ['facebook', 'linkedin', 'twitter'],
    scheduledAt: (() => { const d = new Date(); d.setDate(d.getDate() + 5); d.setHours(9, 0, 0, 0); return d.toISOString(); })(),
  },
];

const PLATFORM_BADGES = {
  instagram: { short: 'IG', color: 'var(--color-instagram)' },
  facebook: { short: 'FB', color: 'var(--color-facebook)' },
  twitter: { short: 'X', color: 'var(--color-twitter)' },
  linkedin: { short: 'LI', color: 'var(--color-linkedin)' },
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState(DEMO_SCHEDULED);

  useEffect(() => {
    let cancelled = false;
    postsApi
      .list('scheduled')
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setEvents(data);
        }
      })
      .catch(() => {
        // API not connected — keep demo data as fallback
      });
    return () => { cancelled = true; };
  }, []);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function getPostsForDay(day) {
    return events.filter(post => {
      const d = new Date(post.scheduledAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  const today = new Date();
  const isToday = (day) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="cal-day empty" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const posts = getPostsForDay(day);
    days.push(
      <div key={day} className={`cal-day ${isToday(day) ? 'today' : ''}`}>
        <span className="cal-day-num">{day}</span>
        {posts.map(post => (
          <div key={post.id} className="cal-event">
            <div className="cal-event-time">
              <Clock size={10} />
              {new Date(post.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div className="cal-event-text">{post.content.slice(0, 40)}...</div>
            <div className="cal-event-platforms">
              {post.platforms.map(p => {
                const badge = PLATFORM_BADGES[p];
                return badge ? (
                  <span key={p} className="cal-platform-dot" style={{ background: badge.color }} title={p} />
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="calendar-page animate-fade-in">
      <div className="page-header">
        <h1>Calendar</h1>
        <p>View your scheduled posts at a glance</p>
      </div>

      <article className="card cal-controls">
        <button className="ghost" onClick={prevMonth} title="Previous month" style={{ padding: '6px' }}>
          <ChevronLeft size={20} />
        </button>
        <h2 className="cal-month">{monthName}</h2>
        <button className="ghost" onClick={nextMonth} title="Next month" style={{ padding: '6px' }}>
          <ChevronRight size={20} />
        </button>
      </article>

      <article className="card cal-grid">
        <div className="cal-header-row">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="cal-header-cell">{d}</div>
          ))}
        </div>
        <div className="cal-body">
          {days}
        </div>
      </article>
    </div>
  );
}
