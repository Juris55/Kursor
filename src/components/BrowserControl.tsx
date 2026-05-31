import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { browserControlService, type BrowserSession } from '../services/browserControl';
import type { BrowserProgress } from '../types/index';
import './BrowserControl.css';

interface BrowserControlProps {
  sessionId?: string;
  visible?: boolean;
}

export const BrowserControl: React.FC<BrowserControlProps> = ({ sessionId, visible = false }) => {
  const t = useTranslation();
  const [isVisible, setIsVisible] = useState(visible);
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [progress, setProgress] = useState<BrowserProgress>({
    status: 'idle',
    currentAction: undefined,
    completedActions: 0,
    totalActions: 0,
    percentage: 0,
    message: 'Waiting for task...',
  });
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!sessionId) {
      const defaultSession = browserControlService.getDefaultSession();
      setSession(defaultSession);
    } else {
      setSession(session);
    }

    // Subscribe to progress updates
    const unsub = browserControlService.onProgress((newProgress) => {
      setProgress(newProgress);
    });

    setUnsubscribe(() => unsub);

    return () => {
      unsub();
    };
  }, [sessionId]);

  const handleStop = () => {
    if (session) {
      browserControlService.closeSession(session.id);
      setIsVisible(false);
    }
  };

  const handleStart = () => {
    if (session) {
      browserControlService.startSession(session.id);
      setIsVisible(true);
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'executing':
        return '#3498db';
      case 'completed':
        return '#2ecc71';
      case 'error':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'executing':
        return '⏳';
      case 'completed':
        return '✓';
      case 'error':
        return '✕';
      default:
        return '•';
    }
  };

  if (!isVisible || progress.status === 'idle') {
    return (
      <button
        className="browser-control-toggle"
        onClick={handleStart}
        title={t('browser.startBrowser')}
      >
        {t('browser.title')}
      </button>
    );
  }

  return (
    <div className="browser-control-overlay">
      <div className="browser-control-container">
        <div className="browser-control-header">
          <h3>
            <span className="status-icon" style={{ color: getStatusColor() }}>
              {getStatusIcon()}
            </span>
            {t('browser.overlayTitle')}
          </h3>
          <button
            className="browser-control-close"
            onClick={handleStop}
            title={t('browser.stopExecution')}
          >
            ✕
          </button>
        </div>

        <div className="browser-control-content">
          <div className="action-info">
            <p className="current-action">
              <span className="label">{t('browser.progressLabel')}:</span>
              <span className="value">{progress.currentAction || t('browser.waitingForTask')}</span>
            </p>
            <p className="message">{progress.message}</p>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${progress.percentage}%`,
                backgroundColor: getStatusColor(),
              }}
            />
          </div>

          <div className="progress-stats">
            <span>
              {progress.completedActions} / {progress.totalActions}
            </span>
            <span>{Math.round(progress.percentage)}%</span>
          </div>

          <div className="actions">
            <button
              className="btn-stop"
              onClick={handleStop}
              disabled={progress.status === 'completed'}
            >
              {t('browser.stopExecution')}
            </button>
          </div>

          <div className="controls-info">
            <p>{t('browser.controlsLabel')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export a hook for easy access to browser control
export const useBrowserControl = (sessionId?: string) => {
  const [session, setSession] = useState<BrowserSession | null>(null);

  useEffect(() => {
    const s = sessionId
      ? (browserControlService as any).sessions.get(sessionId)
      : browserControlService.getDefaultSession();
    setSession(s);
  }, [sessionId]);

  return {
    session,
    startSession: () => session && browserControlService.startSession(session.id),
    closeSession: () => session && browserControlService.closeSession(session.id),
    click: (options: any) => session && browserControlService.click(options, session.id),
    scroll: (options: any) => session && browserControlService.scroll(options, session.id),
    type: (options: any) => session && browserControlService.type(options, session.id),
    navigate: (options: any) => session && browserControlService.navigate(options, session.id),
    executeActions: (actions: any[]) => session && browserControlService.executeActions(actions, session.id),
    getStatus: () => session ? browserControlService.getStatus(session.id) : null,
    takeScreenshot: () => session && browserControlService.takeScreenshot(session.id),
    getPageInfo: () => session && browserControlService.getPageInfo(session.id),
  };
};
