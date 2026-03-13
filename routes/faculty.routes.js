const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/role.middleware");
const { createExam, addManualQuestion, generateAIQuestions, saveAIQuestions, publishExam, getFlaggedStudents, getLiveExams, updateExamQuestions, endExam, getCompletedExams, getExamAttempts, getAttemptSnapshots, downloadExamQuestions, downloadAttemptsCSV,getStudentAnalysis, getStudentsByClass, createCodingQuestion, addCodingQuestionToExam, getAllExams, createAndAttachCodingQuestion } = require("../controllers/faculty.controller");
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
  "/flagged",
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
  "/exams/live",
  protect,
  roleCheck("faculty"),
  getLiveExams
);

// Publish exam (alternative route)
router.patch(
  "/exams/:examId/publish",
  protect,
  roleCheck("faculty"),
  async (req, res) => {
    await Exam.findByIdAndUpdate(req.params.examId, { status: "LIVE" });
    res.json({ message: "Exam published" });
  }
);

// Update exam questions
router.patch(
  "/exams/:examId/questions/update",
  protect,
  roleCheck("faculty"),
  updateExamQuestions
);

// End exam
router.patch(
  "/exams/:examId/end",
  protect,
  roleCheck("faculty"),
  endExam
);

// Get completed exams
router.get(
  "/exams/completed",
  protect,
  roleCheck("faculty"),
  getCompletedExams
);

// Get exam attempts
router.get(
  "/exams/:examId/attempts",
  protect,
  roleCheck("faculty"),
  getExamAttempts
);

router.get(
  "/exams/:examId/attempts/:attemptId/snapshots",
  protect,
  roleCheck("faculty"),
  getAttemptSnapshots
);

// Download exam questions
router.get(
  "/exams/:examId/questions/download",
  protect,
  roleCheck("faculty"),
  downloadExamQuestions
);

// Download exam attempts as CSV
router.get(
  "/exams/:examId/attempts/download",
  protect,
  roleCheck("faculty"),
  downloadAttemptsCSV
);

router.get(
  "/student-analysis",
  protect,
  roleCheck("faculty"),
  getStudentAnalysis
);

//
router.get(
  "/students",
  protect,
  roleCheck("faculty"),
  getStudentsByClass
);

router.post(
  "/coding-question",
  protect,
  roleCheck("faculty"),
  createCodingQuestion
);

router.post(
  "/coding-questions",
  protect,
  roleCheck("faculty"),
  createCodingQuestion
);

router.post(
  "/exams/:examId/add-coding-question",
  protect,
  roleCheck("faculty"),
  addCodingQuestionToExam
);

router.get(
  "/exams",
  protect,
  roleCheck("faculty"),
  getAllExams  
);

router.post(
  "/exams/:examId/coding-questions",
  protect,
  roleCheck("faculty"),
  createAndAttachCodingQuestion
);
module.exports = router;
