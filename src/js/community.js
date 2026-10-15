import { createClient } from '@supabase/supabase-js';

export function createCountLoader(config) {
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return async () => {
    const { data, error } = await client.functions.invoke('waitlist-stats', { method: 'GET', timeout: 10000 });
    if (error || !Number.isSafeInteger(data?.count) || data.count < 0 || !Number.isFinite(Date.parse(data.updated_at))) throw new Error('unavailable');
    return data;
  };
}

export function initCommunity(config, dependencies = {}) {
  const section = document.querySelector('#early-community');
  if (!section || !config.supabaseUrl || !config.supabasePublishableKey) return () => {};
  const load = dependencies.load ?? createCountLoader(config);
  const count = section.querySelector('[data-community-count]');
  const label = section.querySelector('[data-community-label]');
  const status = section.querySelector('[data-community-status]');
  const retry = section.querySelector('[data-community-retry]');
  let loading = false;
  let stopped = false;
  let lastCount = null;
  let timer;
  async function refresh() {
    if (stopped || loading) return;
    loading = true;
    section.setAttribute('aria-busy', 'true');
    retry.disabled = true;
    try {
      const data = await load();
      if (stopped) return;
      if (!Number.isSafeInteger(data?.count) || data.count < 0 || !Number.isFinite(Date.parse(data.updated_at))) throw new Error('unavailable');
      if (lastCount !== data.count) {
        count.textContent = new Intl.NumberFormat('en').format(data.count);
        label.textContent = data.count === 1 ? 'person on the waitlist' : 'people on the waitlist';
      }
      lastCount = data.count;
      count.classList.toggle('community-count-long', String(data.count).length > 5);
      status.textContent = data.count === 0 ? 'A new beginning. Be the first to join.' : 'Real registrations. Refreshed every minute.';
      section.dataset.countState = 'ready';
      retry.hidden = true;
    } catch {
      if (stopped) return;
      // Keep the last real value explicitly stale; never invent zero or increment locally.
      status.textContent = lastCount === null ? 'The count is temporarily unavailable. You can still join below.' : 'Last known total. The live count couldn’t refresh.';
      section.dataset.countState = 'unavailable';
      retry.hidden = false;
    } finally {
      loading = false;
      if (!stopped) {
        section.setAttribute('aria-busy', 'false');
        retry.disabled = false;
      }
    }
  }
  const onVisible = () => { if (!document.hidden) void refresh(); };
  const onRegistered = () => { void refresh(); };
  retry.addEventListener('click', refresh);
  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('parlonsmoi:registered', onRegistered);
  void refresh();
  if (dependencies.poll !== false) timer = setInterval(onVisible, 60000);
  return () => {
    stopped = true; clearInterval(timer);
    retry.removeEventListener('click', refresh);
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('parlonsmoi:registered', onRegistered);
  };
}

export function initCommunityMotion() {
  const section = document.querySelector('#early-community');
  const word = section?.querySelector('[data-parallax-word]');
  if (!word || !window.matchMedia || !window.IntersectionObserver) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let visible = false;
  const draw = () => {
    frame = 0;
    if (preference.matches) { word.style.transform = ''; return; }
    const box = section.getBoundingClientRect();
    const offset = Math.max(-24, Math.min(24, (window.innerHeight / 2 - box.top - box.height / 2) * .055));
    word.style.transform = `translate3d(0, ${offset}px, 0)`;
  };
  const schedule = () => { if (visible && !preference.matches && !frame) frame = window.requestAnimationFrame(draw); };
  const observer = new window.IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); });
  observer.observe(section);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  preference.addEventListener('change', () => { if (preference.matches) word.style.transform = ''; else schedule(); });
}
