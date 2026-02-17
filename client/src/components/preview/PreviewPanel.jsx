import React from 'react';
import InstagramPreview from './InstagramPreview';
import FacebookPreview from './FacebookPreview';
import XPreview from './XPreview';
import LinkedInPreview from './LinkedInPreview';
import './PreviewPanel.css';

const PREVIEW_MAP = {
  instagram: InstagramPreview,
  facebook: FacebookPreview,
  twitter: XPreview,
  linkedin: LinkedInPreview,
};

export default function PreviewPanel({ content, platforms, mediaUrl }) {
  if (platforms.length === 0) {
    return (
      <div className="preview-empty glass-card">
        <p>Select a platform to see a preview</p>
      </div>
    );
  }

  return (
    <div className="preview-panel">
      {platforms.map(p => {
        const Preview = PREVIEW_MAP[p];
        if (!Preview) return null;
        return (
          <Preview key={p} content={content} mediaUrl={mediaUrl} />
        );
      })}
    </div>
  );
}
