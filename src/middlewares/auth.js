const User = require("../models/user");
const josePromise = import("jose");

const userAuth = async (req, res, next) => {
  try {
    const { token } = req.cookies;

    if (!token) {
      return res.status(401).json({ error: "Please login" });
    }

    const { jwtVerify } = await josePromise;
    const { payload: decodedObj } = await jwtVerify(
      token,
      Buffer.from(process.env.JWT_SECRET),
      { algorithms: ["HS256"] },
    );

    if (!decodedObj) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { _id } = decodedObj;
    if (!_id) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const user = await User.findById(_id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.code?.startsWith("ERR_JWT_") || err.code?.startsWith("ERR_JWS_")) {
      return res
        .status(401)
        .json({ error: "Session expired. Please login again." });
    }
    return res.status(500).json({ error: "Authentication failed" });
  }
};

module.exports = {
  userAuth,
};
