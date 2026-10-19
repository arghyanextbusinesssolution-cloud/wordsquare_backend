const mongoose = require('mongoose');

const puzzleAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  puzzleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Puzzle',
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  finishedAt: {
    type: Date
  },
  timeTakenSeconds: {
    type: Number,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  currentGrid: {
    type: [[String]], // 2D array of user's current answers
    default: []
  },
  hintUsed: {
    type: Boolean,
    default: false
  },
  hintUsedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['incomplete', 'correct', 'incorrect'],
    default: 'incomplete'
  },
  attempts: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for user's puzzle attempts
puzzleAttemptSchema.index({ userId: 1, puzzleId: 1 }, { unique: true });
puzzleAttemptSchema.index({ userId: 1, status: 1 });
puzzleAttemptSchema.index({ puzzleId: 1 });

// Static method to get or create attempt
puzzleAttemptSchema.statics.getOrCreate = async function(userId, puzzleId, gridSize) {
  let attempt = await this.findOne({ userId, puzzleId });
  
  if (!attempt) {
    // Create empty grid
    const emptyGrid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill('')
    );
    
    attempt = await this.create({
      userId,
      puzzleId,
      currentGrid: emptyGrid
    });
  }
  
  // If an existing attempt is missing startedAt (older documents), set it to createdAt
  if (attempt && !attempt.startedAt) {
    attempt.startedAt = attempt.createdAt || new Date();
    await attempt.save();
  }
  
  return attempt;
};

// Method to check if attempt is complete
puzzleAttemptSchema.methods.checkCompletion = function(solutionGrid) {
  if (!this.currentGrid || !solutionGrid) return 'incomplete';
  
  let allFilled = true;
  let allCorrect = true;
  
  for (let row = 0; row < solutionGrid.length; row++) {
    for (let col = 0; col < solutionGrid[row].length; col++) {
      const userLetter = this.currentGrid[row]?.[col]?.toUpperCase() || '';
      const solutionLetter = solutionGrid[row][col]?.toUpperCase() || '';
      
      // Skip empty cells in solution (if any)
      if (!solutionLetter) continue;
      
      if (!userLetter) {
        allFilled = false;
      } else if (userLetter !== solutionLetter) {
        allCorrect = false;
      }
    }
  }
  
  if (!allFilled) return 'incomplete';
  return allCorrect ? 'correct' : 'incorrect';
};

// Method to update grid
puzzleAttemptSchema.methods.updateGrid = async function(newGrid) {
  this.currentGrid = newGrid;
  this.attempts += 1;
  await this.save();
  return this;
};

// Method to use hint
puzzleAttemptSchema.methods.useHint = async function() {
  if (!this.hintUsed) {
    this.hintUsed = true;
    this.hintUsedAt = new Date();
    await this.save();
  }
  return this;
};

// Method to mark as complete
puzzleAttemptSchema.methods.markComplete = async function(status) {
  this.status = status;
  const finished = new Date();
  this.completedAt = finished;
  this.finishedAt = finished;

  // Ensure startedAt exists; fall back to createdAt or now
  if (!this.startedAt) this.startedAt = this.createdAt || finished;

  this.timeTakenSeconds = Math.max(0, Math.floor((this.finishedAt - this.startedAt) / 1000));
  this.timeSpent = this.timeTakenSeconds;
  this.completed = true;

  await this.save();
  return this;
};

module.exports = mongoose.model('PuzzleAttempt', puzzleAttemptSchema);
