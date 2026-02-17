import React from 'react';
import './CharacterCount.css';

const LIMITS = {
  twitter: { max: 280, label: 'X' },
  instagram: { max: 2200, label: 'Instagram' },
  facebook: { max: 63206, label: 'Facebook' },
  linkedin: { max: 3000, label: 'LinkedIn' },
};

export default function CharacterCount({ content, platforms }) {
  const length = content.length;

  return (
    <div className="char-count-bar">
      {platforms.map(p => {
        const limit = LIMITS[p];
        if (!limit) return null;
        const remaining = limit.max - length;
        const pct = Math.min((length / limit.max) * 100, 100);
        const isOver = remaining < 0;
        const isWarn = remaining < limit.max * 0.1 && remaining >= 0;

        return (
          <div key={p} className="char-count-item">
            <span className="char-count-label">{limit.label}</span>
            <div className="char-count-track">
              <div
                className={`char-count-fill ${isOver ? 'over' : isWarn ? 'warn' : ''}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className={`char-count-num ${isOver ? 'over' : isWarn ? 'warn' : ''}`}>
              {remaining}
            </span>
          </div>
        );
      })}
    </div>
  );
}
