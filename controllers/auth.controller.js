const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = await User.findOne({ email });

    console.log("LOGIN EMAIL:", email);
    console.log("USER FOUND:", user);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("DB ROLE:", user.role);
    console.log("REQ ROLE:", role);

    if (user.role !== role) {
      return res.status(403).json({ message: "Role mismatch" });
    }

    const isMatch = await user.matchPassword(password);
    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.createTestUsers = async (req, res) => {
  try {
    const facultyExists = await User.findOne({ email: "faculty@test.com" });
    const studentExists = await User.findOne({ email: "student@test.com" });

    if (facultyExists || studentExists) {
      return res.status(400).json({ message: "Test users already exist" });
    }

    const faculty = await User.create({
      name: "Test Faculty",
      email: "faculty@test.com",
      password: "password123",
      role: "faculty",
    });

    const student = await User.create({
      name: "Test Student",
      email: "student@test.com",
      password: "password123",
      role: "student",
      rollNo: "22CSE001",
      year: "4",
      branch: "CSE",
      section: "A",
    });

    res.json({
      message: "Test users created successfully",
      faculty,
      student,
    });
  } catch (error) {
  console.error(error);
  res.status(500).json({
    message: "Error creating test users",
    error: error.message,
  });
}

};
