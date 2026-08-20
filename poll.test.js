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

test('claim ten permanently activates the $1,500 link', () => {
  const exhausted = buildStatus(null, 0, '2026-08-20T00:00:00.000Z');
  const afterCancellation = buildStatus(exhausted, 1, '2026-08-20T01:00:00.000Z');
  assert.equal(afterCancellation.exhausted, true);
  assert.match(afterCancellation.cta.url, /preLoadClassID=22204178/);
});
