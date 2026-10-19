// Trigger nodemon restart to pick up .env changes
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = require('./app');
const connectDB = require('./config/db');
const validateEnv = require('./config/env');

// Validate environment variables
try {
  validateEnv();
} catch (error) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
      // EmailJS status
      const emailConfigured = process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_PRIVATE_KEY;
      console.log(`[EmailJS] Configured: ${emailConfigured ? 'YES' : 'NO'}`);
      if (emailConfigured) {
        console.log(`[EmailJS] Service ID: ${process.env.EMAILJS_SERVICE_ID || 'service_t1l15ge'}`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

startServer();
