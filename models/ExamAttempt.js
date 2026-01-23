const mongoose = require("mongoose");

const examAttemptSchema = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["STARTED", "SUBMITTED", "AUTO_SUBMITTED"],
      default: "STARTED",
    },

    answers: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
        },
        answer: String,
      },
    ],

    violations: [
  {
    reason: String,
    time: Date
  }
],


    score: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExamAttempt", examAttemptSchema);
