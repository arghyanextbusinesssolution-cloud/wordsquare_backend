const { Puzzle, PuzzleAttempt, Report } = require('../models');
const { compareGrids, generateClipboardText } = require('../services/puzzleService');

/**
 * @desc    Get today's puzzle
 * @route   GET /api/puzzle/today
 * @access  Public (optional auth for tracking)
 */
const getTodaysPuzzle = async (req, res, next) => {
  try {
    const { date } = req.query;
    let puzzle;

    if (date) {
      puzzle = await Puzzle.getPuzzleByDate(date);
    } else {
      puzzle = await Puzzle.getTodaysPuzzle();
    }

    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: date ? `No puzzle available for ${date}` : 'No puzzle available for today'
      });
    }

    // Get puzzle with solution to extract visible letters
    const puzzleWithSolution = await Puzzle.findById(puzzle._id).select('+solutionGrid');
    const visibleLetters = puzzleWithSolution.getVisibleLetters();

    // Get or create user's attempt if authenticated
    let attempt = null;
    if (req.user) {
      attempt = await PuzzleAttempt.getOrCreate(req.user._id, puzzle._id, puzzle.gridSize);
    }

    res.status(200).json({
      success: true,
      puzzle: {
        id: puzzle._id,
        puzzleDate: puzzle.puzzleDate,
        gridSize: puzzle.gridSize,
        visibleLetters,
        hintCells: puzzle.hintCells || [],
        dailyMessage: puzzle.dailyMessage,
        acrossClues: puzzle.acrossClues || [],
        downClues: puzzle.downClues || []
      },
      attempt: attempt ? {
        currentGrid: attempt.currentGrid,
        hintUsed: attempt.hintUsed,
        status: attempt.status,
        startedAt: attempt.startedAt || null,
        finishedAt: attempt.finishedAt || null,
        timeTakenSeconds: attempt.timeTakenSeconds || null,
        completed: attempt.completed || false
      } : null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check user's grid against solution
 * @route   POST /api/puzzle/check
 * @access  Private
 */
const checkGrid = async (req, res, next) => {
  try {
    const { grid, puzzleId } = req.body;

    console.log(`[Puzzle] Checking grid for puzzle: ${puzzleId}`);
    console.log(`[Puzzle] User grid:`, JSON.stringify(grid));

    // Get puzzle with solution
    const puzzle = await Puzzle.findById(puzzleId).select('+solutionGrid');

    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: 'Puzzle not found'
      });
    }

    console.log(`[Puzzle] Solution grid:`, JSON.stringify(puzzle.solutionGrid));

    // Compare grids
    const result = compareGrids(grid, puzzle.solutionGrid);

    // Update or create attempt
    let attempt = await PuzzleAttempt.findOne({
      userId: req.user._id,
      puzzleId
    });

    if (!attempt) {
      attempt = new PuzzleAttempt({
        userId: req.user._id,
        puzzleId,
        currentGrid: grid
      });
    } else {
      attempt.currentGrid = grid;
    }

    attempt.attempts += 1;
    attempt.status = result.status;
    if (result.status === 'correct') {
      await attempt.markComplete('correct');
    } else {
      await attempt.save();
    }

    res.status(200).json({
      success: true,
      result: {
        status: result.status,
        message: result.message,
        incorrectCells: result.incorrectCells || [],
        correctCells: result.correctCells || [],
        attempts: attempt.attempts,
        timeTakenSeconds: attempt.timeTakenSeconds || null,
        finishedAt: attempt.finishedAt || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Save user's current grid progress
 * @route   POST /api/puzzle/save
 * @access  Private
 */
const saveProgress = async (req, res, next) => {
  try {
    const { grid, puzzleId } = req.body;
    // Use an atomic upsert to avoid optimistic concurrency/version errors
    const filter = { userId: req.user._id, puzzleId };
    const update = { $set: { currentGrid: grid } };
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };

    // If creating new attempt, ensure currentGrid has correct dimensions
    if (!grid || !Array.isArray(grid)) {
      return res.status(400).json({ success: false, error: 'Invalid grid' });
    }

    await PuzzleAttempt.findOneAndUpdate(filter, update, options);

    res.status(200).json({
      success: true,
      message: 'Progress saved'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get hint for puzzle
 * @route   POST /api/puzzle/hint
 * @access  Private
 */
const getHint = async (req, res, next) => {
  try {
    const { puzzleId } = req.body;

    const puzzle = await Puzzle.findById(puzzleId).select('+solutionGrid');

    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: 'Puzzle not found'
      });
    }

    // Mark hint as used in attempt
    let attempt = await PuzzleAttempt.findOne({
      userId: req.user._id,
      puzzleId
    });

    if (!attempt) {
      attempt = new PuzzleAttempt({
        userId: req.user._id,
        puzzleId,
        currentGrid: Array(puzzle.gridSize).fill(null).map(() =>
          Array(puzzle.gridSize).fill('')
        )
      });
    }

    await attempt.useHint();

    // Build hint letters map - return the actual letters for hint cells
    const hintLetters = {};
    puzzle.hintCells.forEach(hc => {
      const key = `${hc.row},${hc.col}`;
      hintLetters[key] = puzzle.solutionGrid[hc.row]?.[hc.col] || '';
    });

    const message = (puzzle.hintCells && puzzle.hintCells.length > 0)
      ? 'Hint cells highlighted - fill in the highlighted cells!'
      : 'No hints available for this puzzle';

    res.status(200).json({
      success: true,
      hintCells: puzzle.hintCells || [],
      hintLetters, // Map of cell positions to letters
      message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get yesterday's puzzle result
 * @route   GET /api/puzzle/yesterday
 * @access  Private
 */
const getYesterdayResult = async (req, res, next) => {
  try {
    const puzzle = await Puzzle.getYesterdaysPuzzle();

    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: 'No puzzle available from yesterday'
      });
    }

    // Get user's attempt
    const attempt = await PuzzleAttempt.findOne({
      userId: req.user._id,
      puzzleId: puzzle._id
    });

    // Generate clipboard text - For yesterday we usually show the solution
    const clipboardText = generateClipboardText({
      solutionGrid: puzzle.solutionGrid,
      hintCells: puzzle.hintCells,
      puzzleDate: puzzle.puzzleDate,
      type: 'solution'
    });

    res.status(200).json({
      success: true,
      puzzle: {
        id: puzzle._id,
        puzzleDate: puzzle.puzzleDate,
        gridSize: puzzle.gridSize,
        solutionGrid: puzzle.solutionGrid,
        hintCells: puzzle.hintCells
      },
      attempt: attempt ? {
        hintUsed: attempt.hintUsed,
        status: attempt.status,
        completedAt: attempt.completedAt
      } : null,
      clipboardText
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Report a problem with puzzle
 * @route   POST /api/puzzle/report
 * @access  Private
 */
const reportProblem = async (req, res, next) => {
  try {
    const { puzzleId, userGrid, reportType, description } = req.body;

    // Get user's attempt
    const attempt = await PuzzleAttempt.findOne({
      userId: req.user._id,
      puzzleId
    });

    const report = await Report.create({
      userId: req.user._id,
      puzzleId,
      userGrid,
      hintUsed: attempt?.hintUsed || false,
      reportType: reportType || 'other',
      description
    });

    res.status(201).json({
      success: true,
      message: 'Problem reported successfully. Thank you for your feedback!',
      reportId: report._id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get sharing result for a puzzle
 * @route   GET /api/puzzle/share/:puzzleId
 * @access  Private
 */
const getShareResult = async (req, res, next) => {
  try {
    const { puzzleId } = req.params;

    // Get puzzle with solution
    const puzzle = await Puzzle.findById(puzzleId).select('+solutionGrid');

    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: 'Puzzle not found'
      });
    }

    // Get user's attempt
    const attempt = await PuzzleAttempt.findOne({
      userId: req.user._id,
      puzzleId: puzzle._id
    });

    console.log(`[Share] Attempt for user ${req.user._id}:`, attempt ? { attempts: attempt.attempts, hintUsed: attempt.hintUsed } : 'No attempt');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: 'No attempt found for this puzzle'
      });
    }

    // Determine share type from query
    const { type = 'performance' } = req.query;

    // Generate clipboard text
    const clipboardText = generateClipboardText({
      solutionGrid: puzzle.solutionGrid,
      userGrid: attempt.currentGrid,
      hintCells: puzzle.hintCells,
      puzzleDate: puzzle.puzzleDate,
      timeTakenSeconds: attempt.timeTakenSeconds || 0,
      hintUsed: attempt.hintUsed,
      attempts: attempt.attempts,
      type
    });

    res.status(200).json({
      success: true,
      clipboardText
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's puzzle history
 * @route   GET /api/puzzle/history
 * @access  Private
 */
const getHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const attempts = await PuzzleAttempt.find({ userId: req.user._id })
      .populate('puzzleId', 'puzzleDate gridSize dailyMessage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PuzzleAttempt.countDocuments({ userId: req.user._id });

    res.status(200).json({
      success: true,
      data: attempts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTodaysPuzzle,
  checkGrid,
  saveProgress,
  getHint,
  getYesterdayResult,
  reportProblem,
  getHistory,
  getShareResult
};
