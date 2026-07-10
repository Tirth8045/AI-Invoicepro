const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();
const upload = multer(); // parses multipart/form-data (FormData) fields into req.body

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[0-9]{10}$/;

// ===================== SIGNUP =====================
// mirrors auth.php action=signup
router.post("/signup", upload.none(), async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const mobile = (req.body.mobile || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const pass = (req.body.password || "").trim();

    if (!name || !mobile || !email || !pass) {
      return res.json({ success: false, message: "All fields are required!" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.json({ success: false, message: "Invalid email address!" });
    }
    if (!MOBILE_RE.test(mobile)) {
      return res.json({ success: false, message: "Enter valid 10-digit mobile number!" });
    }
    if (pass.length < 4) {
      return res.json({ success: false, message: "Password must be at least 4 characters!" });
    }

    const existingemail = await User.findOne({ email});
    if (existingemail) {
      return res.json({ success: false, message: "Email already registered! Please login." });
    }

    const existingmobile = await User.findOne({ mobile});
    if (existing) {
      return res.json({ success: false, message: "Mobile already registered! Please login." });
    }

    const hashed = await bcrypt.hash(pass, 10);
    await User.create({ name, mobile, email, password: hashed });

    return res.json({ success: true, message: "Signup successful! Please login." });
  } catch (err) {
    return res.json({ success: false, message: "Signup failed: " + err.message });
  }
});

// ===================== LOGIN =====================
// mirrors auth.php action=login (login with email OR mobile)
router.post("/login", upload.none(), async (req, res) => {
  try {
    const user = (req.body.user || "").trim();
    const pass = (req.body.password || "").trim();
    const remember = req.body.remember || "no";

    if (!user || !pass) {
      return res.json({ success: false, message: "Please fill all fields!" });
    }

    const foundUser = await User.findOne({
      $or: [{ email: user.toLowerCase() }, { mobile: user }]
    });

    if (!foundUser) {
      return res.json({ success: false, message: "No account found with this email or mobile!" });
    }

    const match = await bcrypt.compare(pass, foundUser.password);
    if (!match) {
      return res.json({ success: false, message: "Incorrect password!" });
    }

    req.session.userId = foundUser._id.toString();
    req.session.userName = foundUser.name;

    if (remember === "yes") {
      res.cookie("remember_email", user, { maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
    } else {
      res.clearCookie("remember_email", { path: "/" });
    }

    return res.json({
      success: true,
      message: "Login successful!",
      name: foundUser.name,
      redirect: "/dashboard.html"
    });
  } catch (err) {
    return res.json({ success: false, message: "Login failed: " + err.message });
  }
});

// ===================== SESSION CHECK =====================
// used by dashboard.html on load, since there's no server-side page render/redirect like dashboard.php
router.get("/me", async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ success: false, message: "Not logged in" });
  }
  try {
    const user = await User.findById(req.session.userId).select("name email profilePic");
    if (!user) return res.json({ success: false, message: "User not found" });
    return res.json({
      success: true,
      data: { id: user._id, name: user.name, email: user.email, profilePic: user.profilePic }
    });
  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
});

// ===================== LOGOUT =====================
// mirrors logout.php
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("remember_email", { path: "/" });
    res.clearCookie("connect.sid");
    res.redirect("/index.html");
  });
});

module.exports = router;
