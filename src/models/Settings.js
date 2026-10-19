const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    siteName: {
        type: String,
        default: 'Square Puzzles',
        trim: true
    },
    siteDescription: {
        type: String,
        default: 'Daily Word Puzzle Game',
        trim: true
    }
}, {
    timestamps: true,
    capped: { size: 1024, max: 1 } // Ensure only one document exists
});

module.exports = mongoose.model('Settings', settingsSchema);
