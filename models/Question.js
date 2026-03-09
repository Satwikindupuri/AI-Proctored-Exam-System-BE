const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
{
exam: {
type: mongoose.Schema.Types.ObjectId,
ref: "Exam",
required: true,
},

questionType: {
  type: String,
  enum: ["MCQ", "CODING"],
  required: true,
},

questionText: {
  type: String,
  required: true,
},

// ---------------- MCQ FIELDS ----------------
options: {
  type: [String],
  default: [],
},

correctAnswer: {
  type: String,
},

// ---------------- CODING FIELDS ----------------
sampleInput: {
  type: String,
  default: "",
},

sampleOutput: {
  type: String,
  default: "",
},

hiddenTestCases: [
  {
    input: String,
    expectedOutput: String,
  },
],

marks: {
  type: Number,
  default: 10,
},

difficulty: {
  type: String,
  enum: ["EASY", "MEDIUM", "HARD"],
  default: "MEDIUM",
},

source: {
  type: String,
  enum: ["MANUAL", "AI"],
  default: "MANUAL",
},

createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},
},
{ timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);








// const mongoose = require("mongoose");

// const questionSchema = new mongoose.Schema(
//   {
//     exam: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Exam",
//       required: true,
//     },

//     questionType: {
//       type: String,
//       enum: ["MCQ", "CODING"],
//       required: true,
//     },

//     questionText: {
//       type: String,
//       required: true,
//     },

//     // For MCQ
//     options: {
//             type: [String],
//             default: [],
//         },

//     correctAnswer: {
//       type: String, // option text or code output
//     },

//     // For Coding questions
//     sampleInput: String,
//     sampleOutput: String,

//     hiddenTestCases: [
//       {
//         input: String,
//         output: String,
//       },
//     ],

//     marks: {
//       type: Number,
//       default: 10,
//     },

//     // Difficulty level
//     difficulty: {
//       type: String,
//       enum: ["EASY", "MEDIUM", "HARD"],
//       default: "MEDIUM",
//     },

//     // Question source
//     source: {
//       type: String,
//       enum: ["MANUAL", "AI"],
//       default: "MANUAL",
//     },

//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Question", questionSchema);
