const { Server } = require("socket.io");
const crypto = require("crypto");
const mongoose = require("mongoose");
const josePromise = import("jose");
const Message = require("../models/message");
const User = require("../models/user");
const ConnectionRequest = require("../models/connectionRequest");

const getCookieValue = (header, name) => {
  for (const part of String(header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;

    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
};

const normalizeUserId = (value) => {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) return null;
  return new mongoose.Types.ObjectId(value).toString();
};

const getSecretRoomId = (userId, targetId) =>
  crypto
    .createHash("sha256")
    .update([userId, targetId].sort().join("$"))
    .digest("hex");

const areConnected = async (userId, targetId) => {
  if (!targetId || targetId === userId) return false;

  return Boolean(
    await ConnectionRequest.exists({
      status: "accepted",
      $or: [
        { fromUserId: userId, toUserId: targetId },
        { fromUserId: targetId, toUserId: userId },
      ],
    }),
  );
};

const getPayload = (payload) =>
  payload && typeof payload === "object" ? payload : {};

const onlineUsers = new Map();

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = getCookieValue(socket.handshake.headers.cookie, "token");
      if (!token || !process.env.JWT_SECRET) {
        return next(new Error("Authentication required"));
      }

      const { jwtVerify } = await josePromise;
      const { payload } = await jwtVerify(
        token,
        Buffer.from(process.env.JWT_SECRET),
        { algorithms: ["HS256"] },
      );

      const userId = normalizeUserId(payload?._id);
      if (!userId) return next(new Error("Authentication required"));

      const user = await User.findById(userId)
        .select("_id firstName lastName photoUrl")
        .lean();
      if (!user) return next(new Error("Authentication required"));

      socket.data.userId = user._id.toString();
      socket.data.user = {
        firstName: user.firstName,
        lastName: user.lastName || "",
        photoUrl: user.photoUrl || "",
      };
      return next();
    } catch {
      return next(new Error("Authentication required"));
    }
  });

  const registerOnline = (socket) => {
    const userId = socket.data.userId;
    let socketIds = onlineUsers.get(userId);

    if (!socketIds) {
      socketIds = new Set();
      onlineUsers.set(userId, socketIds);
    }

    const wasOffline = socketIds.size === 0;
    socketIds.add(socket.id);
    if (wasOffline) io.emit("userOnline", { userId });
  };

  const unregisterOnline = (socket) => {
    const userId = socket.data.userId;
    const socketIds = onlineUsers.get(userId);
    if (!socketIds) return;

    socketIds.delete(socket.id);
    if (socketIds.size === 0) {
      onlineUsers.delete(userId);
      io.emit("userOffline", { userId });
    }
  };

  const emitToUser = (userId, event, payload) => {
    for (const socketId of onlineUsers.get(userId) || []) {
      io.to(socketId).emit(event, payload);
    }
  };

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    registerOnline(socket);

    // The identity is taken from the authenticated socket, never from event data.
    socket.on("registerUser", () => registerOnline(socket));

    socket.on("joinChat", async (rawPayload = {}) => {
      try {
        const targetId = normalizeUserId(getPayload(rawPayload).targetId);
        if (!(await areConnected(userId, targetId))) return;
        socket.join(getSecretRoomId(userId, targetId));
      } catch (error) {
        console.error("Unable to join chat:", error.message);
      }
    });

    socket.on("sendMessage", async (rawPayload = {}) => {
      try {
        const payload = getPayload(rawPayload);
        const targetId = normalizeUserId(payload.targetId);
        if (!(await areConnected(userId, targetId))) return;

        const text = typeof payload.text === "string" ? payload.text : "";
        const imageUrl =
          typeof payload.imageUrl === "string" ? payload.imageUrl : null;
        const fileUrl =
          typeof payload.fileUrl === "string" ? payload.fileUrl : null;
        const fileName =
          typeof payload.fileName === "string"
            ? payload.fileName.slice(0, 255)
            : null;

        if (text.length > 5000 || (!text.trim() && !imageUrl && !fileUrl && !fileName)) {
          return;
        }

        const message = await new Message({
          senderId: userId,
          receiverId: targetId,
          text,
          imageUrl,
          fileUrl,
          fileName,
        }).save();

        const roomId = getSecretRoomId(userId, targetId);
        io.to(roomId).emit("messageReceived", {
          messageId: message._id.toString(),
          firstName: socket.data.user.firstName,
          lastName: socket.data.user.lastName,
          text,
          senderId: userId,
          time: message.createdAt,
          imageUrl,
          fileUrl,
          fileName,
        });

        emitToUser(targetId, "newMessageNotification", {
          fromUser: {
            _id: userId,
            firstName: socket.data.user.firstName,
            lastName: socket.data.user.lastName,
            photoUrl: socket.data.user.photoUrl,
          },
          text: text.slice(0, 60),
        });
      } catch (error) {
        console.error("Error saving message:", error.message);
      }
    });

    socket.on("typing", async (rawPayload = {}) => {
      try {
        const targetId = normalizeUserId(getPayload(rawPayload).targetId);
        if (!(await areConnected(userId, targetId))) return;

        socket.to(getSecretRoomId(userId, targetId)).emit("userTyping", {
          firstName: socket.data.user.firstName,
          userId,
        });
      } catch (error) {
        console.error("Unable to send typing event:", error.message);
      }
    });

    socket.on("stopTyping", async (rawPayload = {}) => {
      try {
        const targetId = normalizeUserId(getPayload(rawPayload).targetId);
        if (!(await areConnected(userId, targetId))) return;

        socket.to(getSecretRoomId(userId, targetId)).emit("userStoppedTyping", {
          userId,
        });
      } catch (error) {
        console.error("Unable to stop typing event:", error.message);
      }
    });

    socket.on("messageRead", async (rawPayload = {}) => {
      try {
        const targetId = normalizeUserId(getPayload(rawPayload).targetId);
        if (!(await areConnected(userId, targetId))) return;

        await Message.updateMany(
          { senderId: targetId, receiverId: userId, read: false },
          { $set: { read: true } },
        );
        socket.to(getSecretRoomId(userId, targetId)).emit("messagesRead", {
          readBy: userId,
        });
      } catch (error) {
        console.error("Unable to mark messages read:", error.message);
      }
    });

    socket.on("addReaction", async (rawPayload = {}) => {
      try {
        const payload = getPayload(rawPayload);
        const targetId = normalizeUserId(payload.targetId);
        const messageId = normalizeUserId(payload.messageId);
        const emoji = payload.emoji;

        if (
          !targetId ||
          !messageId ||
          typeof emoji !== "string" ||
          emoji.length > 16 ||
          ["__proto__", "constructor", "prototype"].includes(emoji) ||
          !(await areConnected(userId, targetId))
        ) {
          return;
        }

        const message = await Message.findById(messageId);
        if (!message) return;

        const isPairMessage =
          (message.senderId.toString() === userId &&
            message.receiverId.toString() === targetId) ||
          (message.senderId.toString() === targetId &&
            message.receiverId.toString() === userId);
        if (!isPairMessage) return;

        const reactions = message.reactions || {};
        const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
        if (users.includes(userId)) {
          reactions[emoji] = users.filter((id) => id !== userId);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...users, userId];
        }

        message.reactions = reactions;
        message.markModified("reactions");
        await message.save();

        socket.to(getSecretRoomId(userId, targetId)).emit("reactionReceived", {
          messageId: message._id.toString(),
          emoji,
          fromUserId: userId,
          reactions: message.reactions,
        });
      } catch (error) {
        console.error("Error adding reaction:", error.message);
      }
    });

    socket.on("leaveChat", (rawPayload = {}) => {
      const targetId = normalizeUserId(getPayload(rawPayload).targetId);
      if (targetId) socket.leave(getSecretRoomId(userId, targetId));
    });

    socket.on("checkOnline", async (rawPayload = {}) => {
      try {
        const targetId = normalizeUserId(getPayload(rawPayload).targetId);
        const online =
          (await areConnected(userId, targetId)) && onlineUsers.has(targetId);
        socket.emit("onlineStatus", { userId: targetId, online });
      } catch (error) {
        console.error("Unable to check online status:", error.message);
      }
    });

    socket.on("getOnlineUsers", async (rawPayload = {}) => {
      try {
        const requestedIds = Array.isArray(getPayload(rawPayload).userIds)
          ? getPayload(rawPayload)
              .userIds.slice(0, 100)
              .map(normalizeUserId)
              .filter(Boolean)
          : [];
        const statuses = await Promise.all(
          requestedIds.map(async (targetId) =>
            (await areConnected(userId, targetId)) && onlineUsers.has(targetId)
              ? targetId
              : null,
          ),
        );
        socket.emit("onlineUsers", { users: statuses.filter(Boolean) });
      } catch (error) {
        console.error("Unable to list online users:", error.message);
      }
    });

    socket.on("startCall", async (rawPayload = {}) => {
      try {
        const payload = getPayload(rawPayload);
        const targetId = normalizeUserId(payload.targetId);
        const peerId =
          typeof payload.peerId === "string" ? payload.peerId.slice(0, 200) : "";
        if (!peerId || !(await areConnected(userId, targetId))) return;

        emitToUser(targetId, "incomingCall", { fromUserId: userId, peerId });
      } catch (error) {
        console.error("Unable to start call:", error.message);
      }
    });

    socket.on("endCall", async (rawPayload = {}) => {
      try {
        const targetId = normalizeUserId(getPayload(rawPayload).targetId);
        if (!(await areConnected(userId, targetId))) return;

        emitToUser(targetId, "callEnded", { fromUserId: userId });
      } catch (error) {
        console.error("Unable to end call:", error.message);
      }
    });

    socket.on("disconnect", () => unregisterOnline(socket));
  });

  return io;
};

module.exports = initializeSocket;
