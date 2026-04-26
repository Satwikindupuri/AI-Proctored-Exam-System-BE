const Exam = require("../models/Exam");
const User = require("../models/User");
const ExamAttempt = require("../models/ExamAttempt");
const Question = require("../models/Question");
const { runCode } = require("../utils/localRunner");
const CodingQuestion = require("../models/CodingQuestion");
const crypto = require("crypto");

// Demo-safe execution guards to reduce abuse and free-tier runner load.
const RUN_THROTTLE_MS = Number(process.env.CODE_RUN_THROTTLE_MS || 2000);
const RUN_CACHE_TTL_MS = Number(process.env.CODE_RUN_CACHE_TTL_MS || 120000);
const runThrottleMap = new Map();
const runCacheMap = new Map();

const makeRunCacheKey = ({ studentId, examId, questionId, language, code, input }) => {
  const hash = crypto
    .createHash("sha256")
    .update(`${language}::${code}::${input || ""}`)
    .digest("hex");

  return `${studentId}:${examId}:${questionId}:${hash}`;
};

const cleanupRunCache = () => {
  const now = Date.now();
  for (const [key, entry] of runCacheMap.entries()) {
    if (entry.expiresAt <= now) {
      runCacheMap.delete(key);
    }
  }
};

const toProfileItem = (item) => {
  if (typeof item === "string") {
    const title = item.trim();
    return title ? { title, issuer: "", date: "", link: "" } : null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const normalized = {
    title: String(item.title || "").trim(),
    issuer: String(item.issuer || "").trim(),
    date: String(item.date || "").trim(),
    link: String(item.link || "").trim(),
  };

  if (!normalized.title && !normalized.issuer && !normalized.date && !normalized.link) {
    return null;
  }

  return normalized;
};

const normalizeSkills = (skills) => {
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills
    .map((skill) => String(skill || "").trim())
    .filter(Boolean);
};

const normalizeProfileItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map(toProfileItem)
    .filter(Boolean);
};


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
      $or: [
        { section: student.section },
        { targetSections: student.section },
      ],
    }).select("title examType duration startTime");

    const examIds = exams.map((exam) => exam._id);

    const attempts = await ExamAttempt.find({
      student: req.user.id,
      exam: { $in: examIds },
      status: { $in: ["STARTED", "SUBMITTED", "AUTO_SUBMITTED"] },
    })
      .select("exam status createdAt")
      .sort({ createdAt: -1 });

    const attemptMap = new Map();
    attempts.forEach((attempt) => {
      const examKey = String(attempt.exam);
      if (!attemptMap.has(examKey)) {
        attemptMap.set(examKey, attempt.status);
      }
    });

    const payload = exams.map((exam) => {
      const attemptStatus = attemptMap.get(String(exam._id)) || null;

      return {
        ...exam.toObject(),
        attempted: Boolean(attemptStatus),
        attemptStatus,
      };
    });

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch live exams" });
  }
};


// @desc    Get completed exam results for a student
// @route   GET /api/student/results
// @access  Student
exports.getStudentResults = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({
      student: req.user.id,
      status: { $in: ["SUBMITTED", "AUTO_SUBMITTED"] },
    })
      .populate({
        path: "exam",
        select: "title examType questions codingQuestions",
      })
      .sort({ endTime: -1, createdAt: -1 });

    const results = attempts
      .filter((attempt) => attempt.exam)
      .map((attempt) => {
        const isAutoSubmitted = attempt.status === "AUTO_SUBMITTED";
        const totalQuestions = attempt.exam.examType === "CODING"
          ? attempt.exam.codingQuestions.length
          : attempt.exam.questions.length;

        return {
          _id: attempt._id,
          examId: attempt.exam._id,
          examTitle: attempt.exam.title,
          examType: attempt.exam.examType,
          status: attempt.status,
          isFlagged: isAutoSubmitted,
          score: isAutoSubmitted ? null : attempt.score,
          totalQuestions,
          endTime: attempt.endTime,
        };
      });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch student results" });
  }
};


