const studentRoutes = require("./routes/student.routes");
const facultyRoutes = require("./routes/faculty.routes");

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db"); // ← this line MUST exist

const app = express();

// 🔴 THIS LINE IS MANDATORY
connectDB();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI Proctored Exam System Backend Running");
});

const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/faculty", facultyRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
