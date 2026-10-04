const express = require("express");
const authRouter = express.Router();
const User = require("../models/user");
const { validateSignUpdata } = require("../utils/validation.js");
const bcrypt = require("bcrypt");
const validator = require("validator");

// POST /signUp
authRouter.post("/signUp", async (req, res) => {
  try {
    validateSignUpdata(req);
    const { firstName, lastName, email, password, gender, age } = req.body;

    const encryptedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      email,
      password: encryptedPassword,
      gender,
      age,
    });
    const savedUser = await user.save();
    const token = await user.getJWT();
    res.cookie("token", token, {
      expires: new Date(Date.now() + 7 * 24 * 3600000), // 7 days
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.json({ message: "User registered successfully", data: savedUser });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /login (lowercase â€" matches frontend)
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validator.isEmail(email)) throw new Error("Invalid email address");

    const user = await User.findOne({ email }).select("+password");
    if (!user) throw new Error("Invalid credentials");

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) throw new Error("Invalid credentials");

    // Update lastActive
    user.lastActive = new Date();
    await user.save();

    const token = await user.getJWT();
    res.cookie("token", token, {
      expires: new Date(Date.now() + 7 * 24 * 3600000),
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    });

    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /logout (lowercase â€" matches frontend)
authRouter.post("/logout", async (req, res) => {
  try {
    res
      .cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
      })
      .json({ message: "Successfully logged out" });
  } catch {
    res.status(400).json({ error: "Error during logging out" });
  }
});

module.exports = authRouter;
