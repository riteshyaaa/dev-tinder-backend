const express = require("express");
const requestRouter = express.Router();
const { userAuth } = require("../middlewares/auth.js");
const ConnectionRequest = require("../models/connectionRequest.js");
const User = require("../models/user");

// ==================== POST /request/send/:status/:toUserId ====================
requestRouter.post(
  "/request/send/:status/:toUserId",
  userAuth,
  async (req, res) => {
    try {
      const fromUserId = req.user._id;
      const toUserId = req.params.toUserId;
      const status = req.params.status;

      const allowedStatus = ["interested", "ignored", "superlike"];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ error: `${status} is not a valid status` });
      }

      const toUser = await User.findById(toUserId);
      if (!toUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check for existing request
      const existingRequest = await ConnectionRequest.findOne({
        $or: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      });

      if (existingRequest) {
        // Check if this creates a mutual match
        if (
          existingRequest.fromUserId.toString() === toUserId &&
          existingRequest.status === "interested" &&
          (status === "interested" || status === "superlike")
        ) {
          // It's a match! Both users are interested
          existingRequest.status = "accepted";
          await existingRequest.save();
          return res.json({
            message: "It's a match!",
            data: existingRequest,
            isMatch: true,
          });
        }
        return res.status(400).json({ error: "Connection request already exists" });
      }

      // Save the connection request (store superlike as "interested" with a flag)
      const connectionRequest = new ConnectionRequest({
        fromUserId,
        toUserId,
        status: status === "superlike" ? "interested" : status,
      });

      const data = await connectionRequest.save();

      res.json({
        message: "Request sent successfully",
        data,
        isMatch: false,
        isSuperLike: status === "superlike",
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ==================== POST /request/review/:status/:requestId ====================
requestRouter.post(
  "/request/review/:status/:requestId",
  userAuth,
  async (req, res) => {
    try {
      const loggedInUser = req.user;
      const { status, requestId } = req.params;

      const allowedStatus = ["accepted", "rejected"];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const connectionRequest = await ConnectionRequest.findOne({
        _id: requestId,
        toUserId: loggedInUser._id,
        status: "interested",
      });

      if (!connectionRequest) {
        return res.status(404).json({ error: "Request not found" });
      }

      connectionRequest.status = status;
      const data = await connectionRequest.save();

      res.json({
        message: `Request ${status} successfully`,
        data,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ==================== POST /request/undo/:userId ====================
requestRouter.post("/request/undo/:userId", userAuth, async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const toUserId = req.params.userId;

    // Find and remove the most recent "ignored" request from this user to target
    const deletedRequest = await ConnectionRequest.findOneAndDelete({
      fromUserId,
      toUserId,
      status: "ignored",
    }).sort({ createdAt: -1 });

    if (!deletedRequest) {
      return res.status(404).json({ error: "No ignored request to undo" });
    }

    res.json({
      message: "Swipe undone successfully",
      data: deletedRequest,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = requestRouter;
