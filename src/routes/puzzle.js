const express = require('express');
const router = express.Router();

const {
  getTodaysPuzzle,
  checkGrid,
  saveProgress,
  getHint,
  getShareResult,
  getYesterdayResult,
  reportProblem,
  getHistory
} = require('../controllers/puzzleController');

const { protect, optionalAuth } = require('../middleware/auth');
const { validate, gridCheckRules, reportRules } = require('../middleware/validate');

// Public routes (with optional auth for tracking)
router.get('/today', optionalAuth, getTodaysPuzzle);

// Protected routes
router.post('/check', protect, gridCheckRules, validate, checkGrid);
router.post('/save', protect, saveProgress);
router.post('/hint', protect, getHint);
router.get('/share/:puzzleId', protect, getShareResult);
router.get('/yesterday', protect, getYesterdayResult);
router.post('/report', protect, reportRules, validate, reportProblem);
router.get('/history', protect, getHistory);

module.exports = router;
