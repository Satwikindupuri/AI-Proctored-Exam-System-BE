const Question = require("../models/Question");
const Exam = require("../models/Exam");
const ExamAttempt = require("../models/ExamAttempt");
const User = require("../models/User");
// Use Gemini (Google Generative AI)
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

/*
// @desc Generate AI questions (Gemini)
// @route POST /api/faculty/exams/:examId/questions/ai-generate
// @access Faculty
exports.generateAIQuestions = async (req, res) => {
try {
const { syllabus, numberOfQuestions, difficulty } = req.body;

if (!syllabus || !numberOfQuestions || !difficulty) {
  return res.status(400).json({
    message: "Syllabus, numberOfQuestions and difficulty are required"
  });
}

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

const prompt = `
You are an exam question generator.

Generate ${numberOfQuestions} multiple choice questions.

Difficulty level: 
d
i
f
f
i
c
u
l
t
y
S
y
l
l
a
b
u
s
:
difficultySyllabus:{syllabus}

Rules:

Each question must have exactly 4 options.
Only one correct answer.
Avoid explanations.
Output STRICTLY valid JSON array.
Format:

[
{
"questionText": "Question here?",
"options": ["Option A", "Option B", "Option C", "Option D"],
"correctAnswer": "Option A"
}
]
`;

const result = await model.generateContent(prompt);
const response = await result.response;
const text = response.text();

// Extract only JSON safely
const jsonStart = text.indexOf("[");
const jsonEnd = text.lastIndexOf("]") + 1;

if (jsonStart === -1 || jsonEnd === -1) {
  throw new Error("Invalid AI response format");
}

const jsonString = text.substring(jsonStart, jsonEnd);
const questions = JSON.parse(jsonString);

res.json({
  message: "Gemini AI Questions Generated Successfully",
  questions
});
} catch (error) {
console.error("GEMINI AI ERROR:", error);
res.status(500).json({
message: "AI generation failed",
error: error.message
});
}
};*/

