const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStatus, extractOpenings } = require('./poll');

const html = openings => `
  <script>
    var classData = { openings: ${openings}, waitlistOpenings: 8, maxOpenings: 10 };
    classTracker.selectClass(22262489, classData);
  </script>
`;

test('extracts only the verified promotional opening count', () => {
  assert.equal(extractOpenings(html(8)), 8);
  assert.throws(() => extractOpenings(html(8).replace('22262489', '99999999')), /verify/);
});

test('a cancellation never lowers the claimed count', () => {
  const afterFour = buildStatus(null, 6, '2026-08-20T00:00:00.000Z');
  const afterCancellation = buildStatus(afterFour, 7, '2026-08-20T01:00:00.000Z');
  assert.equal(afterCancellation.claimedCount, 4);
  assert.equal(afterCancellation.remainingPromoClaims, 6);
});

test('every successful observation publishes machine-readable freshness', () => {
  const checkedAt = '2026-08-22T00:05:00.000Z';
  const status = buildStatus(null, 10, checkedAt);
  assert.equal(status.checkedAt, checkedAt);
  assert.equal(status.monitor.lastCheckedAt, checkedAt);
  assert.equal(status.monitor.lastObservedChangeAt, checkedAt);

  const nextCheckedAt = '2026-08-22T00:10:00.000Z';
  const unchanged = buildStatus(status, 10, nextCheckedAt);
  assert.equal(unchanged.checkedAt, nextCheckedAt);
  assert.equal(unchanged.monitor.lastCheckedAt, nextCheckedAt);
  assert.equal(unchanged.monitor.lastObservedChangeAt, checkedAt);
});

test('publishes only the allowlisted organization and class URLs', () => {
  const promo = buildStatus(null, 10);
  assert.deepEqual(promo.registration, {
    allowedHost: 'app.jackrabbitclass.com',
    organizationId: '546074',
    promoClassId: '22262489',
    earlyBirdClassId: '22204178',
    promoUrl: 'https://app.jackrabbitclass.com/regv2.asp?id=546074&preLoadClassID=22262489',
    earlyBirdUrl: 'https://app.jackrabbitclass.com/regv2.asp?id=546074&preLoadClassID=22204178',
  });
  assert.equal(promo.cta.url, promo.registration.promoUrl);

  const exhausted = buildStatus(promo, 0);
  assert.equal(exhausted.cta.url, exhausted.registration.earlyBirdUrl);
});

test('claim ten permanently activates the $1,500 link', () => {
  const exhausted = buildStatus(null, 0, '2026-08-20T00:00:00.000Z');
  const afterCancellation = buildStatus(exhausted, 1, '2026-08-20T01:00:00.000Z');
  assert.equal(afterCancellation.exhausted, true);
  assert.match(afterCancellation.cta.url, /preLoadClassID=22204178/);
});
