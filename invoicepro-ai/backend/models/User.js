const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true }, // bcrypt hash
    profilePic: { type: String, default: null } // public path e.g. /uploads/profiles/xxx.png
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
