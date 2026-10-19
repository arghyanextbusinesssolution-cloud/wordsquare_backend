const express = require('express');
const router = express.Router();

const {
  getProfile,
  updateProfile,
  getStreak
} = require('../controllers/userController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/streak', getStreak);

module.exports = router;
