const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    examType: {
      type: String,
      enum: ["MCQ", "CODING"],
      required: true,
    },

    duration: {
      type: Number, // minutes
      required: true,
    },

    instructions: {
      type: String,
    },

    // Target audience
    year: {
      type: String,
      required: true,
    },

    branch: {
      type: String,
      required: true,
    },

    section: {
      type: String,
    },

    // Faculty who created the exam
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["DRAFT", "LIVE", "COMPLETED"],
      default: "DRAFT",
    },

    // Link questions later
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],

    startTime: Date,
    endTime: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);
