import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsApi, mediaApi } from '../services/api';
import { Instagram, Facebook, Twitter, Linkedin, Send, Clock, Save, Copy } from 'lucide-react';
import PlatformSelector from '../components/composer/PlatformSelector';
import MediaUpload from '../components/composer/MediaUpload';
import SchedulePicker from '../components/composer/SchedulePicker';
import CharacterCount from '../components/composer/CharacterCount';
import PreviewPanel from '../components/preview/PreviewPanel';
import './ComposePage.css';

const PLATFORM_INFO = {
  instagram: { label: 'Instagram', icon: Instagram, color: '#E1306C' },
  facebook: { label: 'Facebook', icon: Facebook, color: '#1877F2' },
  twitter: { label: 'X', icon: Twitter, color: '#1DA1F2' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
};

export default function ComposePage() {
  const navigate = useNavigate();
  const [platformContent, setPlatformContent] = useState({ all: '' });
  const [activeContentTab, setActiveContentTab] = useState('all');
  const [platforms, setPlatforms] = useState([]);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduledAt, setScheduledAt] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target)) {
        setShowCopyMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePlatform = useCallback((platform) => {
    setPlatforms(prev => {
      const isRemoving = prev.includes(platform);
      if (isRemoving) {
        if (activeContentTab === platform) {
          setActiveContentTab('all');
        }
        return prev.filter(p => p !== platform);
      } else {
        setPlatformContent(prevContent => ({
          ...prevContent,
          [platform]: prevContent[platform] !== undefined ? prevContent[platform] : prevContent.all,
        }));
        setActiveContentTab(platform);
        return [...prev, platform];
      }
    });
  }, [activeContentTab]);

  const handleContentChange = useCallback((e) => {
    setPlatformContent(prev => ({
      ...prev,
      [activeContentTab]: e.target.value,
    }));
  }, [activeContentTab]);

  const handleCopyFrom = useCallback((sourceTab) => {
    setPlatformContent(prev => ({
      ...prev,
      [activeContentTab]: prev[sourceTab] || '',
    }));
    setShowCopyMenu(false);
  }, [activeContentTab]);

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
        uploadedMediaUrl = res.blobUrl || res.url;
      }
      const effectiveContent = {};
      platforms.forEach(p => {
        effectiveContent[p] = platformContent[p] !== undefined ? platformContent[p] : platformContent.all;
      });
      await postsApi.create({
        content: platformContent.all,
        platformContent: effectiveContent,
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
    if (!canPublish) return;
    setPublishing(true);
    try {
      let uploadedMediaUrl = null;
      if (mediaFile) {
        const res = await mediaApi.upload(mediaFile);
        uploadedMediaUrl = res.blobUrl || res.url;
      }

      const effectiveContent = {};
      platforms.forEach(p => {
        effectiveContent[p] = platformContent[p] !== undefined ? platformContent[p] : platformContent.all;
      });

      const postData = {
        content: platformContent.all,
        platformContent: effectiveContent,
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

  const currentContent = platformContent[activeContentTab] ?? '';
  const canPublish = platforms.length > 0 && platforms.some(p =>
    (platformContent[p] || platformContent.all || '').trim().length > 0
  );
  const copySources = (() => {
    const sources = [];
    if (activeContentTab !== 'all' && platformContent.all) {
      sources.push({ id: 'all', label: 'All Platforms' });
    }
    platforms.forEach(p => {
      if (p !== activeContentTab && platformContent[p]) {
        const info = PLATFORM_INFO[p];
        if (info) sources.push({ id: p, label: info.label, icon: info.icon });
      }
    });
    return sources;
  })();

  return (
    <div className="compose-page animate-fade-in">
      <div className="page-header">
        <h1>Create Post</h1>
        <p>Compose and preview your content across platforms</p>
      </div>

      <div className="compose-layout">
        <div className="compose-editor">
          <article className="card compose-section content-section">
            <div className="content-tabs">
              <button
                className={`content-tab ${activeContentTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveContentTab('all')}
              >
                All Platforms
              </button>
              {platforms.map(p => {
                const info = PLATFORM_INFO[p];
                if (!info) return null;
                const Icon = info.icon;
                return (
                  <button
                    key={p}
                    className={`content-tab ${activeContentTab === p ? 'active' : ''}`}
                    onClick={() => setActiveContentTab(p)}
                    style={activeContentTab === p ? { '--tab-color': info.color } : {}}
                  >
                    <Icon size={14} />
                    <span>{info.label}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              placeholder={activeContentTab === 'all'
                ? "What's on your mind? Share something with your audience..."
                : `Customize your ${PLATFORM_INFO[activeContentTab]?.label || ''} content...`
              }
              value={currentContent}
              onChange={handleContentChange}
              rows={6}
              className="compose-textarea"
            />

            <div className="content-bottom-bar">
              {activeContentTab !== 'all' && copySources.length > 0 && (
                <div className="copy-from-wrapper" ref={copyMenuRef}>
                  <button
                    className="copy-from-btn"
                    onClick={() => setShowCopyMenu(!showCopyMenu)}
                  >
                    <Copy size={14} />
                    Copy from…
                  </button>
                  {showCopyMenu && (
                    <div className="copy-from-menu">
                      {copySources.map(src => {
                        const SrcIcon = src.icon;
                        return (
                          <button
                            key={src.id}
                            className="copy-from-option"
                            onClick={() => handleCopyFrom(src.id)}
                          >
                            {SrcIcon && <SrcIcon size={14} />}
                            {src.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <CharacterCount
                content={currentContent}
                platforms={activeContentTab === 'all' ? platforms : [activeContentTab]}
              />
            </div>
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
              disabled={saving || !currentContent.trim()}
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
            content={platformContent.all}
            platformContent={platformContent}
            platforms={platforms}
            mediaUrl={mediaUrl}
          />
        </div>
      </div>
    </div>
  );
}
