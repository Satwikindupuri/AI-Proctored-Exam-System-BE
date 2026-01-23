const express = require("express");
const router = express.Router();
const { login, createTestUsers } = require("../controllers/auth.controller");

router.post("/login", login);
// router.post("/seed", createTestUsers); // TEMP route

module.exports = router;
