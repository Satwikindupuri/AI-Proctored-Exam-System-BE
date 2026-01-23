const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/role.middleware");
const { createExam, addManualQuestion, generateAIQuestions, saveAIQuestions, publishExam, getFlaggedStudents, getCompletedExams, getLiveExams } = require("../controllers/faculty.controller");
const Exam = require("../models/Exam");

// Test route (faculty only)
router.get("/dashboard", protect, roleCheck("faculty"), (req, res) => {
  res.json({
    message: "Welcome Faculty",
    user: req.user,
  });
});

// Create new exam
router.post(
  "/exams",
  protect,
  roleCheck("faculty"),
  createExam
);

// Add manual question
router.post(
  "/exams/:examId/questions/manual",
  protect,
  roleCheck("faculty"),
  addManualQuestion
);

// AI question generation
router.post(
  "/exams/:examId/questions/ai-generate",
  protect,
  roleCheck("faculty"),
  generateAIQuestions
);

// Save approved AI questions
router.post(
  "/exams/:examId/questions/ai-save",
  protect,
  roleCheck("faculty"),
  saveAIQuestions
);

// Publish exam
router.put(
  "/exams/:examId/publish",
  protect,
  roleCheck("faculty"),
  publishExam
);

// Get flagged students
router.get(
  "/flagged-students",
  protect,
  roleCheck("faculty"),
  getFlaggedStudents
);

// Get completed exams
router.get(
  "/completed-exams",
  protect,
  roleCheck("faculty"),
  getCompletedExams
);

// Get live exams
router.get(
  "/live-exams",
  protect,
  roleCheck("faculty"),
  getLiveExams
);

router.patch(
  "/exams/:examId/publish",
  protect,
  roleCheck("faculty"),
  async (req, res) => {
    await Exam.findByIdAndUpdate(req.params.examId, { status: "LIVE" });
    res.json({ message: "Exam published" });
  }
);


module.exports = router;
