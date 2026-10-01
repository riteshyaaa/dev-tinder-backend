require("dotenv").config();
const { validateEnvironment } = require("./config/environment.js");
validateEnvironment();

const express = require("express");
const connectDB = require("./config/database.js");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { createServer } = require("http");

const app = express();

// ===== CORS Configuration =====
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "Content-Type", "Accept", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // Increased for image uploads
app.use(cookieParser());

// ===== Route Imports =====
const authRouter = require("./routes/auth.js");
const profileRouter = require("./routes/profile.js");
const requestRouter = require("./routes/request.js");
const userRouter = require("./routes/user.js");
const chatRouter = require("./routes/chat.js");
const projectRouter = require("./routes/project.js");
const challengeRouter = require("./routes/challenge.js");
const activityRouter = require("./routes/activity.js");
const initializeSocket = require("./utils/socket.js");

// ===== Register Routes =====
app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", chatRouter);
app.use("/", projectRouter);
app.use("/", challengeRouter);
app.use("/", activityRouter);

// ===== Health Check =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ===== 404 Handler =====
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ===== Error Handler =====
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ===== Server Setup =====
const server = createServer(app);
initializeSocket(server);

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
    server.listen(PORT, () => {
      console.log("Server listening on port " + PORT);
    });
  })
  .catch((err) => console.error("MongoDB connection failed:", err));
