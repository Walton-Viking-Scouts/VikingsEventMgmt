const PRODUCTION_WEB_ORIGIN = 'https://vikingeventmgmt.onrender.com';

/**
 * The public web origin to build shareable links from. The runtime origin is
 * only shareable when it is a real http(s) origin that isn't localhost — on the
 * native build it is `capacitor://localhost` / `https://localhost`, and on a
 * dev server it is `https://localhost:PORT`, neither of which a recipient can
 * open. In those cases fall back to the production web app.
 *
 * @returns {string} An origin safe to paste into a message
 */
export function shareOrigin() {
  const origin = window.location.origin;
  return /^https?:\/\//.test(origin) && !/localhost/.test(origin) ? origin : PRODUCTION_WEB_ORIGIN;
}

/**
 * Copy text to the clipboard, preferring the async Clipboard API and falling
 * back to a hidden textarea + execCommand for browsers/contexts where it is
 * unavailable (older mobile Safari, non-secure contexts).
 *
 * @param {string} text - The text to copy
 * @returns {Promise<boolean>} True if the copy succeeded
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
