/**
 * requestTracker.js — Tracks requested comparison tickers that don't have data yet.
 * Persists to data/requests.json. Auto-prunes when data becomes available.
 */

const fs = require('fs');
const path = require('path');

const REQUESTS_PATH = path.join(__dirname, '..', 'data', 'requests.json');

function readRequests() {
  try {
    if (!fs.existsSync(REQUESTS_PATH)) return [];
    return JSON.parse(fs.readFileSync(REQUESTS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeRequests(requests) {
  const dir = path.dirname(REQUESTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REQUESTS_PATH, JSON.stringify(requests, null, 2));
}

function getRequests() {
  return readRequests();
}

function addRequest(ticker) {
  const t = ticker.toUpperCase();
  const requests = readRequests();
  const existing = requests.find(r => r.ticker === t);
  if (existing) {
    return { added: false, alreadyRequested: true };
  }
  requests.push({ ticker: t, requestedAt: new Date().toISOString() });
  writeRequests(requests);
  return { added: true, alreadyRequested: false };
}

function removeRequest(ticker) {
  const t = ticker.toUpperCase();
  const requests = readRequests();
  const filtered = requests.filter(r => r.ticker !== t);
  if (filtered.length !== requests.length) {
    writeRequests(filtered);
    return true;
  }
  return false;
}

/**
 * Remove any requested tickers that now have data.
 * @param {string[]} availableTickers - All tickers with data (portfolio + non-portfolio)
 */
function pruneAvailable(availableTickers) {
  const available = new Set(availableTickers.map(t => t.toUpperCase()));
  const requests = readRequests();
  const pruned = requests.filter(r => !available.has(r.ticker));
  if (pruned.length !== requests.length) {
    const removed = requests.length - pruned.length;
    writeRequests(pruned);
    console.log(`[requestTracker] Pruned ${removed} fulfilled request(s)`);
  }
}

module.exports = { getRequests, addRequest, removeRequest, pruneAvailable };
