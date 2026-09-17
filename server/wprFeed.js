/**
 * server/wprFeed.js - Read-only access to the WPR site bundle under content/wpr.
 *
 * The WPR project publishes the bundle with `py wpr.py publish`: wpr_feed.json
 * with every allocation slide, week-over-week changes, and the video catalogue,
 * plus transcripts/<video>/{report,transcript,evidence}.md. This module reads
 * the feed and resolves only files inside the bundle's transcripts folder.
 */

const fs = require('fs');
const path = require('path');

const { loadInvestingConfig } = require('./investingConfig');

const FEED_FILE = 'wpr_feed.json';
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
/** Files a video page may serve, keyed by URL segment. */
const VIDEO_FILES = {
  report: 'report_path',
  transcript: 'transcript_path',
  evidence: 'evidence_path',
};

/** Return whether a YouTube-style video id is safe to use in a URL and lookup. */
function isValidVideoId(value) {
  return typeof value === 'string' && VIDEO_ID_PATTERN.test(value);
}

/** Return whether a resolved file remains strictly inside its intended directory. */
function isPathInside(parentDir, childPath) {
  const relative = path.relative(parentDir, childPath);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

/** Create a feed reader bound to one bundle directory. */
function createWprFeed(options = {}) {
  const contentDir = path.resolve(options.wprContentDir || loadInvestingConfig().wprContentDir);
  const feedPath = path.join(contentDir, FEED_FILE);
  const transcriptsDir = path.join(contentDir, 'transcripts');

  /** Read and parse the feed. Returns null when WPR has not published yet. */
  function getFeed() {
    let raw;
    try {
      raw = fs.readFileSync(feedPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    const feed = JSON.parse(raw);
    return feed && typeof feed === 'object' ? feed : null;
  }

  /** Return the catalogue entry for one video id, or null. */
  function getVideo(videoId) {
    if (!isValidVideoId(videoId)) return null;
    const feed = getFeed();
    if (!feed || !Array.isArray(feed.videos)) return null;
    return feed.videos.find(video => video.video_id === videoId) || null;
  }

  /**
   * Read one Markdown file for a video. `kind` is report, transcript, or evidence.
   * The path comes from the feed, so it is re-checked against the bundle's transcripts folder.
   */
  function readVideoFile(videoId, kind) {
    const video = getVideo(videoId);
    const key = VIDEO_FILES[kind];
    if (!video || !key || typeof video[key] !== 'string') return null;

    const candidate = path.resolve(contentDir, ...video[key].split('/'));
    if (!isPathInside(transcriptsDir, candidate)) return null;
    try {
      if (!fs.statSync(candidate).isFile()) return null;
      return fs.readFileSync(candidate, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
      throw error;
    }
  }

  return { getFeed, getVideo, readVideoFile, contentDir };
}

module.exports = {
  createWprFeed,
  isValidVideoId,
};
