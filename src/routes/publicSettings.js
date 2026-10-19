const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

/**
 * @desc    Get public site settings
 * @route   GET /api/public/settings
 * @access  Public
 */
router.get('/', async (req, res, next) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = {
                siteName: 'Square Puzzles',
                siteDescription: 'Daily Word Puzzle Game'
            };
        }
        res.status(200).json({
            success: true,
            settings: {
                siteName: settings.siteName,
                siteDescription: settings.siteDescription
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
