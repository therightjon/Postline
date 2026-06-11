import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Zap, ArrowRight, Code, Lock, Github, Facebook, LogIn } from 'lucide-react';
import { authApi } from '../services/api';
import './LoginPage.css';

const OIDC_ICONS = {
  github: Github,
  facebook: Facebook,
};

const OIDC_ERRORS = {
  not_allowed: 'That account is not allowed on this Postline instance.',
  login_failed: 'Sign-in with the provider failed. Please try again.',
};

export default function LoginPage() {
  const { isAuthenticated, loading, login, loginDev, loginWithGrant, providers, devMode } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Handle the OIDC return: ?grant=<one-time id> on success, ?error=<code> on failure.
  useEffect(() => {
    const grantId = searchParams.get('grant');
    const oidcError = searchParams.get('error');

    if (oidcError) {
      setError(OIDC_ERRORS[oidcError] || OIDC_ERRORS.login_failed);
      setSearchParams({}, { replace: true });
      return;
    }
    if (grantId) {
      setSubmitting(true);
      loginWithGrant(grantId)
        .catch((err) => {
          setError(err?.response?.data?.error || 'Sign-in expired. Please try again.');
        })
        .finally(() => {
          setSubmitting(false);
          setSearchParams({}, { replace: true });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="login-page">
        <div className="skeleton" style={{ width: 200, height: 24 }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const passwordEnabled = !!providers?.password;
  const oidcProviders = providers?.oidc || [];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
    } catch (err) {
      setError(err?.response?.data?.error || 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDevLogin() {
    setSubmitting(true);
    setError(null);
    try {
      await loginDev();
    } catch {
      setError('Dev sign-in failed. Is the API running with ALLOW_DEV_AUTH=true?');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <article className="card login-card animate-fade-in">
        <div className="login-logo">
          <Zap size={36} />
        </div>
        <h1 className="login-title">
          Welcome to <span className="brand-text">Postline</span>
        </h1>
        <p className="login-subtitle">
          Create, preview, schedule, and publish your social media content across
          Instagram, Facebook, X, and LinkedIn — all from one place.
        </p>

        {passwordEnabled && (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-password-row">
              <Lock size={16} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <button className="login-btn" type="submit" disabled={submitting || !password}>
              {submitting ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        {oidcProviders.length > 0 && (
          <div className="login-oidc">
            {passwordEnabled && <div className="login-divider">or</div>}
            {oidcProviders.map((p) => {
              const Icon = OIDC_ICONS[p.id] || LogIn;
              return (
                <a key={p.id} className="login-btn login-oidc-btn" href={authApi.oidcStartUrl(p.id)}>
                  <Icon size={18} />
                  Continue with {p.name}
                </a>
              );
            })}
          </div>
        )}

        {devMode && (
          <>
            <button className="login-btn" onClick={handleDevLogin} disabled={submitting}>
              <Code size={18} />
              Enter Dev Mode
            </button>
            <p className="login-dev-hint">
              No admin password configured — using the local dev session
            </p>
          </>
        )}

        {!passwordEnabled && !devMode && oidcProviders.length === 0 && (
          <p className="login-dev-hint">
            No sign-in method is configured. Set ADMIN_PASSWORD_HASH on the server
            (node scripts/hash-password.mjs --generate).
          </p>
        )}

        {error && (
          <p className="login-error" role="alert">{error}</p>
        )}

        <div className="login-platforms">
          <div className="login-platform-icons">
            <span className="platform-icon" style={{ background: 'var(--color-instagram)' }}>IG</span>
            <span className="platform-icon" style={{ background: 'var(--color-facebook)' }}>FB</span>
            <span className="platform-icon" style={{ background: 'var(--color-twitter)' }}>X</span>
            <span className="platform-icon" style={{ background: 'var(--color-linkedin)' }}>LI</span>
          </div>
          <span className="login-platform-label">Supports 4 major platforms</span>
        </div>
      </article>
    </div>
  );
}
