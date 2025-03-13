import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const secret = process.env.JWT_SECRET;

const allowedOrigins = [
  'http://societycis.org',
  'https://cyber-web.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.options('*', cors());

// Connect to MongoDB - only connect if not already connected
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGODB_URI)
      .then(() => {
          console.log("MongoDB Atlas Connected Successfully");
      })
      .catch(err => {
          console.error("MongoDB Connection Error:", err.message);
      });
}

// Define schemas and models
const userSchema = new mongoose.Schema({
    username: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    resetOTP: String,
    resetOTPExpires: Date
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

const newsletterSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    interests: [String],
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    subscriptionDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
});

const Newsletter = mongoose.models.Newsletter || mongoose.model("Newsletter", newsletterSchema);

const membershipSchema = new mongoose.Schema({
  // ...existing code...
});

const Membership = mongoose.models.Membership || mongoose.model("Membership", membershipSchema);

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper functions
const sendVerificationEmail = async (email, token) => {
    // ...existing code...
};

const sendOTPEmail = async (email, otp) => {
    // ...existing code...
};

const sendMembershipConfirmationEmail = async (email, firstName, lastName) => {
    // ...existing code...
};

const verifyJWT = (req, res, next) => {
    // ...existing code...
};

// Routes
app.get("/", (req, res) => {
    res.send("Welcome to Cyber Intelligent System API");
});

app.post("/login", async (req, res) => {
    // ...existing code...
});

app.post('/signin', async (req, res) => {
    // ...existing code...
});

app.get('/collections', async (req, res) => {
    // ...existing code...
});

app.get('/verify-email', async (req, res) => {
    // ...existing code...
});

app.post('/forgot-password', async (req, res) => {
    // ...existing code...
});

app.post('/verify-otp', async (req, res) => {
    // ...existing code...
});

app.post('/reset-password', async (req, res) => {
    // ...existing code...
});

app.post('/api/subscribe', async (req, res) => {
    // ...existing code...
});

app.post('/api/unsubscribe', async (req, res) => {
    // ...existing code...
});

app.post('/api/membership', async (req, res) => {
    // ...existing code...
});

app.post('/api/membership/payment', async (req, res) => {
    // ...existing code...
});

// Export for Vercel serverless function
export default app;
