const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },

    questionType: {
      type: String,
      enum: ["MCQ", "CODING"],
      required: true,
    },

    questionText: {
      type: String,
      required: true,
    },

    // For MCQ
    options: {
            type: [String],
            default: [],
        },

    correctAnswer: {
      type: String, // option text or code output
    },

    // For Coding questions
    sampleInput: String,
    sampleOutput: String,

    // Difficulty level
    difficulty: {
      type: String,
      enum: ["EASY", "MEDIUM", "HARD"],
      default: "MEDIUM",
    },

    // Question source
    source: {
      type: String,
      enum: ["MANUAL", "AI"],
      default: "MANUAL",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);
