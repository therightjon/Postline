import React, { useState } from 'react';
import {
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Link2,
  Unlink,
  ExternalLink,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import './AccountsPage.css';

const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'var(--color-instagram)',
    description: 'Publish photos and reels to your Instagram Business account.',
    requirements: 'Requires an Instagram Business or Creator account connected to a Facebook Page.',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'var(--color-facebook)',
    description: 'Share posts to your Facebook Pages.',
    requirements: 'Requires a Facebook Page with manage permissions.',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: Twitter,
    color: 'var(--color-twitter)',
    description: 'Post tweets with text and media.',
    requirements: 'Free tier: up to 1,500 tweets per month.',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'var(--color-linkedin)',
    description: 'Share professional content on your LinkedIn profile or page.',
    requirements: 'Requires LinkedIn Marketing Developer Platform access.',
  },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState({});

  function handleConnect(platformId) {
    setAccounts(prev => ({
      ...prev,
      [platformId]: {
        connected: true,
        name: `Demo Account`,
        connectedAt: new Date().toISOString(),
      },
    }));
  }

  function handleDisconnect(platformId) {
    setAccounts(prev => {
      const next = { ...prev };
      delete next[platformId];
      return next;
    });
  }

  return (
    <div className="accounts-page animate-fade-in">
      <div className="page-header">
        <h1>Connected Accounts</h1>
        <p>Manage your social media platform connections</p>
      </div>

      <div className="accounts-grid">
        {PLATFORMS.map(platform => {
          const account = accounts[platform.id];
          const Icon = platform.icon;
          const isConnected = !!account?.connected;

          return (
            <article key={platform.id} className="card account-card">
              <div className="account-card-header">
                <div
                  className={`account-icon${platform.id === 'twitter' ? ' account-icon-twitter' : ''}`}
                  style={{
                    background: `${platform.color}18`,
                    color: platform.color,
                  }}
                >
                  <Icon size={24} />
                </div>
                <div className="account-status">
                  {isConnected ? (
                    <span className="status-connected">
                      <CheckCircle size={14} />
                      Connected
                    </span>
                  ) : (
                    <span className="status-disconnected">
                      <AlertCircle size={14} />
                      Not connected
                    </span>
                  )}
                </div>
              </div>

              <h3 className="account-name">{platform.name}</h3>
              <div className="account-body">
                <p className="account-desc">{platform.description}</p>
                {isConnected && (
                  <div className="account-info">
                    <span className="account-info-name">{account.name}</span>
                    <span className="account-info-date">
                      Connected {new Date(account.connectedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="account-actions">
                {isConnected ? (
                  <>
                    <button
                      data-variant="danger"
                      className="small"
                      onClick={() => handleDisconnect(platform.id)}
                    >
                      <Unlink size={14} />
                      Disconnect
                    </button>
                    <button className="ghost small">
                      <ExternalLink size={14} />
                      Settings
                    </button>
                  </>
                ) : (
                  <button
                    className="small"
                    onClick={() => handleConnect(platform.id)}
                  >
                    <Link2 size={14} />
                    Connect {platform.name}
                  </button>
                )}
              </div>

              <div className="account-requirement">
                <AlertCircle size={12} />
                {platform.requirements}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
