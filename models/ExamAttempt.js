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
        // MCQ: selected option; Coding: submitted source code
        answer: {
          type: String,
          default: "",
        },

        // Coding evaluation tracking
        passedTestCases: {
          type: Number,
          default: 0,
        },
        totalTestCases: {
          type: Number,
          default: 0,
        },
        score: {
          type: Number,
          default: 0,
        },
      },
    ],

    codingAnswers: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CodingQuestion",
        },
        code: String,
        language: String,
        passedCases: Number,
        totalCases: Number,
        marksAwarded: Number,
      },
    ],

    violations: [
      {
        reason: String,
        time: Date,
      },
    ],

    snapshots: [
      {
        imageData: {
          type: String,
          required: true,
        },
        capturedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          default: "interval",
        },
      },
    ],


    score: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExamAttempt", examAttemptSchema);
