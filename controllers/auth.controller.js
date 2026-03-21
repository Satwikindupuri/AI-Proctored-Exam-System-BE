const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");

const createUserHandler = async (req, res, forcedRole = null) => {
  try {
    const name = normalizeText(req.body.name);
    const email = normalizeText(req.body.email).toLowerCase();
    const password = req.body.password;
    const inputRole = normalizeText(req.body.role).toLowerCase();
    const role = forcedRole || inputRole;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "name, email, password, and role are required",
      });
    }

    if (!["student", "faculty"].includes(role)) {
      return res.status(400).json({
        message: "role must be either student or faculty",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists with this email" });
    }

    const payload = {
      name,
      email,
      password,
      role,
    };

    if (role === "student") {
      payload.rollNo = normalizeText(req.body.rollNo);
      payload.year = normalizeText(req.body.year);
      payload.branch = normalizeText(req.body.branch);
      payload.section = normalizeText(req.body.section);
      payload.phone = normalizeText(req.body.phone);
    }

    const user = await User.create(payload);

    return res.status(201).json({
      message: "User created successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNo: user.rollNo,
        year: user.year,
        branch: user.branch,
        section: user.section,
        phone: user.phone,
      },
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
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

exports.register = async (req, res) => {
  return createUserHandler(req, res);
};

exports.registerStudent = async (req, res) => {
  return createUserHandler(req, res, "student");
};

exports.registerFaculty = async (req, res) => {
  return createUserHandler(req, res, "faculty");
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
