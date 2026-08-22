# Squarespace registration-state fail-closed patch

Replace the current Camp registration-state IIFE with the implementation below. Do not apply the hardcoded promotional state before the endpoint has been fetched and validated.

Safety contract:

- A status observation is fresh for at most 20 minutes.
- The only allowed destination host is `app.jackrabbitclass.com`.
- The only allowed organization is `546074`.
- Promotional mode may link only to class `22262489`.
- Post-cutoff mode may link only to class `22204178`.
- A missing, failed, malformed, future-dated, or stale response fails closed to email rather than retaining the `$1,000` link.
- The 20-minute threshold is intentionally conservative. Current GitHub scheduled-run delays can exceed it, so temporary fail-closed periods are expected until scheduling is made more punctual.

```html
<script>
(() => {
  const STATUS_URL = 'https://drenrim.github.io/camp-2027-registration-status/registration-status.json';
  const MAX_STATUS_AGE_MS = 20 * 60 * 1000;
  const ALLOWED_HOST = 'app.jackrabbitclass.com';
  const ORGANIZATION_ID = '546074';
  const PROMO_CLASS_ID = '22262489';
  const EARLY_BIRD_CLASS_ID = '22204178';
  const FALLBACK_URL = 'mailto:office@nextgenacting.com?subject=Summer%20Acting%20Camp%202027%20registration';

  const failClosed = () => {
    document.querySelectorAll('[data-camp-registration-status]').forEach(node => {
      node.textContent = 'Registration status is being refreshed. Email us and we will send you the current approved registration link.';
    });
    document.querySelectorAll('[data-camp-registration-cta]').forEach(link => {
      link.href = FALLBACK_URL;
      link.textContent = 'Ask for the current registration link';
      link.removeAttribute('target');
      link.rel = 'noopener';
    });
  };

  const exactRegistrationContract = status => {
    const registration = status?.registration;
    return registration?.allowedHost === ALLOWED_HOST
      && registration?.organizationId === ORGANIZATION_ID
      && registration?.promoClassId === PROMO_CLASS_ID
      && registration?.earlyBirdClassId === EARLY_BIRD_CLASS_ID;
  };

  const allowedCta = status => {
    try {
      const url = new URL(status?.cta?.url);
      const expectedClass = status.mode === 'promo' ? PROMO_CLASS_ID : EARLY_BIRD_CLASS_ID;
      return url.protocol === 'https:'
        && url.hostname === ALLOWED_HOST
        && url.pathname === '/regv2.asp'
        && url.searchParams.get('id') === ORGANIZATION_ID
        && url.searchParams.get('preLoadClassID') === expectedClass;
    } catch {
      return false;
    }
  };

  const validFreshStatus = status => {
    const checkedAt = Date.parse(status?.checkedAt || status?.monitor?.lastCheckedAt || '');
    const age = Date.now() - checkedAt;
    const modeIsConsistent = status?.exhausted
      ? status?.mode === 'regular'
      : status?.mode === 'promo';
    return status?.program === 'summer-acting-camp-2027'
      && status?.configurationVerified === true
      && Number.isFinite(checkedAt)
      && age >= -5 * 60 * 1000
      && age <= MAX_STATUS_AGE_MS
      && Number.isInteger(status?.claimedCount)
      && status.claimedCount >= 0
      && status.claimedCount <= 10
      && Number.isInteger(status?.remainingPromoClaims)
      && status.remainingPromoClaims === 10 - status.claimedCount
      && modeIsConsistent
      && exactRegistrationContract(status)
      && allowedCta(status);
  };

  const applyStatus = status => {
    document.querySelectorAll('[data-camp-registration-status]').forEach(node => {
      node.textContent = status.exhausted
        ? 'The first 10 promotional registrations have been claimed. Super Early Bird registration is now $1,500.'
        : status.remainingPromoClaims === 10
          ? 'The first 10 completed registrations receive the $1,000 launch price. All 10 discounted registrations are still available.'
          : `${status.remainingPromoClaims} discounted registrations remain at $1,000.`;
    });
    document.querySelectorAll('[data-camp-registration-cta]').forEach(link => {
      link.href = status.cta.url;
      link.textContent = status.cta.label;
      link.rel = 'noopener';
    });
    /* Keep the page's existing exhausted/promo copy and class updates here. */
  };

  failClosed();
  const cacheBuster = `?v=${Math.floor(Date.now() / 300000)}`;
  fetch(`${STATUS_URL}${cacheBuster}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('status unavailable')))
    .then(status => {
      if (!validFreshStatus(status)) throw new Error('status invalid or stale');
      applyStatus(status);
    })
    .catch(failClosed);
})();
</script>
```

Before publishing, merge the existing page's visual exhausted/promo copy changes into `applyStatus`; do not weaken `validFreshStatus`, `allowedCta`, or `failClosed`.
