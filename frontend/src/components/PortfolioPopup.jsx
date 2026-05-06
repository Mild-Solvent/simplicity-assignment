import { useState, useEffect } from 'react';

const STORAGE_KEY = 'portfolio_popup_dismissed';

const links = [
  { label: 'gas.green', href: 'https://gas.green' },
];

export default function PortfolioPopup() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      // Small delay so it feels like a natural appearance after page load
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    setHiding(true);
    setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(STORAGE_KEY, '1');
    }, 380);
  }

  if (!visible) return null;

  return (
    <div className={`pp-backdrop ${hiding ? 'pp-hiding' : ''}`} onClick={dismiss}>
      <div
        className={`pp-box ${hiding ? 'pp-box-hiding' : ''}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Portfolio notice"
      >
        {/* Decorative top bar */}
        <div className="pp-topbar" />

        {/* Cookie emoji */}
        <div className="pp-emoji" aria-hidden="true">🍪</div>

        <div className="pp-body">
          <p className="pp-headline">Thanks for this fun task, if you want to see some of my more complex work check this out: 👀</p>
          <p className="pp-text">
            I worked on this with my buddy:
          </p>

          <ul className="pp-links">
            {links.map(({ label, href }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" className="pp-link">
                  <span className="pp-link-dot" />
                  {label}
                  <svg className="pp-link-arrow" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>

          <a
            href="https://github.com/Mild-Solvent"
            target="_blank"
            rel="noopener noreferrer"
            className="pp-github"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            View my GitHub
          </a>
        </div>

        <button className="pp-close" onClick={dismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
