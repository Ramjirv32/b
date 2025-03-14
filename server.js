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
const PORT = process.env.PORT || 5000;
const secret = process.env.JWT_SECRET;


app.use(cors({
  origin: "*", // Allow all origins

}));

app.use(express.json());

// Only connect to MongoDB if not already connected
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGODB_URI)
      .then(() => {
          console.log("MongoDB Atlas Connected Successfully");
      })
      .catch(err => {
          console.error("MongoDB Connection Error:", err.message);
          // Don't exit in serverless environment
          if (!process.env.VERCEL) {
              process.exit(1);
          }
      });
}

// Use mongoose.models to prevent model recompilation errors in serverless environment
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
  title: String,
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  mobile: String,
  currentPosition: String,
  institute: String,
  department: String,
  organisation: { type: String, required: true },
  address: String,
  town: { type: String, required: true },
  postcode: String,
  state: String,
  country: { type: String, required: true },
  status: { type: String, required: true },
  linkedin: String,
  orcid: String,
  researchGate: String,
  paymentStatus: { type: String, default: 'pending' },
  membershipFee: String,
  createdAt: { type: Date, default: Date.now }
});

const Membership = mongoose.models.Membership || mongoose.model("Membership", membershipSchema);

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendVerificationEmail = async (email, token) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Email Verification",
        html: `
            <h2>Thank you for registering!</h2>
            <p>Please verify your email by clicking on the link below:</p>
            <a href="${process.env.FRONTEND_URL}/verify-email?token=${token}">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
        `
    };
    return transporter.sendMail(mailOptions);
};

const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset OTP",
        html: `
            <h2>Password Reset Request</h2>
            <p>Your OTP for password reset is: <strong>${otp}</strong></p>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        `
    };
    return transporter.sendMail(mailOptions);
};

const sendMembershipConfirmationEmail = async (email, firstName, lastName) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Membership Confirmation - Cyber Intelligent System",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff4757;">Welcome to Cyber Intelligent System!</h2>
        <p>Dear ${firstName} ${lastName},</p>
        
        <p>Thank you for becoming a member of Cyber Intelligent System. Your membership has been confirmed!</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2d3436;">Member Benefits:</h3>
          <ul>
            <li>Access to exclusive resources</li>
            <li>Network with industry professionals</li>
            <li>Participate in special events</li>
            <li>Regular updates on latest developments</li>
          </ul>
        </div>
        
        <p>Your membership is now active. You can access your member benefits by logging into our portal.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dfe6e9;">
          <p style="font-size: 0.8em; color: #636e72;">
            Cyber Intelligent System<br>
            Advancing the future of cybersecurity
          </p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

const verifyJWT = (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) {
        return res.status(403).json({ success: false, message: "A token is required for authentication" });
    }
    
    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid token" });
    }
};

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: "User does not exist" });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign({ email }, secret, { expiresIn: '1h' });
            return res.status(200).json({ success: true, token });
        }
        return res.status(400).json({ success: false, message: "Incorrect password" });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "An error occurred during login",
            error: error.message 
        });
    }
});

app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const hash = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(20).toString('hex');
        
        const newUser = new User({
            email,
            password: hash,
            isVerified: false,
            verificationToken
        });
        
        await newUser.save();
        await sendVerificationEmail(email, verificationToken);
        
        const token = jwt.sign({ email }, secret, { expiresIn: '1h' });
        return res.status(201).json({
            success: true,
            token,
            message: "Account created. Please check your email to verify your account."
        });
    } catch (error) {
        console.error("Signin error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "An error occurred during registration",
            error: error.message 
        });
    }
});

app.get("/",(req,res)=>{
    res.send("Welcome to Cyber Intelligent System");
});

app.get('/collections', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    res.json(collections.map(col => col.name));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching collections' });
  }
});

