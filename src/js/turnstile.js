let loading;

export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const cleanup = () => { clearTimeout(timer); delete window.parlonsMoiTurnstileReady; };
    const fail = () => { cleanup(); script.remove(); loading = null; reject(new Error('Verification is unavailable. Please reload the page or check your connection.')); };
    const timer = setTimeout(fail, 12000);
    window.parlonsMoiTurnstileReady = () => { cleanup(); resolve(window.turnstile); };
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=parlonsMoiTurnstileReady';
    script.async = true;
    script.defer = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
