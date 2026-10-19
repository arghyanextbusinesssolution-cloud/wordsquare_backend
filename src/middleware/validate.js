const { validationResult, body, param, query } = require('express-validator');

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validation rules for registration
 */
const registerRules = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Name cannot exceed 50 characters')
];

/**
 * Validation rules for login
 */
const loginRules = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Validation rules for puzzle creation
 */
const puzzleCreateRules = [
  body('puzzleDate')
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('gridSize')
    .isInt({ min: 3, max: 10 })
    .withMessage('Grid size must be between 3 and 10'),
  body('words')
    .isArray({ min: 1 })
    .withMessage('At least one word is required'),
  body('words.*.word')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Word cannot be empty'),
  body('words.*.startRow')
    .isInt({ min: 0 })
    .withMessage('Start row must be a non-negative integer'),
  body('words.*.startCol')
    .isInt({ min: 0 })
    .withMessage('Start column must be a non-negative integer'),
  body('words.*.direction')
    .isIn(['horizontal', 'vertical'])
    .withMessage('Direction must be horizontal or vertical'),
  body('visibleCells')
    .optional()
    .isArray()
    .withMessage('Visible cells must be an array'),
  body('hintCells')
    .optional()
    .isArray()
    .withMessage('Hint cells must be an array'),
  body('dailyMessage')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Daily message cannot exceed 500 characters')
];

/**
 * Validation rules for grid check
 */
const gridCheckRules = [
  body('grid')
    .isArray()
    .withMessage('Grid must be an array'),
  body('grid.*')
    .isArray()
    .withMessage('Each row must be an array')
];

/**
 * Validation rules for report
 */
const reportRules = [
  body('puzzleId')
    .isMongoId()
    .withMessage('Invalid puzzle ID'),
  body('userGrid')
    .isArray()
    .withMessage('User grid must be an array'),
  body('reportType')
    .optional()
    .isIn(['bug', 'incorrect_solution', 'display_issue', 'other'])
    .withMessage('Invalid report type'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters')
];

/**
 * MongoDB ObjectId validation
 */
const mongoIdRule = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName}`)
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  puzzleCreateRules,
  gridCheckRules,
  reportRules,
  mongoIdRule
};
