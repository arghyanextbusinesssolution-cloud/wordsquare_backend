/**
 * Admin Seed Script
 * Creates an admin user in the database
 * 
 * Usage: npm run seed:admin
 * 
 * This script will:
 * - Connect to the database
 * - Check if admin already exists
 * - Create admin user with hashed password
 * - Log the result
 */

require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Admin credentials (change these before running!)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'mark@wordsquares.us';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mark@wordsquares.us';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

// User schema (simplified version for seeding)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

const seedAdmin = async () => {
  try {
    console.log('🔄 Connecting to database...');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists with email:', ADMIN_EMAIL);
      console.log('   If you want to create a new admin, delete the existing one first');
      process.exit(0);
    }
    
    // Hash password
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const admin = await User.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      name: ADMIN_NAME,
      role: 'admin',
      isActive: true
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('   📧 Email:', admin.email);
    console.log('   🔑 Password:', ADMIN_PASSWORD);
    console.log('   👑 Role:', admin.role);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
    process.exit(1);
  }
};

// Run the seed function
seedAdmin();
