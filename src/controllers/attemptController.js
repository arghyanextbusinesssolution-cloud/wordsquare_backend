const { Puzzle, PuzzleAttempt } = require('../models');
const { compareGrids } = require('../services/puzzleService');

/**
 * @desc    Finish an attempt and record server-side time
 * @route   POST /api/attempt/finish
 * @access  Private
 */
const finishAttempt = async (req, res, next) => {
  try {
    const { puzzleId, grid } = req.body;

    if (!puzzleId) {
      return res.status(400).json({ success: false, error: 'puzzleId is required' });
    }

    const puzzle = await Puzzle.findById(puzzleId).select('+solutionGrid');
    if (!puzzle) {
      return res.status(404).json({ success: false, error: 'Puzzle not found' });
    }

    let attempt = await PuzzleAttempt.findOne({ userId: req.user._id, puzzleId });
    if (!attempt) {
      // Create an attempt if somehow missing (startedAt set in model)
      attempt = await PuzzleAttempt.create({
        userId: req.user._id,
        puzzleId,
        currentGrid: grid || Array(puzzle.gridSize).fill(null).map(() => Array(puzzle.gridSize).fill(''))
      });
    }

    // Use provided final grid for verification if present
    const finalGrid = grid || attempt.currentGrid;

    const result = compareGrids(finalGrid, puzzle.solutionGrid);

    // Update attempt grid and status
    attempt.currentGrid = finalGrid;
    attempt.status = result.status;

    // markComplete will compute finishedAt and timeTakenSeconds server-side
    await attempt.markComplete(result.status);

    res.status(200).json({
      success: true,
      result: {
        status: result.status,
        message: result.message,
        timeTakenSeconds: attempt.timeTakenSeconds,
        finishedAt: attempt.finishedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  finishAttempt
};
