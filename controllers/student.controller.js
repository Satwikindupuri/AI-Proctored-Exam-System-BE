const Exam = require("../models/Exam");
const User = require("../models/User");
const ExamAttempt = require("../models/ExamAttempt");
const Question = require("../models/Question");

// @desc    Get live exams for student
// @route   GET /api/student/exams/live
// @access  Student
exports.getLiveExams = async (req, res) => {
  try {
    // Fetch full student data
    const student = await User.findById(req.user.id);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const exams = await Exam.find({
      status: "LIVE",
      year: student.year,
      branch: student.branch,
      section: student.section,
    }).select("title examType duration startTime");

    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch live exams" });
  }
};


// @desc    Get exam details with questions
// @route   GET /api/student/exams/:examId
// @access  Student
exports.getExamDetails = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findOne({
      _id: examId,
      status: "LIVE",
    }).populate("questions");

    if (!exam) {
      return res.status(404).json({ message: "Exam not found or not live" });
    }

    res.json({
      title: exam.title,
      examType: exam.examType,
      duration: exam.duration,
      instructions: exam.instructions,
      questions: exam.questions.map((q) => ({
        _id: q._id,
        questionType: q.questionType,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch exam details" });
  }
};


// @desc    Start exam
// @route   POST /api/student/exams/:examId/start
// @access  Student
exports.startExam = async (req, res) => {
  try {
    const { examId } = req.params;

    // Check if exam exists & is live
    const exam = await Exam.findOne({ _id: examId, status: "LIVE" });

    if (!exam) {
      return res.status(404).json({ message: "Exam not available" });
    }

    // Prevent multiple attempts
    const existingAttempt = await ExamAttempt.findOne({
      exam: examId,
      student: req.user.id,
    });

    if (existingAttempt) {
      return res
        .status(400)
        .json({ message: "Exam already started or submitted" });
    }

    const attempt = await ExamAttempt.create({
      exam: examId,
      student: req.user.id,
      startTime: new Date(),
    });

    res.status(201).json({
      message: "Exam started",
      attemptId: attempt._id,
      startTime: attempt.startTime,
      duration: exam.duration,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to start exam" });
  }
};


// @desc    Submit exam
// @route   POST /api/student/exams/:examId/submit
// @access  Student
exports.submitExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { answers } = req.body;

    const attempt = await ExamAttempt.findOne({
      exam: examId,
      student: req.user.id,
      status: "STARTED",
    });

    if (!attempt) {
      return res.status(404).json({ message: "No active exam attempt" });
    }

    const exam = await Exam.findById(examId);
    const questions = await Question.find({ exam: examId });

    let score = 0;

    // Evaluate MCQs
    for (const q of questions) {
      const studentAnswer = answers.find(
        (a) => a.questionId === q._id.toString()
      );

      if (
        q.questionType === "MCQ" &&
        studentAnswer &&
        studentAnswer.answer === q.correctAnswer
      ) {
        score += 1;
      }
    }

    attempt.answers = answers.map((a) => ({
      question: a.questionId,
      answer: a.answer,
    }));

    attempt.score = score;
    attempt.status = req.body.autoSubmit ? "AUTO_SUBMITTED" : "SUBMITTED";
    attempt.endTime = new Date();

    await attempt.save();

    res.json({
      message: "Exam submitted successfully",
      score,
      totalQuestions: questions.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit exam" });
  }
};


// @desc    Log violation
// @route   POST /api/student/exams/:examId/violation
exports.logViolation = async (req, res) => {
  const { examId } = req.params;
  const { reason } = req.body;

  const attempt = await ExamAttempt.findOne({
    exam: examId,
    student: req.user.id,
    status: "STARTED",
  });

  if (!attempt) return res.sendStatus(200);

  attempt.violations.push({
    reason,
    time: new Date(),
  });

  await attempt.save();
  res.sendStatus(200);
};

// @desc    Upload recording
// @route   POST /api/student/exams/:examId/recording
exports.uploadRecording = async (req, res) => {
  res.json({ message: "Recording uploaded successfully", file: req.file });
};
