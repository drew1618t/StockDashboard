/**
 * server/routes/wprRoutes.js - Pages and API for the WPR section.
 *
 * /wpr                         current positions and week-over-week changes
 * /wpr/videos                  video archive
 * /wpr/videos/:id              one video's report
 * /wpr/videos/:id/transcript   formatted transcript
 * /wpr/videos/:id/evidence     evidence register
 * /api/wpr/feed                the published feed, unchanged
 */

const express = require('express');

const { createWprFeed, isValidVideoId } = require('../wprFeed');
const { renderVideoPage, renderVideosPage, renderWprPage } = require('../wprPage');

function createWprRoutes(options = {}) {
  const feed = options.wprFeed || createWprFeed(options);
  const router = express.Router();

  /** Send one video's Markdown file as a page, or 404 when the feed lacks it. */
  function showVideoFile(kind) {
    return (req, res) => {
      if (!isValidVideoId(req.params.videoId)) return res.status(404).type('text').send('Video not found.');
      const video = feed.getVideo(req.params.videoId);
      const markdown = video ? feed.readVideoFile(video.video_id, kind) : null;
      if (!video || markdown == null) return res.status(404).type('text').send('Video not found.');
      return res.type('html').send(renderVideoPage(video, kind, markdown));
    };
  }

  router.get('/wpr', (req, res) => {
    res.type('html').send(renderWprPage());
  });

  router.get('/wpr/videos', (req, res) => {
    const data = feed.getFeed();
    res.type('html').send(renderVideosPage(data ? data.videos : []));
  });

  router.get('/wpr/videos/:videoId', showVideoFile('report'));
  router.get('/wpr/videos/:videoId/transcript', showVideoFile('transcript'));
  router.get('/wpr/videos/:videoId/evidence', showVideoFile('evidence'));

  router.get('/api/wpr/feed', (req, res) => {
    const data = feed.getFeed();
    if (!data) return res.status(404).json({ error: 'WPR feed not published. Run `py wpr.py publish` in the WPR project.' });
    return res.json(data);
  });

  return router;
}

module.exports = { createWprRoutes };
