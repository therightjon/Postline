import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Zap, ArrowRight, Code } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const { isAuthenticated, loading, login, devMode } = useAuth();

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

        <button className="login-btn" onClick={login}>
          {devMode ? (
            <>
              <Code size={18} />
              Enter Dev Mode
            </>
          ) : (
            <>
              Sign in to get started
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {devMode && (
          <p className="login-dev-hint">
            B2C not configured — using mock auth for local preview
          </p>
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
