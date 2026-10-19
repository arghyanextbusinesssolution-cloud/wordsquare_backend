const express = require('express');
const router = express.Router();

const {
  createPuzzle,
  getAllPuzzles,
  getPuzzle,
  updatePuzzle,
  deletePuzzle,
  getReports,
  resolveReport,
  getDashboardStats,
  getUsers,
  getPuzzleAttempts,
  deleteUser,
  getSettings,
  updateSettings
} = require('../controllers/adminController');

const { protect, adminOnly } = require('../middleware/auth');
const { validate, puzzleCreateRules, mongoIdRule } = require('../middleware/validate');

// All routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// Dashboard
router.get('/stats', getDashboardStats);

// Puzzle management
router.post('/puzzle', puzzleCreateRules, validate, createPuzzle);
router.get('/puzzles', getAllPuzzles);
router.get('/puzzle/:id', mongoIdRule('id'), validate, getPuzzle);
router.get('/puzzle/:id/attempts', mongoIdRule('id'), validate, getPuzzleAttempts);
router.put('/puzzle/:id', mongoIdRule('id'), validate, updatePuzzle);
router.delete('/puzzle/:id', mongoIdRule('id'), validate, deletePuzzle);

// Reports management
router.get('/reports', getReports);
router.put('/report/:id', mongoIdRule('id'), validate, resolveReport);

// User management
router.get('/users', getUsers);
router.delete('/user/:id', mongoIdRule('id'), validate, deleteUser);

// Settings management
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;
