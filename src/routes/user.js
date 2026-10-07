const express = require("express");
const { userAuth } = require("../middlewares/auth");
const ConnectionRequest = require("../models/connectionRequest.js");
const User = require("../models/user.js");

const userRouter = express.Router();

const USER_SAFE_DATA = [
  "firstName", "lastName", "age", "about", "skills", "photoUrl",
  "gender", "experienceLevel", "location", "currentlyBuilding",
  "availability", "lookingFor", "socialLinks", "github", "portfolio",
  "lastActive", "isBoosted",
];

// ==================== GET /user/requests/received ====================
userRouter.get("/user/requests/received", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const connectionRequests = await ConnectionRequest.find({
      toUserId: loggedInUser._id,
      status: "interested",
    })
      .populate("fromUserId", USER_SAFE_DATA)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      message: "Connection requests fetched successfully",
      data: connectionRequests,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== GET /user/connections ====================
userRouter.get("/user/connections", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { toUserId: loggedInUser._id, status: "accepted" },
        { fromUserId: loggedInUser._id, status: "accepted" },
      ],
    })
      .populate("fromUserId", USER_SAFE_DATA)
      .populate("toUserId", USER_SAFE_DATA)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const data = connectionRequests
      .filter((row) => row.fromUserId && row.toUserId)
      .map((row) => {
        if (row.fromUserId._id.toString() === loggedInUser._id.toString()) {
          return row.toUserId;
        } else {
          return row.fromUserId;
        }
      });

    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== GET /feed ====================
userRouter.get("/feed", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Query params from frontend filters
    const { skills, experienceLevel, location, smartMatch, sortBy } = req.query;

    // Get all existing connections/requests to exclude
    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { toUserId: loggedInUser._id },
        { fromUserId: loggedInUser._id },
      ],
    }).select("fromUserId toUserId");

    const hideUserIds = new Set();
    connectionRequests.forEach((row) => {
      hideUserIds.add(row.toUserId.toString());
      hideUserIds.add(row.fromUserId.toString());
    });

    // Build filter query
    const filterQuery = {
      _id: { $nin: [...Array.from(hideUserIds), loggedInUser._id] },
    };

    // Skill filter
    if (skills) {
      const skillArray = skills.split(",").map((s) => s.trim()).filter(Boolean);
      if (skillArray.length > 0) {
        filterQuery.skills = { $in: skillArray };
      }
    }

    // Experience level filter
    if (experienceLevel) {
      filterQuery.experienceLevel = experienceLevel;
    }

    // Location filter (case-insensitive partial match)
    if (location) {
      filterQuery.location = { $regex: location, $options: "i" };
    }

    // Smart Match: prefer users who have skills registered
    if (smartMatch === "true") {
      if (!filterQuery.skills) {
        filterQuery.skills = { $exists: true, $ne: [] };
      }
    }

    // Build sort options
    let sortOptions = { lastActive: -1 }; // Default: recently active first

    if (sortBy === "smart") {
      // Smart sort: boosted users first → recently active → complete profiles
      sortOptions = { isBoosted: -1, lastActive: -1 };
    }

    // Expire boosts that have passed
    await User.updateMany(
      { isBoosted: true, boostExpiresAt: { $lt: new Date() } },
      { $set: { isBoosted: false, boostExpiresAt: null } }
    );

    const users = await User.find(filterQuery)
      .select(USER_SAFE_DATA)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Increment profile views for displayed users
    const userIds = users.map((u) => u._id);
    if (userIds.length > 0) {
      await User.updateMany(
        { _id: { $in: userIds } },
        { $inc: { profileViews: 1 } }
      );
    }

    res.json(users);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = userRouter;
