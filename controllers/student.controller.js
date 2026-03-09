const Exam = require("../models/Exam");
const User = require("../models/User");
const ExamAttempt = require("../models/ExamAttempt");
const Question = require("../models/Question");
const { runCode } = require("../utils/localRunner");
const CodingQuestion = require("../models/CodingQuestion");
const { stack } = require("../routes/student.routes");


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
      console.error("Violation log error:", err);
      res.status(500).json({ success: false, message: "Failed to log violation" });
    }
  };
        
// @desc    Log AI violation
// @route   POST /api/student/exams/:examId/ai-violation
exports.logAIViolation = async (req, res) => {
  const { examId } = req.params;
  const { studentId, type, facesDetected } = req.body;

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
};

// @desc    Upload recording
// @route   POST /api/student/exams/:examId/recording
exports.uploadRecording = async (req, res) => {
  res.json({ message: "Recording uploaded successfully", file: req.file });
};

// ================= AI PROCTORING VIOLATION =================
// @route   POST /api/student/exams/:examId/ai-violation
// @access  Student
exports.logAIViolation = async (req, res) => {
  const { studentId, type, detectedFaces } = req.body;

  await ExamAttempt.findOneAndUpdate(
    { exam: req.params.examId, student: studentId },
    {
      $push: {
        violations: {
          reason: type,
          time: new Date()
        }
      }
    }
  );

  res.json({ message: "AI violation logged" });
};



// //CODING MODULE

// @desc    Run coding question code
// @route   POST /api/student/exams/:examId/coding/:questionId/run
exports.runCodingQuestion = async (req, res) => {
try {
const { questionId } = req.params;
const { code } = req.body;

const question = await CodingQuestion.findById(questionId);

if (!question) {
  return res.status(404).json({ message: "Question not found" });
}

const sample = question.sampleTestCases[0];

const result = await runPython(code, sample.input);

res.json({
  output: result.output,
  expected: sample.expectedOutput
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