const express = require("express");
const projectRouter = express.Router();
const { userAuth } = require("../middlewares/auth.js");
const Project = require("../models/project.js");

// ==================== GET /projects ====================
projectRouter.get("/projects", userAuth, async (req, res) => {
  try {
    const projects = await Project.find({ status: "open" })
      .populate("userId", "firstName lastName photoUrl")
      .sort({ createdAt: -1 })
      .limit(50);

    // Map userId to owner for frontend compatibility
    const data = projects.map((p) => ({
      ...p.toObject(),
      owner: p.userId,
    }));

    res.json({ data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== POST /projects ====================
projectRouter.post("/projects", userAuth, async (req, res) => {
  try {
    const { title, description, techStack, lookingFor } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: "Project title is required" });
    }

    const project = new Project({
      userId: req.user._id,
      title: title.trim(),
      description: (description || "").trim(),
      techStack: techStack || [],
      lookingFor: (lookingFor || "").trim(),
    });

    const saved = await project.save();

    // Populate for response
    const populated = await Project.findById(saved._id).populate(
      "userId",
      "firstName lastName photoUrl"
    );

    res.json({
      message: "Project created successfully",
      data: { ...populated.toObject(), owner: populated.userId },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==================== POST /projects/:id/apply ====================
projectRouter.post("/projects/:id/apply", userAuth, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if already applied
    const hasAlreadyApplied = project.applicants.some(
      (appId) => (appId?._id || appId).toString() === userId.toString(),
    );
    if (hasAlreadyApplied) {
      return res.status(400).json({ error: "Already applied" });
    }

    // Cannot apply to own project
    if (project.userId.toString() === userId.toString()) {
      return res.status(400).json({ error: "Cannot apply to your own project" });
    }

    project.applicants.push(userId);
    await project.save();

    res.json({
      message: "Applied successfully",
      data: project,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = projectRouter;
