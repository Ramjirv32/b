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

// Update the membershipSchema to include profilePhoto and membershipId
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
  profilePhoto: { type: String }, // Base64 encoded image
  membershipId: { type: String },
  issueDate: { type: Date },
  expiryDate: { type: Date },
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
            <a href="https://localhost:5173/verify-email?token=${token}">Verify Email</a>
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

const sendMembershipConfirmationEmail = async (email, firstName, lastName, membershipId, issueDate, expiryDate) => {
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
          <h3 style="color: #2d3436;">Your Membership Details:</h3>
          <ul>
            <li><strong>Membership ID:</strong> ${membershipId}</li>
            <li><strong>Issue Date:</strong> ${issueDate}</li>
            <li><strong>Expiry Date:</strong> ${expiryDate}</li>
            <li><strong>Position:</strong> Member</li>
          </ul>
        </div>
        
        <p>Your membership is now active. You can access your member benefits by logging into our portal.</p>
        <p>You can view your membership card at: <a href="${process.env.FRONTEND_URL}/id-card/${membershipId}">View Membership Card</a></p>
        
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
        // Add timeout handling
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
        });

        const registrationPromise = (async () => {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ 
                    success: false, 
                    message: "User already exists" 
                });
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
            
            return res.status(201).json({
                success: true,
                token: jwt.sign({ email }, secret, { expiresIn: '1h' }),
                message: "Account created. Please check your email to verify your account."
            });
        })();

        await Promise.race([registrationPromise, timeoutPromise]);
    } catch (error) {
        console.error("Signin error:", error);
        
      
        return res.status(error.message === 'Request timeout' ? 504 : 500).json({ 
            success: false, 
            message: error.message === 'Request timeout' 
                ? "Request timed out. Please try again." 
                : "An error occurred during registration",
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

// Update the /api/membership endpoint to include ID generation
app.post('/api/membership', async (req, res) => {
  try {
    const membership = new Membership(req.body);
    membership.paymentStatus = 'completed';
    
    // Generate a unique membership ID
    const count = await Membership.countDocuments();
    const membershipId = `CIS${new Date().getFullYear()}${(count + 1).toString().padStart(4, '0')}`;
    membership.membershipId = membershipId;
    
    // Set issue date and expiry date
    const issueDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    
    membership.issueDate = issueDate;
    membership.expiryDate = expiryDate;
    
    await membership.save();

    // Update the sendMembershipConfirmationEmail to include ID card info
    await sendMembershipConfirmationEmail(
      membership.email,
      membership.firstName,
      membership.lastName,
      membershipId,
      issueDate.toLocaleDateString(),
      expiryDate.toLocaleDateString()
    );

    res.status(201).json({ 
      success: true, 
      message: "Membership confirmed! Please check your email for confirmation.",
      membershipId: membershipId,
      membership: membership
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

app.get('/api/membership/check/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const membership = await Membership.findOne({ email });
    
    if (!membership) {
      return res.json({ isMember: false });
    }
    
    // Check if membership is within 1 year
    const creationDate = new Date(membership.createdAt);
    const expiryDate = new Date(creationDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Add 1 year
    
    const isActive = new Date() < expiryDate;
    
    return res.json({ 
      isMember: isActive,
      expiryDate: expiryDate,
      status: isActive ? 'active' : 'expired'
    });
  } catch (error) {
    console.error('Error checking membership:', error);
    res.status(500).json({ 
      error: 'Error checking membership status', 
      message: error.message 
    });
  }
});

app.get('/api/membership/:id', async (req, res) => {
  try {
    const membershipId = req.params.id;
    const membership = await Membership.findOne({ membershipId });
    
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Membership not found"
      });
    }
    
    res.json({
      success: true,
      membership: {
        name: `${membership.firstName} ${membership.lastName}`,
        position: membership.currentPosition || "Member",
        idNumber: membership.membershipId,
        issueDate: new Date(membership.issueDate).toLocaleDateString(),
        expiryDate: new Date(membership.expiryDate).toLocaleDateString(),
        department: membership.department || "CYBER OPERATIONS",
        photoUrl: membership.profilePhoto
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching membership",
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