import React, { useEffect, useRef } from 'react';

interface CaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

declare global {
  interface Window {
    turnstile?: any;
  }
}

// Simple Cloudflare Turnstile wrapper. Reads site key from a meta tag:
// <meta name="turnstile-sitekey" content="YOUR_SITE_KEY" />
export const Captcha: React.FC<CaptchaProps> = ({ onVerify, onExpire }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const siteKey = document.querySelector('meta[name="turnstile-sitekey"]')?.getAttribute('content');

    const render = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current || !siteKey) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          'error-callback': () => onExpire?.(),
          'expired-callback': () => onExpire?.(),
          theme: 'auto',
        });
      } catch (e) {
        console.warn('Turnstile render failed', e);
      }
    };

    if (window.turnstile) {
      render();
    } else {
      // Load script once
      const existing = document.querySelector('script[data-turnstile]');
      if (!existing) {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        s.async = true;
        s.defer = true;
        s.setAttribute('data-turnstile', 'true');
        s.onload = () => render();
        document.head.appendChild(s);
      } else {
        existing.addEventListener('load', render);
      }
    }

    return () => {
      try {
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {}
    };
  }, [onVerify, onExpire]);

  const siteKeyPresent = !!document.querySelector('meta[name="turnstile-sitekey"]')?.getAttribute('content');

  // If no site key is configured, render nothing (captcha disabled)
  if (!siteKeyPresent) {
    return null;
  }

  return (
    <div className="mt-2">
      <div ref={containerRef} />
    </div>
  );
};

export default Captcha;
