const mongoose = require("mongoose");
const validator = require("validator");
const josePromise = import("jose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      minLength: 2,
      maxLength: 30,
      trim: true,
      required: true,
    },
    lastName: {
      type: String,
      maxLength: 30,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      required: true,
      trim: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email address: " + value);
        }
      },
    },
    password: {
      type: String,
      required: true,
    },
    age: {
      type: Number,
      min: 18,
      max: 100,
    },
    gender: {
      type: String,
      lowercase: true,
      validate(value) {
        const allowed = [
          "male",
          "female",
          "non-binary",
          "prefer not to say",
          "",
        ];
        if (!allowed.includes(value)) {
          throw new Error("Invalid value for gender: " + value);
        }
      },
    },
    photoUrl: {
      type: String,
      default:
        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png",
      validate(value) {
        if (value && !validator.isURL(value)) {
          throw new Error("Invalid URL address: " + value);
        }
      },
    },
    about: {
      type: String,
      maxLength: 300,
      default: "",
    },

    // ===== NEW FIELDS FOR FRONTEND FEATURES =====

    skills: {
      type: [String],
      default: [],
      validate(value) {
        if (value.length > 15) {
          throw new Error("Maximum 15 skills allowed");
        }
      },
    },
    experienceLevel: {
      type: String,
      enum: ["", "junior", "mid", "senior", "lead"],
      default: "",
    },
    location: {
      type: String,
      maxLength: 100,
      default: "",
    },
    currentlyBuilding: {
      type: String,
      maxLength: 100,
      default: "",
    },
    availability: {
      type: String,
      enum: ["", "open", "busy", "weekends", "evenings", "not-available"],
      default: "",
    },
    lookingFor: {
      type: [String],
      default: [],
      validate(value) {
        const allowed = [
          "pair-programming",
          "co-founder",
          "mentor",
          "mentee",
          "hackathon-buddy",
          "open-source",
          "networking",
          "job-referral",
        ];
        if (value.some((v) => !allowed.includes(v))) {
          throw new Error("Invalid lookingFor value");
        }
        if (value.length > 3) {
          throw new Error("Maximum 3 lookingFor selections");
        }
      },
    },
    socialLinks: {
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      website: { type: String, default: "" },
    },
    github: {
      username: { type: String, default: "" },
      avatarUrl: { type: String, default: "" },
      bio: { type: String, default: "" },
      profileUrl: { type: String, default: "" },
      publicRepos: { type: Number, default: 0 },
      totalStars: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      createdAt: { type: String, default: "" },
      languages: { type: mongoose.Schema.Types.Mixed, default: {} },
      topRepos: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    portfolio: {
      type: [
        {
          id: String,
          title: String,
          description: String,
          url: String,
          techStack: [String],
        },
      ],
      default: [],
      validate(value) {
        if (value.length > 5) {
          throw new Error("Maximum 5 portfolio projects");
        }
      },
    },

    // ===== GAMIFICATION & ANALYTICS =====

    challengeStreak: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    isBoosted: { type: Boolean, default: false },
    boostExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ===== METHODS =====

UserSchema.methods.getJWT = async function () {
  const user = this;
  const { SignJWT } = await josePromise;
  const token = await new SignJWT({ _id: user._id.toString() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(Buffer.from(process.env.JWT_SECRET));
  return token;
};

UserSchema.methods.validatePassword = async function (passwordInputByUser) {
  const user = this;
  const passwordHash = user.password;
  const isPasswordValid = await bcrypt.compare(
    passwordInputByUser,
    passwordHash,
  );
  return isPasswordValid;
};

// ===== INDEXES =====

UserSchema.index({ skills: 1 });
UserSchema.index({ experienceLevel: 1 });
UserSchema.index({ location: 1 });
UserSchema.index({ lastActive: -1 });
UserSchema.index({ isBoosted: 1, boostExpiresAt: 1 });

module.exports = mongoose.model("User", UserSchema);
