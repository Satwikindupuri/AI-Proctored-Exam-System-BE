const express = require("express");
const router = express.Router();
const {
	login,
	register,
	registerStudent,
	registerFaculty,
	createTestUsers,
} = require("../controllers/auth.controller");

router.post("/login", login);
router.post("/register", register);
router.post("/register/student", registerStudent);
router.post("/register/faculty", registerFaculty);
// router.post("/seed", createTestUsers); // TEMP route

module.exports = router;
