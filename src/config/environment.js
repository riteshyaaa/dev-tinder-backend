const validateEnvironment = () => {
  const missing = ["MONGODB_URI", "JWT_SECRET"].filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
};

module.exports = { validateEnvironment };
