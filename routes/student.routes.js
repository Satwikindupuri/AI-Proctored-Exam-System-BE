const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/role.middleware");
const { getLiveExams, getExamDetails, startExam, submitExam, logAIViolation, logViolation, runCodingQuestion, submitCodingQuestion, finalSubmitExam } = require("../controllers/student.controller");
// const { runCode } = require("../utils/judge0");

// Test route (student only)
router.get("/dashboard", protect, roleCheck("student"), (req, res) => {
  res.json({
    message: "Welcome Student",
    user: req.user,
  });
});

router.get(
  "/exams/live",
  protect,
  roleCheck("student"),
  getLiveExams
);

router.get(
  "/exams/:examId",
  protect,
  roleCheck("student"),
  getExamDetails
);

router.post(
  "/exams/:examId/start",
  protect,
  roleCheck("student"),
  startExam
);

router.post(
  "/exams/:examId/submit",
  protect,
  roleCheck("student"),
  submitExam
);

router.post(
  "/exams/:examId/ai-violation",
  protect,
  roleCheck("student"),
  logAIViolation
);

router.post(
  "/exams/:examId/violation",
  protect,
  // roleCheck("student"),
  logViolation
);


/ ================= CODING MODULE =================/

// Run coding question (sample test cases only)
router.post(
"/exams/:examId/coding/:questionId/run",
protect,
roleCheck("student"),
runCodingQuestion
);

// Submit coding question (hidden test cases evaluation)
router.post(
"/exams/:examId/coding/:questionId/submit",
protect,
roleCheck("student"),
submitCodingQuestion
);

router.post(
  "/exams/:examId/final-submit",
  protect,
  roleCheck("student"),
  finalSubmitExam
);

module.exports = router;