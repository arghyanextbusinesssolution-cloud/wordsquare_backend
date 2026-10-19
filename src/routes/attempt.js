const express = require('express');
const router = express.Router();

const { finishAttempt } = require('../controllers/attemptController');
const { protect } = require('../middleware/auth');

router.post('/finish', protect, finishAttempt);

module.exports = router;
