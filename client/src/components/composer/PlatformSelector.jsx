import React from 'react';
import { Instagram, Facebook, Twitter, Linkedin } from 'lucide-react';
import './PlatformSelector.css';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'var(--color-instagram)' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'var(--color-facebook)' },
  { id: 'twitter', label: 'X (Twitter)', icon: Twitter, color: 'var(--color-twitter)' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'var(--color-linkedin)' },
];

export default function PlatformSelector({ selected, onToggle }) {
  return (
    <div className="platform-selector">
      {PLATFORMS.map(({ id, label, icon: Icon, color }) => {
        const isSelected = selected.includes(id);
        return (
          <button
            key={id}
            className={`platform-toggle ${isSelected ? 'active' : ''}`}
            onClick={() => onToggle(id)}
            style={isSelected ? {
              '--platform-color': color,
              borderColor: `${color}60`,
              background: `${color}15`,
            } : {}}
          >
            <Icon size={18} style={isSelected ? { color } : {}} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