// @desc    Get analysis data for a student
// @route   GET /api/student/analysis
// @access  Student
exports.getStudentAnalysis = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({
      student: req.user.id,
      status: { $in: ["SUBMITTED", "AUTO_SUBMITTED"] },
    })
      .populate({
        path: "exam",
        select: "title examType questions codingQuestions",
      })
      .sort({ endTime: 1, createdAt: 1 });

    const validAttempts = attempts.filter((attempt) => attempt.exam);

    const chartData = validAttempts.map((attempt, index) => {
      const totalQuestions = attempt.exam.examType === "CODING"
        ? attempt.exam.codingQuestions.length
        : attempt.exam.questions.length;
      const isAutoSubmitted = attempt.status === "AUTO_SUBMITTED";
      const flaggedCount = Math.max(attempt.violations.length, isAutoSubmitted ? 1 : 0);
      const marksScored = isAutoSubmitted ? 0 : attempt.score;
      const accuracy = totalQuestions > 0 && !isAutoSubmitted
        ? Math.round((marksScored / totalQuestions) * 100)
        : 0;

      return {
        id: attempt._id,
        examTitle: attempt.exam.title,
        shortTitle: attempt.exam.title.length > 14
          ? `${attempt.exam.title.slice(0, 14)}...`
          : attempt.exam.title,
        attemptNumber: index + 1,
        examType: attempt.exam.examType,
        status: attempt.status,
        testsDone: index + 1,
        marksScored,
        totalQuestions,
        accuracy,
        flaggedCount,
        submittedAt: attempt.endTime,
      };
    });

    const testsDone = validAttempts.length;
    const totalMarksScored = chartData.reduce((sum, item) => sum + item.marksScored, 0);
    const totalPossibleMarks = chartData.reduce((sum, item) => sum + item.totalQuestions, 0);
    const totalFlagged = chartData.reduce((sum, item) => sum + item.flaggedCount, 0);
    const genuineAttempts = chartData.filter((item) => item.status === "SUBMITTED").length;
    const accuracy = totalPossibleMarks > 0
      ? Math.round((totalMarksScored / totalPossibleMarks) * 100)
      : 0;
    const averageMarks = testsDone > 0
      ? Number((totalMarksScored / testsDone).toFixed(1))
      : 0;

    res.json({
      summary: {
        testsDone,
        totalMarksScored,
        totalPossibleMarks,
        accuracy,
        totalFlagged,
        genuineAttempts,
        averageMarks,
      },
      chartData,
      recentAttempts: [...chartData]
        .reverse()
        .slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch student analysis" });
  }
};


// @desc    Get student profile data
// @route   GET /api/student/profile
// @access  Student
exports.getStudentProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name email role rollNo year branch section phone skills achievements certificates resumeUrl"
    );

    if (!user) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      rollNo: user.rollNo,
      year: user.year,
      branch: user.branch,
      section: user.section,
      phone: user.phone || "",
      skills: normalizeSkills(user.skills),
      achievements: normalizeProfileItems(user.achievements),
      certificates: normalizeProfileItems(user.certificates),
      resumeUrl: user.resumeUrl || "",
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch student profile" });
  }
};


// @desc    Update student profile data
// @route   PATCH /api/student/profile
// @access  Student
exports.updateStudentProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Student not found" });
    }

    const updates = {};

    if (req.body.skills !== undefined) {
      updates.skills = normalizeSkills(req.body.skills);
    }

    if (req.body.achievements !== undefined) {
      updates.achievements = normalizeProfileItems(req.body.achievements);
    }

    if (req.body.certificates !== undefined) {
      updates.certificates = normalizeProfileItems(req.body.certificates);
    }

    if (req.body.resumeUrl !== undefined) {
      updates.resumeUrl = String(req.body.resumeUrl || "").trim();
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    ).select("name email role rollNo year branch section phone skills achievements certificates resumeUrl");

    res.json({
      message: "Profile updated successfully",
      profile: {
        _id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        rollNo: updated.rollNo,
        year: updated.year,
        branch: updated.branch,
        section: updated.section,
        phone: updated.phone || "",
        skills: normalizeSkills(updated.skills),
        achievements: normalizeProfileItems(updated.achievements),
        certificates: normalizeProfileItems(updated.certificates),
        resumeUrl: updated.resumeUrl || "",
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update student profile" });
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
    })
      .populate("questions")
      .populate("codingQuestions");

    if (!exam) {
      return res.status(404).json({ message: "Exam not found or not live" });
    }

    if (exam.examType === "MCQ") {
      return res.json({
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
    }

    if (exam.examType === "CODING") {
      return res.json({
        title: exam.title,
        examType: exam.examType,
        duration: exam.duration,
        instructions: exam.instructions,
        codingQuestions: exam.codingQuestions.map((q) => ({
          _id: q._id,
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
          functionName: q.functionName,
          parameters: q.parameters,
          returnType: q.returnType,
          marks: q.marks,
          sampleTestCases: q.sampleTestCases,
        })),
      });
    }
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

    let mcqScore = 0;

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
        mcqScore += 1;
      }
    }

    const codingScore = attempt.codingAnswers.reduce(
      (sum, ans) => sum + ans.score,
      0
    );

    const finalScore = mcqScore + codingScore;

    attempt.answers = answers.map((a) => ({
      question: a.questionId,
      answer: a.answer,
    }));

    attempt.score = finalScore;
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
  try {
    const { examId } = req.params;
    const { reason, count } = req.body;

    console.log("VIOLATION LOGGED:",
      {
        student: req.user.id,
        examId,
        reason,
        count,
        timestamp: new Date()
      });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Violation log error:", error);
    res.status(500).json({ success: false, message: "Failed to log violation" });
  }
};
        