app.get('/verify-email', async (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(400).json({ success: false, message: "Invalid token" });
    }
    try {
        const user = await mongoose.connection.db.collection("users").findOne({ verificationToken: token });
        if (user) {
            await mongoose.connection.db.collection("users").updateOne(
                { _id: user._id },
                { $set: { isVerified: true, verificationToken: "" } }
            );
            return res.json({ success: true, message: "Email verified successfully" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid token" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "An error occurred" });
    }
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

   
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetOTP = otp;
        user.resetOTPExpires = Date.now() + 600000; 
        await user.save();

        await sendOTPEmail(email, otp);
        res.json({ success: true, message: "OTP sent to email" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error sending OTP" });
    }
});

app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({
            email,
            resetOTP: otp,
            resetOTPExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }

        res.json({ success: true, message: "OTP verified successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error verifying OTP" });
    }
});

app.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    
    console.log('Reset password request received:', { email, otp }); // Debug log

    try {
        
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log('User not found:', email);
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

      
        if (!user.resetOTP || user.resetOTP !== otp) {
            console.log('Invalid OTP:', { 
                provided: otp, 
                stored: user.resetOTP 
            });
            return res.status(400).json({ 
                success: false, 
                message: "Invalid OTP" 
            });
        }

        if (user.resetOTPExpires < Date.now()) {
            console.log('OTP expired:', user.resetOTPExpires);
            return res.status(400).json({ 
                success: false, 
                message: "OTP has expired" 
            });
        }

      
        const hash = await bcrypt.hash(newPassword, 10);
        
      
        user.password = hash;
        // user.resetOTP = undefined;
        // user.resetOTPExpires = undefined;
        await user.save();

        console.log('Password reset successful for:', email);

        res.json({ 
            success: true, 
            message: "Password reset successful" 
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error resetting password",
            error: error.message 
        });
    }
});


app.post('/api/subscribe', async (req, res) => {
    const { firstName, lastName, email, interests, frequency } = req.body;

    try {
    
        const existingSubscription = await Newsletter.findOne({ email });
        if (existingSubscription) {
            return res.status(400).json({
                success: false,
                message: "This email is already subscribed to our newsletter"
            });
        }

       
        const newSubscription = new Newsletter({
            firstName,
            lastName,
            email,
            interests,
            frequency
        });

        await newSubscription.save();

     
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Welcome to Cyber Intelligent System Newsletter",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ff4757;">Welcome to Cyber Intelligent System!</h2>
                    <p>Dear ${firstName} ${lastName},</p>
                    
                    <p>Thank you for subscribing to our newsletter. Your subscription has been confirmed!</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #2d3436;">Your Subscription Details:</h3>
                        <ul style="list-style: none; padding-left: 0;">
                            <li>Frequency: ${frequency}</li>
                            <li>Topics of Interest: ${interests.join(', ')}</li>
                        </ul>
                    </div>
                    
                    <p>You'll receive our ${frequency} newsletter with the latest updates on:</p>
                    <ul>
                        <li>Cutting-edge cyber intelligence developments</li>
                        <li>Industry insights and trends</li>
                        <li>Exclusive event invitations</li>
                        <li>Professional development opportunities</li>
                    </ul>
                    
                    <p style="color: #636e72; font-size: 0.9em;">
                        If you didn't subscribe to our newsletter, please ignore this email.
                    </p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dfe6e9;">
                        <p style="font-size: 0.8em; color: #636e72;">
                            Society for Cyber Intelligent System<br>
                            Stay connected with the future of technology
                        </p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            success: true, 
            message: "Subscription successful",
            subscription: newSubscription
        });
    } catch (error) {
        console.error('Newsletter subscription error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.code === 11000 ? "Email already subscribed" : "Failed to process subscription",
            error: error.message 
        });
    }
});


app.post('/api/unsubscribe', async (req, res) => {
    const { email } = req.body;
    try {
        const subscription = await Newsletter.findOne({ email });
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found"
            });
        }

        subscription.isActive = false;
        await subscription.save();

        res.status(200).json({
            success: true,
            message: "Successfully unsubscribed"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to unsubscribe",
            error: error.message
        });
    }
});

app.post('/api/membership', async (req, res) => {
  try {
    const membership = new Membership(req.body);
    membership.paymentStatus = 'completed'; 
    await membership.save();

    
    await sendMembershipConfirmationEmail(
      membership.email,
      membership.firstName,
      membership.lastName
    );

    res.status(201).json({ 
      success: true, 
      message: "Membership confirmed! Please check your email for confirmation.",
      membershipId: membership._id 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error processing membership",
      error: error.message 
    });
  }
});


app.post('/api/membership/payment', async (req, res) => {
  const { membershipId, paymentStatus } = req.body;
  try {
    const membership = await Membership.findByIdAndUpdate(
      membershipId,
      { paymentStatus },
      { new: true }
    );
    res.json({ 
      success: true, 
      message: "Payment status updated",
      membership 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error updating payment status",
      error: error.message 
    });
  }
});

// Conditional server start for local development
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

// Export the Express app for Vercel
export default app;