// OPEN-ai
// @desc    Generate AI questions (draft)
// @route   POST /api/faculty/exams/:examId/questions/ai-generate
// @access  Faculty
exports.generateAIQuestions = async (req, res) => {
  try {
    const OpenAI = require("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ message: "OPENAI_API_KEY not configured" });
    }

    const { syllabus, numberOfQuestions, difficulty = "MEDIUM" } = req.body;
    const { examId } = req.params;

    if (!syllabus || !numberOfQuestions) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.status !== "DRAFT") {
      return res.status(400).json({ message: "Cannot generate questions for live exam" });
    }

    const prompt = `
You are a university-level exam paper setter.

Generate ${numberOfQuestions} MCQ questions strictly from the syllabus below:

SYLLABUS:
${syllabus}

Difficulty: ${difficulty}

STRICT RULES (MANDATORY):

Output ONLY valid JSON
Do NOT include explanations
Do NOT include markdown
Do NOT include headings
Do NOT include any text outside JSON
Use double quotes only
Exactly 4 options per question
correctAnswer must exactly match one option
JSON FORMAT (ARRAY ONLY):
[
{
"questionText": "string",
"options": ["A", "B", "C", "D"],
"correctAnswer": "one of the options"
}
]
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6
    });

    let aiQuestions;

    try {
      const raw = response.choices[0].message.content.trim();

      // Extract JSON array if extra text exists
      const jsonStart = raw.indexOf("[");
      const jsonEnd = raw.lastIndexOf("]");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("AI did not return valid JSON");
      }

      const jsonString = raw.substring(jsonStart, jsonEnd + 1);
      aiQuestions = JSON.parse(jsonString);

    } catch (parseError) {
      console.error("JSON PARSE FAILED:", response.choices[0].message.content);
      return res.status(500).json({
        message: "AI returned invalid format. Try regenerating."
      });
    }

    const savedQuestions = [];

    for (const q of aiQuestions) {
      const question = await Question.create({
        exam: examId,
        questionType: "MCQ",
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty,
        source: "AI",
        createdBy: req.user.id
      });

      exam.questions.push(question._id);
      savedQuestions.push(question);
    }

    await exam.save();

    res.json({
      message: "AI questions generated successfully",
      questions: savedQuestions
    });
  } catch (error) {
    console.error("AI GENERATION ERROR:", error);
    res.status(500).json({ message: "AI generation failed" });
  }
};


//MOCK AI FUNCTIONALITY BELOW
// exports.generateAIQuestions = async (req, res) => {
// try {
//   console.log("AI GEN BODY=", req.body);

// const { examId } = req.params;
// const { syllabus, numberOfQuestions, difficulty = "MEDIUM" } = req.body;

// if (!syllabus || !numberOfQuestions) {
//   return res.status(400).json({ message: "Required fields missing" });
// }

// const exam = await Exam.findById(examId);

// if (!exam) return res.status(404).json({ message: "Exam not found" });

// if (exam.createdBy.toString() !== req.user.id) {
//   return res.status(403).json({ message: "Not authorized" });
// }

// if (exam.status !== "DRAFT") {
//   return res.status(400).json({ message: "Cannot modify published exam" });
// }

// // 🔥 AI LOGIC (mocked for now)
// const generatedQuestions = [];

// for (let i = 1; i <= numberOfQuestions; i++) {
//   generatedQuestions.push({
//     exam: examId,
//     questionType: "MCQ",
//     questionText: `(${difficulty}) ${syllabus} - AI Question ${i}`,
//     options: ["Option A", "Option B", "Option C", "Option D"],
//     correctAnswer: "Option A",
//     difficulty,
//     source: "AI",
//     createdBy: req.user.id
//   });
// }

// const savedQuestions = await Question.insertMany(generatedQuestions);

// exam.questions.push(...savedQuestions.map(q => q._id));
// await exam.save();

// res.json({
//   message: "AI questions generated successfully",
//   questions: savedQuestions
// });
// } catch (err) {
// console.error(err);
// res.status(500).json({ message: "AI generation failed" });
// }
// };

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

// @desc    Update exam questions
// @route   PATCH /api/faculty/exams/:examId/questions
// @access  Faculty
exports.updateExamQuestions = async (req, res) => {
  try {
    const { examId } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Questions required" });
    }

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.status !== "DRAFT") {
      return res.status(400).json({
        message: "Cannot edit questions after publish"
      });
    }

    // Update each question
    for (const q of questions) {
      await Question.findByIdAndUpdate(q._id, {
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty || "MEDIUM"
      });
    }

    res.json({ message: "Questions updated successfully" });
  } catch (error) {
    console.error("UPDATE QUESTIONS ERROR:", error);
    res.status(500).json({ message: "Failed to update questions" });
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
      status: "AUTO_SUBMITTED"
    })
      .populate("student", "name rollNo year branch section")
      .populate("exam", "title")
      .sort({ updatedAt: -1 });

    const response = attempts.map(attempt => ({
      studentName: attempt.student?.name,
      rollNo: attempt.student?.rollNo,
      class: `${attempt.student?.year}-${attempt.student?.branch}-${attempt.student?.section}`,
      examTitle: attempt.exam?.title,
      flag: "AUTO_SUBMITTED"
    }));

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch flagged students" });
  }
};


// @desc    Get completed exams and their attempts
// @route   GET /api/faculty/completed-exams
// @access  Faculty
exports.getCompletedExams = async (req, res) => {
  try {
    const exams = await Exam.find({
      status: "COMPLETED",
      createdBy: req.user.id
    })
      .sort({ endTime: -1 })
      .select("title year branch section duration endTime");

    res.json(exams);
  } catch (err) {
    res.status(500).json({ message: "Failed to load completed exams" });
  }
};

// @desc    Get exam attempts for a specific exam
// @route   GET /api/faculty/exams/:examId/attempts
// @access  Faculty
exports.getExamAttempts = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({ exam: req.params.examId })
      .populate("student", "name rollNo")
      .select("score timeTaken autoSubmitted");

    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: "Failed to load attempts" });
  }
};

// @desc    Download exam questions as text file
// @route   GET /api/faculty/exams/:examId/questions/download
// @access  Faculty
exports.downloadExamQuestions = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId)
      .populate("questions");

    if (!exam) return res.status(404).json({ message: "Exam not found" });

    let content = `Exam: ${exam.title}\n\n`;

    exam.questions.forEach((q, i) => {
      content += `Q${i + 1}: ${q.questionText}\n`;
      q.options.forEach((opt, idx) => {
        content += `  ${String.fromCharCode(65 + idx)}. ${opt}\n`;
      });
      content += `Answer: ${q.correctAnswer}\n\n`;
    });

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exam.title}_questions.txt"`
    );
    res.send(content);
  } catch (err) {
    res.status(500).json({ message: "Failed to download questions" });
  }
};

