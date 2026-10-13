import { validateFields } from '../../supabase/functions/_shared/validation.js';
import { createWaitlistClient } from './supabase.js';
import { loadTurnstile } from './turnstile.js';

// Build-time public values only; see scripts/build.mjs.
const config = __PUBLIC_CONFIG__;

export function initNavigation() {
  document.documentElement.classList.add('js');
  const toggle = document.querySelector('#menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (!toggle || !nav) return;
  toggle.hidden = false;
  const close = () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { close(); toggle.focus(); }
  });
  window.matchMedia('(min-width: 721px)').addEventListener('change', close);
}

export function initContact(settings = config) {
  if (settings.contactEmail) {
    const link = document.querySelector('#contact-email');
    if (link) {
      link.href = `mailto:${settings.contactEmail}`;
      link.textContent = settings.contactEmail;
      document.querySelector('#contact-details').hidden = false;
      document.querySelector('#contact-unavailable').hidden = true;
    }
  }
  if (settings.enabled) document.querySelectorAll('[data-preview-only]').forEach(node => { node.hidden = true; });
}

export async function initSignup(settings = config, dependencies = {}) {
  const form = document.querySelector('#waitlist-form');
  if (!form || !settings.enabled) return;
  const fields = document.querySelector('#signup-fields');
  const button = document.querySelector('#submit-button');
  const label = document.querySelector('#submit-label');
  const message = document.querySelector('#form-message');
  const availability = document.querySelector('#form-availability');
  const challengeMessage = document.querySelector('#challenge-message');
  const ids = { full_name: 'full-name', email: 'email', country: 'country', french_level: 'french-level' };
  const submit = dependencies.submit ?? createWaitlistClient(settings);
  let busy = false;
  let complete = false;
  let token = '';
  let widgetId;
  let turnstile;

  const showMessage = (text) => { message.textContent = text; message.hidden = false; message.focus(); };
  const renderErrors = (errors = {}) => {
    for (const [name, id] of Object.entries(ids)) {
      const input = document.getElementById(id);
      const error = document.getElementById(`${id}-error`);
      input.setAttribute('aria-invalid', String(Boolean(errors[name])));
      error.textContent = errors[name] ?? '';
      error.hidden = !errors[name];
    }
  };
  const updateButton = () => { button.disabled = busy || !token || complete; };

  fields.disabled = false;
  availability.hidden = true;
  challengeMessage.textContent = 'Loading spam protection…';
  updateButton();
  form.addEventListener('input', event => {
    if (busy) return;
    const name = event.target.name;
    if (ids[name] && event.target.getAttribute('aria-invalid') === 'true') {
      const error = document.getElementById(`${ids[name]}-error`);
      event.target.setAttribute('aria-invalid', 'false'); error.hidden = true; error.textContent = '';
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || complete) return;
    message.hidden = true;
    const values = Object.fromEntries(new FormData(form));
    const { data, errors, valid } = validateFields(values);
    renderErrors(errors);
    if (!valid) { document.getElementById(ids[Object.keys(errors)[0]]).focus(); return; }
    if (!token) { showMessage('Please complete the spam protection check before submitting.'); return; }
    busy = true;
    fields.disabled = true;
    form.setAttribute('aria-busy', 'true');
    label.textContent = 'Sending your request…';
    challengeMessage.textContent = 'Sending your request. Please wait.';
    updateButton();
    try {
      await submit({ ...data, website: values.website ?? '', turnstile_token: token });
      complete = true;
      form.reset();
      if (turnstile && widgetId !== undefined) turnstile.remove(widgetId);
      document.querySelector('#signup-content').hidden = true;
      const success = document.querySelector('#signup-success');
      success.hidden = false;
      success.focus();
    } catch (error) {
      fields.disabled = false;
      if (error.fields) renderErrors(error.fields);
      showMessage(error.message || 'We couldn’t confirm your registration. Please try again.');
      token = '';
      challengeMessage.textContent = 'Please complete a new verification before trying again.';
      if (turnstile && widgetId !== undefined) turnstile.reset(widgetId);
    } finally {
      busy = false;
      form.setAttribute('aria-busy', 'false');
      label.textContent = 'Join the waitlist';
      updateButton();
    }
  });

  try {
    turnstile = await (dependencies.loadTurnstile ?? loadTurnstile)();
    widgetId = turnstile.render('#turnstile-container', {
      sitekey: settings.turnstileSiteKey,
      action: 'waitlist',
      theme: 'light',
      size: 'flexible',
      'response-field': false,
      callback: response => { token = response; challengeMessage.textContent = 'Verification complete. You can submit the form.'; updateButton(); },
      'expired-callback': () => { token = ''; challengeMessage.textContent = 'Verification expired. Please verify again.'; updateButton(); if (!busy && widgetId !== undefined) turnstile.reset(widgetId); },
      'error-callback': () => { token = ''; challengeMessage.textContent = 'Verification could not load. Please check your connection or reload this page.'; updateButton(); },
    });
    if (!token) challengeMessage.textContent = 'Complete the spam protection check when prompted.';
  } catch (error) { showMessage(error.message); challengeMessage.textContent = 'Spam protection is unavailable. Your information has not been sent.'; }
}

initNavigation();
initContact();
void initSignup();
