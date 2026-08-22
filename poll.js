#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const CLASS_ID = '22262489';
const EARLY_BIRD_CLASS_ID = '22204178';
const ORGANIZATION_ID = '546074';
const ALLOWED_HOST = 'app.jackrabbitclass.com';
const THRESHOLD = 10;
const PROMO_URL = `https://${ALLOWED_HOST}/regv2.asp?id=${ORGANIZATION_ID}&preLoadClassID=${CLASS_ID}`;
const EARLY_BIRD_URL = `https://${ALLOWED_HOST}/regv2.asp?id=${ORGANIZATION_ID}&preLoadClassID=${EARLY_BIRD_CLASS_ID}`;
const STATUS_PATH = path.join(__dirname, 'registration-status.json');

function extractOpenings(html) {
  const source = String(html || '');
  const selected = new RegExp(`classTracker\\.selectClass\\(\\s*${CLASS_ID}\\s*,\\s*classData\\s*\\)`).exec(source);
  if (!selected) throw new Error(`Could not verify promotional class ${CLASS_ID}`);

  const nearby = source.slice(Math.max(0, selected.index - 2500), selected.index);
  const blocks = [...nearby.matchAll(/(?:var|let|const)\s+classData\s*=\s*\{([\s\S]*?)\}/g)];
  const match = /(?:^|[,\s])openings\s*:\s*(\d+)/m.exec(blocks.at(-1)?.[1] || '');
  if (!match) throw new Error(`Could not read openings for promotional class ${CLASS_ID}`);

  const openings = Number(match[1]);
  if (!Number.isInteger(openings) || openings < 0 || openings > THRESHOLD) {
    throw new Error(`Invalid promotional opening count: ${match[1]}`);
  }
  return openings;
}

function buildStatus(previous, openings, changedAt = new Date().toISOString()) {
  const previousClaimed = Number.isInteger(previous?.claimedCount) ? previous.claimedCount : 0;
  const claimedCount = Math.max(previousClaimed, THRESHOLD - openings);
  const exhausted = claimedCount >= THRESHOLD;
  const observationChanged = previous?.monitor?.latestObservedOpenings !== openings
    || previous?.claimedCount !== claimedCount;

  return {
    program: 'summer-acting-camp-2027',
    checkedAt: changedAt,
    threshold: THRESHOLD,
    claimedCount,
    remainingPromoClaims: Math.max(0, THRESHOLD - claimedCount),
    exhausted,
    configurationVerified: true,
    mode: exhausted ? 'regular' : 'promo',
    cta: {
      url: exhausted ? EARLY_BIRD_URL : PROMO_URL,
      label: exhausted
        ? 'Register at the $1,500 Super Early Bird rate'
        : 'Claim the $1,000 first-10 offer',
    },
    offer: {
      state: exhausted ? 'claimed' : 'available',
      label: exhausted ? 'First 10 spots claimed' : 'Limited first-10 offer',
    },
    registration: {
      allowedHost: ALLOWED_HOST,
      organizationId: ORGANIZATION_ID,
      promoClassId: CLASS_ID,
      earlyBirdClassId: EARLY_BIRD_CLASS_ID,
      promoUrl: PROMO_URL,
      earlyBirdUrl: EARLY_BIRD_URL,
    },
    monitor: {
      source: 'jackrabbit-public-openings',
      promoClassId: CLASS_ID,
      latestObservedOpenings: openings,
      lastCheckedAt: changedAt,
      lastObservedChangeAt: observationChanged
        ? changedAt
        : previous?.monitor?.lastObservedChangeAt || changedAt,
      monotonic: true,
    },
  };
}

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function main() {
  const response = await fetch(PROMO_URL, {
    headers: { Accept: 'text/html', 'User-Agent': 'NGA-Camp-2027-Free-Monitor/1.0' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Jackrabbit returned HTTP ${response.status}`);

  const openings = extractOpenings(await response.text());
  const status = buildStatus(readPrevious(), openings);
  const temporary = `${STATUS_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(status, null, 2)}\n`);
  fs.renameSync(temporary, STATUS_PATH);
  process.stdout.write(`${JSON.stringify(status)}\n`);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildStatus, extractOpenings };
