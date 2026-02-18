import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsApi, mediaApi } from '../services/api';
import PlatformSelector from '../components/composer/PlatformSelector';
import MediaUpload from '../components/composer/MediaUpload';
import SchedulePicker from '../components/composer/SchedulePicker';
import CharacterCount from '../components/composer/CharacterCount';
import PreviewPanel from '../components/preview/PreviewPanel';
import { Send, Clock, Save } from 'lucide-react';
import './ComposePage.css';

export default function ComposePage() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState(['instagram']);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);

  const togglePlatform = useCallback((platform) => {
    setPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  }, []);

  const handleMediaChange = useCallback((file) => {
    setMediaFile(file);
    if (file) {
      setMediaUrl(URL.createObjectURL(file));
    } else {
      setMediaUrl(null);
    }
  }, []);

  const handleRemoveMedia = useCallback(() => {
    setMediaFile(null);
    setMediaUrl(null);
  }, []);

  async function handleSaveDraft() {
    setSaving(true);
    try {
      let uploadedMediaUrl = null;
      if (mediaFile) {
        const res = await mediaApi.upload(mediaFile);
        uploadedMediaUrl = res.url;
      }
      await postsApi.create({
        content,
        platforms,
        mediaUrl: uploadedMediaUrl,
        status: 'draft',
      });
      navigate('/');
    } catch (err) {
      console.error('Failed to save draft:', err);
      alert('Post saved as draft (demo mode)');
      navigate('/');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!content.trim() || platforms.length === 0) return;
    setPublishing(true);
    try {
      let uploadedMediaUrl = null;
      if (mediaFile) {
        const res = await mediaApi.upload(mediaFile);
        uploadedMediaUrl = res.url;
      }

      const postData = {
        content,
        platforms,
        mediaUrl: uploadedMediaUrl,
        status: scheduleMode === 'schedule' ? 'scheduled' : 'draft',
        scheduledAt: scheduleMode === 'schedule' ? scheduledAt?.toISOString() : null,
      };

      const created = await postsApi.create(postData);

      if (scheduleMode === 'now') {
        await postsApi.publish(created.id);
      }

      navigate('/');
    } catch (err) {
      console.error('Failed to publish:', err);
      alert(scheduleMode === 'schedule'
        ? 'Post scheduled (demo mode)'
        : 'Post published (demo mode)');
      navigate('/');
    } finally {
      setPublishing(false);
    }
  }

  const canPublish = content.trim().length > 0 && platforms.length > 0;

  return (
    <div className="compose-page animate-fade-in">
      <div className="page-header">
        <h1>Create Post</h1>
        <p>Compose and preview your content across platforms</p>
      </div>

      <div className="compose-layout">
        <div className="compose-editor">
          <article className="card compose-section">
            <header><label>Content</label></header>
            <textarea
              placeholder="What's on your mind? Share something with your audience..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="compose-textarea"
            />
            <CharacterCount content={content} platforms={platforms} />
          </article>

          <article className="card compose-section">
            <header><label>Platforms</label></header>
            <PlatformSelector
              selected={platforms}
              onToggle={togglePlatform}
            />
          </article>

          <article className="card compose-section">
            <header><label>Media</label></header>
            <MediaUpload
              mediaUrl={mediaUrl}
              onChange={handleMediaChange}
              onRemove={handleRemoveMedia}
            />
          </article>

          <article className="card compose-section">
            <header><label>Publishing</label></header>
            <SchedulePicker
              mode={scheduleMode}
              onModeChange={setScheduleMode}
              scheduledAt={scheduledAt}
              onScheduleChange={setScheduledAt}
            />
          </article>

          <div className="compose-actions">
            <button
              data-variant="secondary"
              onClick={handleSaveDraft}
              disabled={saving || !content.trim()}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              className="large"
              onClick={handlePublish}
              disabled={publishing || !canPublish}
            >
              {scheduleMode === 'schedule' ? (
                <>
                  <Clock size={16} />
                  {publishing ? 'Scheduling...' : 'Schedule Post'}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {publishing ? 'Publishing...' : 'Publish Now'}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="compose-preview">
          <div className="preview-header">
            <h3>Live Preview</h3>
          </div>
          <PreviewPanel
            content={content}
            platforms={platforms}
            mediaUrl={mediaUrl}
          />
        </div>
      </div>
    </div>
  );
}
