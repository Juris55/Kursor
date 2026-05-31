import type { BrowserAction, BrowserProgress } from '../types/index';

export interface BrowserSession {
  id: string;
  window?: Window;
  isActive: boolean;
  lastAction?: BrowserAction;
  progress: BrowserProgress;
}

export interface ClickOptions {
  selector?: string;
  x?: number;
  y?: number;
}

export interface ScrollOptions {
  direction: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export interface TypeOptions {
  selector?: string;
  text: string;
  delay?: number;
}

export interface NavigateOptions {
  url: string;
}

class BrowserControlService {
  private sessions: Map<string, BrowserSession> = new Map();
  private progressCallbacks: Array<(progress: BrowserProgress) => void> = [];

  /**
   * Create a new browser session
   */
  createSession(): BrowserSession {
    const id = `session-${Date.now()}`;
    const session: BrowserSession = {
      id,
      isActive: false,
      progress: {
        status: 'idle',
        currentAction: undefined,
        completedActions: 0,
        totalActions: 0,
        percentage: 0,
        message: 'Waiting for task...',
      },
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Get or create default session
   */
  getDefaultSession(): BrowserSession {
    let session = Array.from(this.sessions.values()).find(s => s.isActive);
    if (!session) {
      session = this.createSession();
    }
    return session;
  }

  /**
   * Start browser session
   */
  startSession(sessionId?: string): BrowserSession {
    const session = sessionId 
      ? this.sessions.get(sessionId) || this.createSession()
      : this.getDefaultSession();
    
    session.isActive = true;
    session.progress.status = 'ready';
    session.progress.message = 'Browser ready';
    this.notifyProgress(session.progress);
    return session;
  }

  /**
   * Close browser session
   */
  closeSession(sessionId?: string): void {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    if (session) {
      session.isActive = false;
      session.progress.status = 'idle';
      session.progress.message = 'Browser closed';
      this.notifyProgress(session.progress);
    }
  }

  /**
   * Click on an element
   */
  async click(options: ClickOptions, sessionId?: string): Promise<void> {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    if (!session?.isActive) {
      throw new Error('Browser session is not active');
    }

    try {
      this.updateProgress(session, 'executing', 'Click');

      if (options.selector) {
        const element = document.querySelector(options.selector) as HTMLElement;
        if (!element) {
          throw new Error(`Element not found: ${options.selector}`);
        }
        element.click();
      } else if (options.x !== undefined && options.y !== undefined) {
        const element = document.elementFromPoint(options.x, options.y) as HTMLElement;
        if (element) {
          element.click();
        }
      }

      session.lastAction = { type: 'click', options };
      this.updateProgress(session, 'executing', 'Click', 1);
    } catch (error) {
      this.updateProgress(session, 'error', `Click error: ${error}`);
      throw error;
    }
  }

  /**
   * Scroll the page
   */
  async scroll(options: ScrollOptions, sessionId?: string): Promise<void> {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    if (!session?.isActive) {
      throw new Error('Browser session is not active');
    }

    try {
      this.updateProgress(session, 'executing', 'Scroll');

      const amount = options.amount || 100;
      const scrollOptions = {
        behavior: 'smooth' as const,
      };

      switch (options.direction) {
        case 'up':
          window.scrollBy({ ...scrollOptions, top: -amount });
          break;
        case 'down':
          window.scrollBy({ ...scrollOptions, top: amount });
          break;
        case 'left':
          window.scrollBy({ ...scrollOptions, left: -amount });
          break;
        case 'right':
          window.scrollBy({ ...scrollOptions, left: amount });
          break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      session.lastAction = { type: 'scroll', options };
      this.updateProgress(session, 'executing', 'Scroll', 1);
    } catch (error) {
      this.updateProgress(session, 'error', `Scroll error: ${error}`);
      throw error;
    }
  }

  /**
   * Type text into an element
   */
  async type(options: TypeOptions, sessionId?: string): Promise<void> {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    if (!session?.isActive) {
      throw new Error('Browser session is not active');
    }

    try {
      this.updateProgress(session, 'executing', 'Type');

      const element = options.selector 
        ? (document.querySelector(options.selector) as HTMLInputElement)
        : (document.activeElement as HTMLInputElement);

      if (!element) {
        throw new Error('No element to type into');
      }

      // Focus the element
      (element as any).focus();

      // Type the text character by character
      const delay = options.delay || 50;
      for (const char of options.text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      session.lastAction = { type: 'type', options };
      this.updateProgress(session, 'executing', 'Type', 1);
    } catch (error) {
      this.updateProgress(session, 'error', `Type error: ${error}`);
      throw error;
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(options: NavigateOptions, sessionId?: string): Promise<void> {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    if (!session?.isActive) {
      throw new Error('Browser session is not active');
    }

    try {
      this.updateProgress(session, 'executing', 'Navigate');

      window.location.href = options.url;
      await new Promise(resolve => setTimeout(resolve, 2000));

      session.lastAction = { type: 'navigate', options };
      this.updateProgress(session, 'executing', 'Navigate', 1);
    } catch (error) {
      this.updateProgress(session, 'error', `Navigation error: ${error}`);
      throw error;
    }
  }

  /**
   * Execute a series of actions
   */
  async executeActions(actions: BrowserAction[], sessionId?: string): Promise<void> {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    if (!session?.isActive) {
      throw new Error('Browser session is not active');
    }

    session.progress.totalActions = actions.length;
    session.progress.completedActions = 0;

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'click':
            await this.click(action.options as ClickOptions, session.id);
            break;
          case 'scroll':
            await this.scroll(action.options as ScrollOptions, session.id);
            break;
          case 'type':
            await this.type(action.options as TypeOptions, session.id);
            break;
          case 'navigate':
            await this.navigate(action.options as NavigateOptions, session.id);
            break;
        }

        session.progress.completedActions++;
        session.progress.percentage = (session.progress.completedActions / session.progress.totalActions) * 100;
        this.notifyProgress(session.progress);
      } catch (error) {
        console.error('Action failed:', error);
        this.updateProgress(session, 'error', `Action failed: ${error}`);
        throw error;
      }
    }

    session.progress.status = 'completed';
    session.progress.message = 'All actions completed';
    this.notifyProgress(session.progress);
  }

  /**
   * Update progress with action details
   */
  private updateProgress(
    session: BrowserSession, 
    status: string, 
    message: string,
    increment?: number
  ): void {
    session.progress.status = status;
    session.progress.message = message;
    session.progress.currentAction = message;
    
    if (increment !== undefined) {
      session.progress.completedActions += increment;
      if (session.progress.totalActions > 0) {
        session.progress.percentage = (session.progress.completedActions / session.progress.totalActions) * 100;
      }
    }

    this.notifyProgress(session.progress);
  }

  /**
   * Subscribe to progress updates
   */
  onProgress(callback: (progress: BrowserProgress) => void): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all progress listeners
   */
  private notifyProgress(progress: BrowserProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  /**
   * Get session status
   */
  getStatus(sessionId?: string): BrowserProgress {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    return session?.progress || {
      status: 'idle',
      currentAction: undefined,
      completedActions: 0,
      totalActions: 0,
      percentage: 0,
      message: 'No active session',
    };
  }

  /**
   * Take a screenshot of the current page
   */
  async takeScreenshot(sessionId?: string): Promise<string | null> {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    if (!session?.isActive) {
      return null;
    }

    try {
      const canvas = await (html2canvas as any)(document.body);
      return canvas.toDataURL();
    } catch (error) {
      console.error('Screenshot failed:', error);
      return null;
    }
  }

  /**
   * Get page information
   */
  getPageInfo(sessionId?: string): any {
    const session = sessionId 
      ? this.sessions.get(sessionId)
      : this.getDefaultSession();
    
    if (!session?.isActive) {
      return null;
    }

    return {
      title: document.title,
      url: window.location.href,
      visibleText: document.body.innerText,
      images: document.querySelectorAll('img').length,
      scripts: document.querySelectorAll('script').length,
      links: document.querySelectorAll('a').length,
      elements: document.querySelectorAll('*').length,
    };
  }
}

export const browserControlService = new BrowserControlService();