// @desc    Download exam attempts as CSV
// @route   GET /api/faculty/exams/:examId/attempts/download
// @access  Faculty
exports.downloadAttemptsCSV = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({ exam: req.params.examId })
      .populate("student", "name rollNo");

    let csv = "Name,Roll No,Score,Time Taken,Auto Submitted\n";

    attempts.forEach(a => {
      csv += `${a.student.name},${a.student.rollNo},${a.score},${a.timeTaken},${a.autoSubmitted}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=attempts.csv"
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: "Failed to download CSV" });
  }
};


// @desc    Get live exams created by faculty
// @route   GET /api/faculty/live-exams
// @access  Faculty
exports.getLiveExams = async (req, res) => {
  try {
    const { year, branch, section } = req.query;

    const filter = {
      status: "LIVE",
      createdBy: req.user.id
    };

    if (year) filter.year = year;
    if (branch) filter.branch = branch;
    if (section) filter.section = section;

    const exams = await Exam.find(filter)
      .sort({ createdAt: -1 })
      .select("title year branch section duration createdAt");

    res.json(exams);
  } catch (error) {
    console.error("GET LIVE EXAMS ERROR:", error);
    res.status(500).json({ message: "Failed to load live exams" });
  }
};


// @desc    End a live exam
// @route   PUT /api/faculty/exams/:examId/end
// @access  Faculty
exports.endExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (exam.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (exam.status !== "LIVE") {
      return res.status(400).json({ message: "Exam is not live" });
    }

    exam.status = "COMPLETED";
    exam.endTime = new Date();

    await exam.save();

    res.json({ message: "Exam ended successfully" });
  } catch (error) {
    console.error("END EXAM ERROR:", error);
    res.status(500).json({ message: "Failed to end exam" });
  }
};


// @desc Get students by class
// @route GET /api/faculty/students
// @access Faculty
exports.getStudentsByClass = async (req, res) => {
  try {
    const { year, branch, section } = req.query;

    if (!year || !branch || !section) {
      return res.status(400).json({ message: "Year, branch and section required" });
    }

    const students = await User.find({
      role: "student",
      year,
      branch,
      section
    }).select("name rollNo year branch section");

    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch students" });
  }
};


// @desc Get student analysis
// @route GET /api/faculty/student-analysis/:studentId
// @access Faculty
exports.getStudentAnalysis = async (req, res) => {
  try {
    const { year, branch, section } = req.query;

    if (!year || !branch || !section) {
      return res.status(400).json({ message: "Year, branch and section are required" });
    }

    // 1️⃣ Get students of selected class
    const students = await User.find({
      role: "student",
      year,
      branch,
      section
    }).select("name rollNo year branch section");

    if (students.length === 0) {
      return res.json([]);
    }

    const studentIds = students.map(s => s._id);

    // 2️⃣ Get all exam attempts of these students
    const attempts = await ExamAttempt.find({
      student: { $in: studentIds }
    });

    // 3️⃣ Build analysis per student
    const analysis = students.map(student => {
      const studentAttempts = attempts.filter(
        a => a.student.toString() === student._id.toString()
      );

      const totalAttempts = studentAttempts.length;

      const autoSubmittedCount = studentAttempts.filter(
        a => a.status === "AUTO_SUBMITTED"
      ).length;

      // const avgScore =
      //   totalAttempts === 0
      //     ? 0
      //     : Math.round(
      //         studentAttempts.reduce((sum, a) => sum + (a.score || 0), 0) /
      //         totalAttempts
      //       );
      const scoredAttempts = studentAttempts.filter(
        a => typeof a.score === "number"
      );

      const avgScore =
        scoredAttempts.length === 0
          ? 0
          : Math.round(
              scoredAttempts.reduce((sum, a) => sum + a.score, 0) /
                scoredAttempts.length
            );

      // 4️⃣ Simple rule-based analysis
      let riskLevel = "Perfect";
      if (autoSubmittedCount >= 2) riskLevel = "High Risk";
      else if (autoSubmittedCount === 1) riskLevel = "Average";

      return {
        studentId: student._id,
        name: student.name,
        rollNo: student.rollNo,
        class: `${student.year}-${student.branch}-${student.section}`,
        totalAttempts,
        autoSubmittedCount,
        avgScore,
        riskLevel
      };
    });

    res.json(analysis);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Student analysis failed" });
  }
};