// @desc    Log AI violation
// @route   POST /api/student/exams/:examId/ai-violation
exports.logAIViolation = async (req, res) => {
  try {
    const { examId } = req.params;
    const { studentId, type } = req.body;

    await ExamAttempt.updateOne(
      { exam: examId, student: studentId },
      {
        $push: {
          violations: {
            reason: type,
            time: new Date(),
          },
        },
      }
    );

    res.json({ message: "AI violation logged" });
  } catch (error) {
    console.error("AI violation log error:", error);
    res.status(500).json({ message: "Failed to log AI violation" });
  }
};

// @desc    Upload recording
// @route   POST /api/student/exams/:examId/recording
exports.uploadRecording = async (req, res) => {
  res.json({ message: "Recording uploaded successfully", file: req.file });
};

// //CODING MODULE

// @desc    Run coding question code
// @route   POST /api/student/exams/:examId/coding/:questionId/run
exports.runCodingQuestion = async (req, res) => {
try {
const { examId, questionId } = req.params;
const { code, language = "python" } = req.body;

if (!code || !String(code).trim()) {
  return res.status(400).json({ message: "Code is required" });
}

const now = Date.now();
const throttleKey = `${req.user.id}:${examId}:${questionId}`;
const lastRunAt = runThrottleMap.get(throttleKey) || 0;

if (now - lastRunAt < RUN_THROTTLE_MS) {
  return res.status(429).json({
    message: "Too many run attempts. Please wait a moment.",
    retryAfterMs: RUN_THROTTLE_MS - (now - lastRunAt),
  });
}

runThrottleMap.set(throttleKey, now);

const question = await CodingQuestion.findById(questionId);

if (!question) {
  return res.status(404).json({ message: "Question not found" });
}

const sample = question.sampleTestCases[0];
const sampleInput = sample?.input || "";

cleanupRunCache();
const cacheKey = makeRunCacheKey({
  studentId: req.user.id,
  examId,
  questionId,
  language,
  code,
  input: sampleInput,
});
const cached = runCacheMap.get(cacheKey);

if (cached && cached.expiresAt > now) {
  return res.json({
    output: cached.output,
    error: cached.error,
    expected: cached.expected,
    cached: true,
  });
}

const result = await runCode({
  language,
  code,
  input: sampleInput,
});

const payload = {
  output: result.stdout,
  error: result.stderr,
  expected: sample?.expectedOutput || "",
};

runCacheMap.set(cacheKey, {
  ...payload,
  expiresAt: now + RUN_CACHE_TTL_MS,
});

res.json({
  ...payload,
  cached: false,
});
} catch (error) {
console.error("RUN ERROR:", error);
res.status(500).json({ message: "Run failed" });
}
};


