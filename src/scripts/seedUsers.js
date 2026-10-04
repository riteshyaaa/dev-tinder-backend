require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const connectDB = require("../config/database");
const { profileImages, usersData } = require("../data/demoUsers");

const seedUsers = async () => {
  try {
    if (usersData.length !== 20) {
      throw new Error("Expected exactly 20 demo users");
    }
    if (profileImages.length !== usersData.length || profileImages.some((url) => !url)) {
      throw new Error("Every demo user must have a profile image URL");
    }

    await connectDB();

    for (let i = 0; i < usersData.length; i++) {
      const userData = usersData[i];
      const photoUrl = profileImages[i];
      const password = await bcrypt.hash(userData.password, 10);

      await User.updateOne(
        { email: userData.email },
        {
          $set: {
            ...userData,
            password,
            photoUrl,
            socialLinks: { linkedin: "", twitter: "", website: "" },
            github: {
              ...userData.github,
              avatarUrl: photoUrl,
              bio: userData.about,
              profileUrl: "https://github.com/" + userData.github.username,
              createdAt: new Date(
                Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              topRepos: [],
            },
            challengeStreak: Math.floor(Math.random() * 30),
            profileViews: Math.floor(Math.random() * 500),
            isBoosted: Math.random() > 0.8,
            lastActive: new Date(
              Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
            ),
          },
        },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          users: usersData.length,
          usersWithProfileImage: profileImages.length,
          imagesAlsoSetAsGithubAvatar: true,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = String(error.message).replace(
      /mongodb(?:\+srv)?:\/\/[^@\s]+@/gi,
      "mongodb+srv://[redacted]@",
    );
    console.error("Error seeding users:", message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

seedUsers();