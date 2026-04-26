const studentRoutes = require("./routes/student.routes");
const facultyRoutes = require("./routes/faculty.routes");

require("dotenv").config();

const express = require("express");
const cors = require("cors");


const connectDB = require("./config/db"); // ← this line MUST exist

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI Proctored Exam System Backend Running");
});

const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/faculty", facultyRoutes);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