// @desc    Submit coding question answer
// @route   POST /api/student/exams/:examId/coding/:questionId/submit
exports.submitCodingQuestion = async (req, res) => {
try {
const { examId, questionId } = req.params;
const { code, language } = req.body;

const question = await CodingQuestion.findById(questionId);
if (!question) {
  return res.status(404).json({ message: "Question not found" });
}

const attempt = await ExamAttempt.findOne({
  exam: examId,
  student: req.user.id,
  status: "STARTED"
});

if (!attempt) {
  return res.status(400).json({ message: "No active attempt" });
}

if (attempt.status !== "STARTED") {
  return res.status(400).json({ message: "Exam already submitted" });
}

let passed = 0;
const totalCases = question.hiddenTestCases.length;

if (totalCases === 0) {
  return res.status(400).json({ message: "No hidden test cases configured for this question" });
}

for (const test of question.hiddenTestCases) {
  const result = await runCode({
    language,
    code,
    input: test.input
  });

  if (
    result.stdout &&
    result.stdout.trim() === test.expectedOutput.trim()
  ) {
    passed++;
  }
}

const marksAwarded = Math.floor(
  (passed / totalCases) * question.marks
);

// Check if question already submitted
const existingAnswerIndex = attempt.codingAnswers.findIndex(
  (ans) => ans.question.toString() === questionId
);

const answerData = {
  question: questionId,
  code,
  language,
  marksAwarded,
};

if (existingAnswerIndex !== -1) {
  // Subtract previous marks from total score
  attempt.score -= attempt.codingAnswers[existingAnswerIndex].marksAwarded || 0;
  
  // Replace submission
  attempt.codingAnswers[existingAnswerIndex] = answerData;
} else {
  // First time submission
  attempt.codingAnswers.push(answerData);
}

// Add new marks to accumulated score
attempt.score += marksAwarded;

await attempt.save();

res.json({
  passed,
  totalCases,
  marksAwarded
});
} catch (error) {
console.error("SUBMIT ERROR:", error);
res.status(500).json({ message: "Submit failed",
  error: error.message,
  stack: error.stack
 });
}
};

// // @desc    Submit exam - final submission
// // @route   POST /api/student/exams/:examId/submit
// // @access  Student
// exports.submitExam = async (req, res) => {
//   try {
//     const { examId } = req.params;

//     const attempt = await ExamAttempt.findOne({
//       exam: examId,
//       student: req.user.id,
//       status: "STARTED",
//     });

//     if (!attempt) {
//       return res.status(400).json({ message: "No active attempt" });
//     }

//     // MCQ score already stored in attempt.score (if you implemented earlier)
//     const mcqScore = attempt.score || 0;

//     // Calculate coding score
//     const codingScore = (attempt.codingAnswers || []).reduce(
//       (sum, ans) => sum + (ans.marksAwarded || 0),
//       0
//     );

//     const finalScore = mcqScore + codingScore;

//     attempt.score = finalScore;
//     attempt.status = "SUBMITTED";
//     attempt.endTime = new Date();

//     await attempt.save();

//     res.json({
//       message: "Exam submitted successfully",
//       mcqScore,
//       codingScore,
//       finalScore,
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Final submission failed" });
//   }
// };

// @desc    Final submit exam
// @route   POST /api/student/exams/:examId/final-submit
// @access  Student
exports.finalSubmitExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const attempt = await ExamAttempt.findOne({
      exam: examId,
      student: req.user.id,
      status: "STARTED",
    });

    if (!attempt) {
      return res.status(400).json({ message: "No active attempt found" });
    }

    // Don't recalculate score - it's already accumulated from individual submissions
    attempt.status = req.body.autoSubmit ? "AUTO_SUBMITTED" : "SUBMITTED";
    attempt.endTime = new Date();

    await attempt.save();

    res.json({
      message: "Exam submitted successfully",
      score: attempt.score,
    });
  } catch (error) {
    console.error("FINAL SUBMIT ERROR:", error);
    res.status(500).json({ message: "Final submission failed" });
  }
};


// @desc    Save periodic exam snapshot
// @route   POST /api/student/exams/:examId/snapshot
// @access  Student
exports.saveExamSnapshot = async (req, res) => {
  try {
    const { examId } = req.params;
    const { imageData, capturedAt, reason = "interval" } = req.body;

    if (!imageData || typeof imageData !== "string") {
      return res.status(400).json({ message: "Snapshot imageData is required" });
    }

    // Keep payload size reasonable for demo usage.
    if (imageData.length > 1_500_000) {
      return res.status(400).json({ message: "Snapshot payload is too large" });
    }

    const attempt = await ExamAttempt.findOne({
      exam: examId,
      student: req.user.id,
      status: "STARTED",
    });

    if (!attempt) {
      return res.status(400).json({ message: "No active attempt found" });
    }

    const MAX_SNAPSHOTS = 10;
    if ((attempt.snapshots || []).length >= MAX_SNAPSHOTS) {
      return res.status(200).json({
        message: "Snapshot limit reached",
        saved: false,
        count: attempt.snapshots.length,
      });
    }

    attempt.snapshots.push({
      imageData,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      reason,
    });

    await attempt.save();

    res.status(201).json({
      message: "Snapshot saved",
      saved: true,
      count: attempt.snapshots.length,
    });
  } catch (error) {
    console.error("SNAPSHOT SAVE ERROR:", error);
    res.status(500).json({ message: "Failed to save snapshot" });
  }
};