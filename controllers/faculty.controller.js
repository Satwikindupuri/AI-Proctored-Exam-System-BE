const Question = require("../models/Question");
const Exam = require("../models/Exam");
const ExamAttempt = require("../models/ExamAttempt");

// @desc    Create new exam (Faculty)
// @route   POST /api/faculty/exams
// @access  Faculty
exports.createExam = async (req, res) => {
  try {
    const {
      title,
      examType,
      duration,
      instructions,
      year,
      branch,
      section,
    } = req.body;

    if (!title || !examType || !duration || !year || !branch) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const exam = await Exam.create({
      title,
      examType,
      duration,
      instructions,
      year,
      branch,
      section,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "Exam created successfully",
      exam,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create exam" });
  }
};


// @desc    Add manual question to exam
// @route   POST /api/faculty/exams/:examId/questions/manual
// @access  Faculty
exports.addManualQuestion = async (req, res) => {
  try {
    const { examId } = req.params;
    console.log("ADD QUESTION :  examId = ", examId);
    console.log("USER ID : ", req.user.id);

    const {
      questionType,
      questionText,
      options,
      correctAnswer,
      sampleInput,
      sampleOutput,
      difficulty,
    } = req.body;

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.status !== "DRAFT") {
      return res
        .status(400)
        .json({ message: "Cannot add questions to live exam" });
    }

    if (!questionType || !questionText) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const question = await Question.create({
      exam: examId,
      questionType,
      questionText,
      options: questionType === "MCQ" ? options : [],
      correctAnswer,
      sampleInput,
      sampleOutput,
      difficulty,
      source: "MANUAL",
      createdBy: req.user.id,
    });

    exam.questions.push(question._id);
    await exam.save();

    res.status(201).json({
      message: "Question added successfully",
      question,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add question" });
  }
};

// @desc    Generate AI questions (draft)
// @route   POST /api/faculty/exams/:examId/questions/ai-generate
// @access  Faculty
exports.generateAIQuestions = async (req, res) => {
try {
  console.log("AI GEN BODY=", req.body);

const { examId } = req.params;
const { syllabus, numberOfQuestions, difficulty = "MEDIUM" } = req.body;

if (!syllabus || !numberOfQuestions) {
  return res.status(400).json({ message: "Required fields missing" });
}

const exam = await Exam.findById(examId);

if (!exam) return res.status(404).json({ message: "Exam not found" });

if (exam.createdBy.toString() !== req.user.id) {
  return res.status(403).json({ message: "Not authorized" });
}

if (exam.status !== "DRAFT") {
  return res.status(400).json({ message: "Cannot modify published exam" });
}

// 🔥 AI LOGIC (mocked for now)
const generatedQuestions = [];

for (let i = 1; i <= numberOfQuestions; i++) {
  generatedQuestions.push({
    exam: examId,
    questionType: "MCQ",
    questionText: `(${difficulty}) ${syllabus} - AI Question ${i}`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correctAnswer: "Option A",
    difficulty,
    source: "AI",
    createdBy: req.user.id
  });
}

const savedQuestions = await Question.insertMany(generatedQuestions);

exam.questions.push(...savedQuestions.map(q => q._id));
await exam.save();

res.json({
  message: "AI questions generated successfully",
  questions: savedQuestions
});
} catch (err) {
console.error(err);
res.status(500).json({ message: "AI generation failed" });
}
};

// @desc    Save approved AI questions
// @route   POST /api/faculty/exams/:examId/questions/ai-save
// @access  Faculty
exports.saveAIQuestions = async (req, res) => {
  try {
    const { examId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "No questions provided" });
    }

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.status !== "DRAFT") {
      return res
        .status(400)
        .json({ message: "Cannot add questions to live exam" });
    }

    const savedQuestions = [];

    for (const q of questions) {
      const question = await Question.create({
        exam: examId,
        questionType: q.questionType,
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer || "",
        difficulty: q.difficulty || "MEDIUM",
        source: "AI",
        createdBy: req.user.id,
      });

      exam.questions.push(question._id);
      savedQuestions.push(question);
    }

    await exam.save();

    res.status(201).json({
      message: "AI questions approved and saved",
      savedQuestions,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to save AI questions" });
  }
};

// @desc    Publish exam
// @route   PUT /api/faculty/exams/:examId/publish
// @access  Faculty
exports.publishExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.questions.length === 0) {
      return res
        .status(400)
        .json({ message: "Add at least one question before publishing" });
    }

    exam.status = "LIVE";
    exam.startTime = new Date();

    await exam.save();

    res.json({
      message: "Exam published successfully",
      exam,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to publish exam" });
  }
};

exports.getFlaggedStudents = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({
      $or: [
        { status: "AUTO_SUBMITTED" },
        { "violations.0": { $exists: true } }
      ]
    })
      .populate("student", "name rollNo year branch section")
      .populate("exam", "title")
      .sort({ updatedAt: -1 });

    const response = attempts.map(attempt => ({
      studentName: attempt.student.name,
      rollNo: attempt.student.rollNo,
      class: `${attempt.student.year}-${attempt.student.branch}-${attempt.student.section}`,
      examTitle: attempt.exam.title,
      violationsCount: attempt.violations.length,
      submissionType: attempt.status
    }));

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch flagged students" });
  }
};

// @desc    Get completed exams and their attempts
// @route   GET /api/faculty/completed-exams
// @access  Faculty
exports.getCompletedExams = async (req, res) => {
  try {
    // Fetch all attempts that are finished
    const attempts = await ExamAttempt.find({
      status: { $in: ["SUBMITTED", "AUTO_SUBMITTED"] }
    })
      .populate("exam", "title")
      .populate("student", "name rollNo")
      .sort({ updatedAt: -1 });

    // Group attempts by exam
    const examMap = {};

    for (const attempt of attempts) {
      const examId = attempt.exam._id.toString();

      if (!examMap[examId]) {
        examMap[examId] = {
          examId,
          title: attempt.exam.title,
          attempts: []
        };
      }

      examMap[examId].attempts.push({
        studentName: attempt.student.name,
        rollNo: attempt.student.rollNo,
        score: attempt.score,
        status: attempt.status,
        durationTaken:
          attempt.startTime && attempt.endTime
            ? Math.round(
                (attempt.endTime - attempt.startTime) / 60000
              ) + " min"
            : "-"
      });
    }

    res.json(Object.values(examMap));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch completed exams" });
  }
};

exports.getLiveExams = async (req, res) => {
  try {
    const exams = await Exam.find({ status: "LIVE", createdBy: req.user.id })
      .populate("questions")
      .sort({ createdAt: -1 });
    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch live exams" });
  }
};