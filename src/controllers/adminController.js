const { Puzzle, PuzzleAttempt, Report, User, AdminLog } = require('../models');
const { validatePuzzleConfig, buildSolutionGrid } = require('../services/puzzleService');

/**
 * @desc    Create new puzzle
 * @route   POST /api/admin/puzzle
 * @access  Admin
 */
const createPuzzle = async (req, res, next) => {
  try {
    const { puzzleDate, gridSize, words, visibleCells, hintCells, dailyMessage, acrossClues, downClues } = req.body;

    // Check if puzzle already exists for this date (using UTC boundaries)
    const date = new Date(puzzleDate);
    const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

    const existingPuzzle = await Puzzle.findOne({
      puzzleDate: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    });

    if (existingPuzzle) {
      return res.status(400).json({
        success: false,
        error: 'A puzzle already exists for this date'
      });
    }

    // Validate puzzle configuration
    const validation = validatePuzzleConfig({
      gridSize,
      words,
      visibleCells,
      hintCells
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors
      });
    }

    // Create puzzle - Ensure puzzleDate is stored at UTC midnight
    const puzzle = await Puzzle.create({
      puzzleDate: startOfDay,
      gridSize,
      solutionGrid: validation.solutionGrid,
      words,
      visibleCells: visibleCells || [],
      hintCells: hintCells || [],
      dailyMessage: dailyMessage || '',
      acrossClues: acrossClues || [],
      downClues: downClues || [],
      createdBy: req.user._id
    });

    // Log admin action
    await AdminLog.logAction(
      req.user._id,
      'puzzle_created',
      'puzzle',
      puzzle._id,
      { puzzleDate, gridSize, wordCount: words.length },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Puzzle created successfully',
      puzzle: {
        id: puzzle._id,
        puzzleDate: puzzle.puzzleDate,
        gridSize: puzzle.gridSize
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all puzzles
 * @route   GET /api/admin/puzzles
 * @access  Admin
 */
const getAllPuzzles = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const puzzles = await Puzzle.find()
      .populate('createdBy', 'email name')
      .sort({ puzzleDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Puzzle.countDocuments();

    res.status(200).json({
      success: true,
      data: puzzles,
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

/**
 * @desc    Get single puzzle with full details
 * @route   GET /api/admin/puzzle/:id
 * @access  Admin
 */
const getPuzzle = async (req, res, next) => {
  try {
    const puzzle = await Puzzle.findById(req.params.id)
      .select('+solutionGrid')
      .populate('createdBy', 'email name');

    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: 'Puzzle not found'
      });
    }

    // Get attempt statistics
    const attemptStats = await PuzzleAttempt.aggregate([
      { $match: { puzzleId: puzzle._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      puzzle,
      stats: {
        attempts: attemptStats
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update puzzle
 * @route   PUT /api/admin/puzzle/:id
 * @access  Admin
 */
const updatePuzzle = async (req, res, next) => {
  try {
    const {
      gridSize,
      words,
      visibleCells,
      hintCells,
      dailyMessage,
      isActive,
      acrossClues,
      downClues,
      puzzleDate,
      solutionGrid
    } = req.body;

    let puzzle = await Puzzle.findById(req.params.id);

    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: 'Puzzle not found'
      });
    }

    const now = new Date();
    const puzzleScheduledDate = new Date(puzzle.puzzleDate);
    const millisecondsUntilPublished = puzzleScheduledDate.getTime() - now.getTime();
    const hoursUntilPublished = millisecondsUntilPublished / (1000 * 60 * 60);

    // If puzzle is already published (past its date), block most edits
    if (hoursUntilPublished <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot edit a puzzle that has already been published'
      });
    }

    // Logic for "48 hours before" or "within 48 hours"
    // Requirement was specific about what can be changed within 48 hours.
    // If it's more than 48 hours away, admin has full access.
    // Actually, the user list of "admin can only change" seems to cover ALMOST everything (clues, letters, date, hints, message).
    // Let's refine based on the prompt: 
    // "the admin can pnly chaneg the clues , the letters from teh puzzle , the published date ... the hints celles and visible celles , and also the daily message"

    // Check if puzzleDate is changed and if it collides/is future
    if (puzzleDate) {
      const d = new Date(puzzleDate);
      const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

      // Validate future date (compare with current UTC time, start of day)
      // Allow a 12-hour grace period for "past" dates to handle US timezones
      const now = new Date();
      const bufferTime = 12 * 60 * 60 * 1000; // 12 hours
      const earliestAllowed = new Date(now.getTime() - bufferTime);
      earliestAllowed.setUTCHours(0, 0, 0, 0);

      if (startOfDay < earliestAllowed) {
        return res.status(400).json({
          success: false,
          error: 'Publication date must be today or in the future'
        });
      }

      // Check for collision (excluding current puzzle)
      const collision = await Puzzle.findOne({
        _id: { $ne: puzzle._id },
        puzzleDate: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      });

      if (collision) {
        return res.status(400).json({
          success: false,
          error: 'A puzzle already exists for this date'
        });
      }

      puzzle.puzzleDate = startOfDay;
    }

    // Handle grid/word updates
    // Priority: If solutionGrid is provided directly, use it.
    // Otherwise, if words or gridSize changed, rebuild it.
    if (solutionGrid) {
      puzzle.solutionGrid = solutionGrid;
      if (gridSize) puzzle.gridSize = gridSize;
      if (words) puzzle.words = words;
    } else if (words || gridSize) {
      const newGridSize = gridSize || puzzle.gridSize;
      const newWords = words || puzzle.words;

      const validation = validatePuzzleConfig({
        gridSize: newGridSize,
        words: newWords,
        visibleCells: visibleCells || puzzle.visibleCells,
        hintCells: hintCells || puzzle.hintCells
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }

      puzzle.solutionGrid = validation.solutionGrid;
      puzzle.gridSize = newGridSize;
      puzzle.words = newWords;
    }

    if (visibleCells) puzzle.visibleCells = visibleCells;
    if (hintCells) puzzle.hintCells = hintCells;
    if (dailyMessage !== undefined) puzzle.dailyMessage = dailyMessage;
    if (isActive !== undefined) puzzle.isActive = isActive;
    if (acrossClues) puzzle.acrossClues = acrossClues;
    if (downClues) puzzle.downClues = downClues;

    await puzzle.save();

    // Log admin action
    await AdminLog.logAction(
      req.user._id,
      'puzzle_updated',
      'puzzle',
      puzzle._id,
      { updatedFields: Object.keys(req.body) },
      req
    );

    res.status(200).json({
      success: true,
      message: 'Puzzle updated successfully',
      puzzle: {
        id: puzzle._id,
        puzzleDate: puzzle.puzzleDate,
        gridSize: puzzle.gridSize
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete puzzle
 * @route   DELETE /api/admin/puzzle/:id
 * @access  Admin
 */
const deletePuzzle = async (req, res, next) => {
  try {
    const puzzle = await Puzzle.findById(req.params.id);

    if (!puzzle) {
      return res.status(404).json({
        success: false,
        error: 'Puzzle not found'
      });
    }

    // Delete associated attempts
    await PuzzleAttempt.deleteMany({ puzzleId: puzzle._id });

    // Delete puzzle
    await puzzle.deleteOne();

    // Log admin action
    await AdminLog.logAction(
      req.user._id,
      'puzzle_deleted',
      'puzzle',
      req.params.id,
      { puzzleDate: puzzle.puzzleDate },
      req
    );

    res.status(200).json({
      success: true,
      message: 'Puzzle deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all reports
 * @route   GET /api/admin/reports
 * @access  Admin
 */
const getReports = async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = status === 'all' ? {} : { status };

    const reports = await Report.find(query)
      .populate('userId', 'email name')
      .populate('puzzleId', 'puzzleDate gridSize')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Report.countDocuments(query);

    res.status(200).json({
      success: true,
      data: reports,
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

/**
 * @desc    Resolve a report
 * @route   PUT /api/admin/report/:id
 * @access  Admin
 */
const resolveReport = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    report.status = status;
    report.adminNotes = adminNotes;
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();

    await report.save();

    // Log admin action
    await AdminLog.logAction(
      req.user._id,
      'report_resolved',
      'report',
      report._id,
      { newStatus: status },
      req
    );

    res.status(200).json({
      success: true,
      message: 'Report updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin dashboard stats
 * @route   GET /api/admin/stats
 * @access  Admin
 */
const getDashboardStats = async (req, res, next) => {
  try {
    // Use a trailing 24-hour window for "today" stats to avoid abrupt UTC resets
    const now = new Date();
    const today = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const tomorrow = new Date(now);
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 1);

    const [
      totalUsers,
      totalPuzzles,
      pendingReports,
      todayAttempts,
      nextPuzzle,
      recentActivity
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Puzzle.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      PuzzleAttempt.countDocuments({ createdAt: { $gte: today } }),
      Puzzle.findOne({ puzzleDate: { $gte: tomorrow, $lt: dayAfterTomorrow } }),
      AdminLog.find()
        .populate('adminId', 'email name')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalPuzzles,
        pendingReports,
        todayAttempts,
        nextPuzzleScheduled: !!nextPuzzle
      },
      recentActivity
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all users (admin)
 * @route   GET /api/admin/users
 * @access  Admin
 */
const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find({ role: 'user' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({ role: 'user' });

    res.status(200).json({
      success: true,
      data: users,
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

/**
 * @desc    Get user attempts for a specific puzzle
 * @route   GET /api/admin/puzzle/:id/attempts
 * @access  Admin
 */
const getPuzzleAttempts = async (req, res, next) => {
  try {
    const attempts = await PuzzleAttempt.find({ puzzleId: req.params.id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      attempts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/admin/user/:id
 * @access  Admin
 */
const deleteUser = async (req, res, next) => {
  try {
    const userToDelete = await User.findById(req.params.id);

    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Safety check: Prevent deleting admins
    if (userToDelete.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete admin users'
      });
    }

    // Delete associated data
    await Promise.all([
      PuzzleAttempt.deleteMany({ userId: userToDelete._id }),
      Report.deleteMany({ userId: userToDelete._id })
    ]);

    // Delete user
    await userToDelete.deleteOne();

    // Log admin action
    await AdminLog.logAction(
      req.user._id,
      'user_deleted',
      'user',
      req.params.id,
      { email: userToDelete.email },
      req
    );

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const Settings = require('../models/Settings');

// ... existing code ...

/**
 * @desc    Get site settings
 * @route   GET /api/admin/settings
 * @access  Admin
 */
const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update site settings
 * @route   PUT /api/admin/settings
 * @access  Admin
 */
const updateSettings = async (req, res, next) => {
  try {
    const { siteName, siteDescription } = req.body;
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({ siteName, siteDescription });
    } else {
      if (siteName !== undefined) settings.siteName = siteName;
      if (siteDescription !== undefined) settings.siteDescription = siteDescription;
    }

    await settings.save();

    // Log admin action
    await AdminLog.logAction(
      req.user._id,
      'settings_changed',
      'settings',
      null,
      { siteName, siteDescription },
      req
    );

    res.status(200).json({
      success: true,
      settings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};

