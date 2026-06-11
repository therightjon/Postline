import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Link2,
  Unlink,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { accountsApi } from '../services/api';
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
    requirements: 'Requires a LinkedIn developer app with Sign In + Share access.',
  },
];

export default function AccountsPage() {
  // accounts keyed by platform id: { id, platform, platformName, platformUsername, connectedAt }
  const [accounts, setAccounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // platform id currently connecting/disconnecting
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const list = await accountsApi.list();
      const byPlatform = {};
      (list || []).forEach((acc) => {
        byPlatform[acc.platform] = acc;
      });
      setAccounts(byPlatform);
    } catch (err) {
      setError('Could not load connected accounts. Is the API running and are you signed in?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle the OAuth return: the provider callback redirects here with either
  // ?finalize=<id>&platform=<p> (complete the connection as the signed-in user)
  // or ?error=<code>.
  useEffect(() => {
    const finalizeId = searchParams.get('finalize');
    const returnedError = searchParams.get('error');

    if (returnedError) {
      setError('The connection was cancelled or could not be completed.');
      setSearchParams({}, { replace: true });
      loadAccounts();
      return;
    }

    if (finalizeId) {
      setBusy(searchParams.get('platform') || 'finalize');
      accountsApi
        .finalize(finalizeId)
        .then(() => {
          setError(null);
        })
        .catch(() => {
          setError('Could not complete the connection with the provider.');
        })
        .finally(() => {
          setBusy(null);
          setSearchParams({}, { replace: true });
          loadAccounts();
        });
      return;
    }

    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect(platformId) {
    setError(null);
    setBusy(platformId);
    try {
      const { authUrl } = await accountsApi.connect(platformId);
      if (!authUrl) throw new Error('No authorization URL returned');
      // Hand off to the provider's consent screen.
      window.location.href = authUrl;
    } catch (err) {
      setError(`Could not start the ${platformId} connection. The platform may not be configured on the server yet.`);
      setBusy(null);
    }
  }

  async function handleDisconnect(account) {
    setError(null);
    setBusy(account.platform);
    try {
      await accountsApi.disconnect(account.id);
      await loadAccounts();
    } catch (err) {
      setError('Could not disconnect the account.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="accounts-page animate-fade-in">
      <div className="page-header">
        <h1>Connected Accounts</h1>
        <p>Manage your social media platform connections</p>
      </div>

      {error && (
        <div className="card" role="alert" data-variant="error" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="accounts-grid">
        {PLATFORMS.map(platform => {
          const account = accounts[platform.id];
          const Icon = platform.icon;
          const isConnected = !!account;
          const isBusy = busy === platform.id;

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
                    <span className="account-info-name">{account.platformUsername || account.platformName}</span>
                    <span className="account-info-date">
                      Connected {new Date(account.connectedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="account-actions">
                {isConnected ? (
                  <button
                    data-variant="danger"
                    className="small"
                    onClick={() => handleDisconnect(account)}
                    disabled={isBusy}
                  >
                    <Unlink size={14} />
                    {isBusy ? 'Working…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    className="small"
                    onClick={() => handleConnect(platform.id)}
                    disabled={isBusy || loading}
                  >
                    <Link2 size={14} />
                    {isBusy ? 'Connecting…' : `Connect ${platform.name}`}
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
