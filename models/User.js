const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const profileItemSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    issuer: { type: String, trim: true, default: "" },
    date: { type: String, trim: true, default: "" },
    link: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "faculty"],
      required: true,
    },

    rollNo: String,
    year: String,
    branch: String,
    section: String,
    phone: String,

    skills: [{ type: String, trim: true }],
    achievements: [profileItemSchema],
    certificates: [profileItemSchema],
    resumeUrl: String,
  },
  { timestamps: true }
);

// ✅ MODERN, SAFE PASSWORD HASHING (NO next)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ✅ PASSWORD MATCH
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
