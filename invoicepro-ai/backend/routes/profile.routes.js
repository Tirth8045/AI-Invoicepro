const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const requireAuth = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();
const upload = multer();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "profiles");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

router.use(requireAuth);

// GET /api/profile?action=get
router.get("/", async (req, res) => {
  const action = req.query.action || "";
  if (action === "get") {
    const user = await User.findById(req.session.userId).select("name email profilePic");
    return res.json({
      success: true,
      data: { name: user.name, email: user.email, profile_pic: user.profilePic }
    });
  }
  return res.json({ success: false, message: "Invalid action!" });
});

// POST /api/profile (action=upload | remove)  -- sent via jQuery $.ajax (urlencoded)
router.post("/", upload.none(), async (req, res) => {
  const action = req.body.action || "";
  const userId = req.session.userId;

  // ===================== UPLOAD (base64 from Cropper.js) =====================
  if (action === "upload") {
    const imageData = req.body.image || "";
    if (!imageData) {
      return res.json({ success: false, message: "No image received!" });
    }
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    let buffer;
    try {
      buffer = Buffer.from(base64, "base64");
      if (!buffer.length) throw new Error("empty");
    } catch (e) {
      return res.json({ success: false, message: "Invalid image data!" });
    }

    const filename = `profile_${userId}_${Date.now()}.png`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const publicPath = `/uploads/profiles/${filename}`;

    try {
      fs.writeFileSync(filepath, buffer);

      const user = await User.findById(userId);
      if (user.profilePic) {
        const oldPath = path.join(__dirname, "..", user.profilePic);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.profilePic = publicPath;
      await user.save();

      return res.json({ success: true, message: "Profile picture updated!", path: publicPath });
    } catch (err) {
      return res.json({ success: false, message: "Failed to save image!" });
    }
  }

  // ===================== REMOVE =====================
  if (action === "remove") {
    try {
      const user = await User.findById(userId);
      if (user.profilePic) {
        const oldPath = path.join(__dirname, "..", user.profilePic);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.profilePic = null;
      await user.save();
      return res.json({ success: true, message: "Profile picture removed!" });
    } catch (err) {
      return res.json({ success: false, message: "Failed to remove!" });
    }
  }

  return res.json({ success: false, message: "Invalid action!" });
});

module.exports = router;
