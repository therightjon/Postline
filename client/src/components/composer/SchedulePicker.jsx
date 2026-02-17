import React from 'react';
import { Send, Clock } from 'lucide-react';
import './SchedulePicker.css';

export default function SchedulePicker({ mode, onModeChange, scheduledAt, onScheduleChange }) {
  return (
    <div className="schedule-picker">
      <div className="schedule-mode-toggle">
        <button
          className={`schedule-mode-btn ${mode === 'now' ? 'active' : ''}`}
          onClick={() => onModeChange('now')}
        >
          <Send size={16} />
          Publish Now
        </button>
        <button
          className={`schedule-mode-btn ${mode === 'schedule' ? 'active' : ''}`}
          onClick={() => onModeChange('schedule')}
        >
          <Clock size={16} />
          Schedule
        </button>
      </div>

      {mode === 'schedule' && (
        <div className="schedule-datetime">
          <input
            type="datetime-local"
            className="input schedule-input"
            value={scheduledAt ? formatDatetimeLocal(scheduledAt) : ''}
            min={formatDatetimeLocal(new Date())}
            onChange={(e) => onScheduleChange(e.target.value ? new Date(e.target.value) : null)}
          />
          {scheduledAt && (
            <p className="schedule-summary">
              Will be published on{' '}
              <strong>
                {scheduledAt.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDatetimeLocal(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
