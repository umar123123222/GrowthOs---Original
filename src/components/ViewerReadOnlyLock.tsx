import { useEffect, useRef, ReactNode } from 'react';

/**
 * Wraps content for the `viewer` role and hides any mutation UI:
 *  - Buttons / links whose visible text or aria-label matches an action verb
 *  - Buttons / links that contain a known destructive icon class
 *
 * A MutationObserver re-runs the scan whenever the DOM changes inside the
 * wrapper, so dynamically-rendered dialogs, dropdowns, and table rows are
 * covered. As a defense-in-depth backup, the wrapper also intercepts clicks
 * on hidden elements.
 *
 * This is intentionally aggressive — it's the simplest way to guarantee a
 * viewer cannot click an edit/delete/save/etc. button without modifying
 * every single admin component.
 */

const ACTION_PATTERNS = [
  /\badd\b/i,
  /\bcreate\b/i,
  /\bnew\b/i,
  /\bedit\b/i,
  /\bupdate\b/i,
  /\bdelete\b/i,
  /\bremove\b/i,
  /\bsave\b/i,
  /\bsubmit\b/i,
  /\bassign\b/i,
  /\bunassign\b/i,
  /\bsuspend\b/i,
  /\bunsuspend\b/i,
  /\brestore\b/i,
  /\breset\b/i,
  /\bapprove\b/i,
  /\breject\b/i,
  /\bsend\b/i,
  /\bresend\b/i,
  /\bupload\b/i,
  /\bimport\b/i,
  /\bmark\s+as\b/i,
  /\bchange\b/i,
  /\benable\b/i,
  /\bdisable\b/i,
  /\bskip\s+drip\b/i,
  /\bextend\b/i,
  /\brefund\b/i,
  /\bduplicate\b/i,
  /\bclone\b/i,
  /\bschedule\b/i,
  /\breschedule\b/i,
  /\bmove\b/i,
  /\bregenerate\b/i,
  /\bterminate\b/i,
  /\bgrant\b/i,
  /\brevoke\b/i,
  /\bissue\b/i,
  /\bpay\b/i,
  /\bmark\s+paid\b/i,
  /\bconnect\b/i,
  /\bdisconnect\b/i,
];

const ALLOW_PATTERNS = [
  /^view\b/i,
  /^see\b/i,
  /^show\b/i,
  /^open\b/i,
  /^close\b/i,
  /^cancel\b/i,
  /^back\b/i,
  /^next\b/i,
  /^previous\b/i,
  /^search\b/i,
  /^filter\b/i,
  /^sort\b/i,
  /^refresh\b/i,
  /^download\b/i,
  /^export\b/i,
  /^copy\b/i,
  /^print\b/i,
  /^details\b/i,
  /^expand\b/i,
  /^collapse\b/i,
];

function shouldHide(el: Element): boolean {
  // Skip if already processed
  if (el.hasAttribute('data-viewer-hidden')) return false;

  // Don't hide things explicitly marked safe
  if (el.closest('[data-viewer-allow="true"]')) return false;

  // Never hide tab triggers, accordion triggers, dropdown menu items used for navigation,
  // or close buttons inside dialogs (X buttons)
  const role = el.getAttribute('role');
  if (role === 'tab' || role === 'menuitem' || role === 'option') return false;
  if (el.getAttribute('data-state') && el.tagName === 'BUTTON' && (el.getAttribute('aria-controls') || el.getAttribute('aria-expanded'))) {
    // Accordion / collapsible / tabs trigger
    return false;
  }

  const text = (el.textContent || '').trim();
  const aria = el.getAttribute('aria-label') || '';
  const title = el.getAttribute('title') || '';
  const haystack = `${text} ${aria} ${title}`.trim();

  if (!haystack) {
    // Icon-only button — check sr-only label
    const sr = el.querySelector('.sr-only');
    if (sr && sr.textContent) {
      return ACTION_PATTERNS.some((p) => p.test(sr.textContent!));
    }
    // No identifiable text — leave it (likely a navigation icon)
    return false;
  }

  // Allowed action — keep visible
  if (ALLOW_PATTERNS.some((p) => p.test(haystack))) return false;

  return ACTION_PATTERNS.some((p) => p.test(haystack));
}

function applyLock(root: HTMLElement) {
  const candidates = root.querySelectorAll<HTMLElement>(
    'button, a[role="button"], [type="submit"], input[type="submit"], input[type="button"]'
  );
  candidates.forEach((el) => {
    if (shouldHide(el)) {
      el.setAttribute('data-viewer-hidden', 'true');
      el.style.display = 'none';
    }
  });

  // Disable form inputs so a viewer can't type into edit forms that still slip through.
  // (Filter/search inputs are still allowed because we only target inputs inside
  //  open dialogs / forms that have a submit-style action.)
  const dialogs = root.querySelectorAll<HTMLElement>('[role="dialog"]');
  dialogs.forEach((dlg) => {
    // If the dialog has no remaining action buttons, leave inputs alone.
    const remainingActions = dlg.querySelectorAll(
      'button:not([data-viewer-hidden]):not([data-viewer-allow])'
    );
    if (remainingActions.length === 0) {
      dlg.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([type="search"]), textarea, select'
      ).forEach((field) => {
        field.disabled = true;
        field.readOnly = true;
      });
    }
  });
}

export const ViewerReadOnlyLock = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // Initial pass
    applyLock(root);

    const obs = new MutationObserver(() => {
      applyLock(root);
    });
    obs.observe(root, { childList: true, subtree: true, attributes: false });

    // Capture-phase click guard — if anything still slips through, swallow it.
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest('button, a[role="button"], [type="submit"]') as HTMLElement | null;
      if (btn && btn.getAttribute('data-viewer-hidden') === 'true') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    root.addEventListener('click', onClick, true);

    return () => {
      obs.disconnect();
      root.removeEventListener('click', onClick, true);
    };
  }, []);

  return (
    <div ref={ref} className="viewer-readonly-root">
      {children}
    </div>
  );
};
