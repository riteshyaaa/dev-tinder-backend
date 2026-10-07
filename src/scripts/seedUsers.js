require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const ConnectionRequest = require("../models/connectionRequest");
const Message = require("../models/message");
const Project = require("../models/project");
const Activity = require("../models/activity");
const Challenge = require("../models/challenge");
const connectDB = require("../config/database");
const { profileImages, usersData } = require("../data/demoUsers");

const seedAll = async () => {
  try {
    if (usersData.length !== 20) {
      throw new Error("Expected exactly 20 demo users");
    }
    if (profileImages.length !== usersData.length || profileImages.some((url) => !url)) {
      throw new Error("Every demo user must have a profile image URL");
    }

    console.log("Connecting to MongoDB Database...");
    await connectDB();
    console.log("Connected successfully.\n");

    console.log("Seeding 20 Indian Developer Profiles...");
    const createdUsers = [];

    for (let i = 0; i < usersData.length; i++) {
      const userData = usersData[i];
      const photoUrl = profileImages[i];
      const password = await bcrypt.hash(userData.password, 10);

      const userDoc = await User.findOneAndUpdate(
        { email: userData.email.toLowerCase() },
        {
          $set: {
            ...userData,
            email: userData.email.toLowerCase(),
            password,
            photoUrl,
            socialLinks: userData.socialLinks || { linkedin: "", twitter: "", website: "" },
            github: {
              ...userData.github,
              avatarUrl: photoUrl,
              bio: userData.about,
              profileUrl: "https://github.com/" + userData.github.username,
              createdAt: new Date(Date.now() - (365 - i * 15) * 24 * 60 * 60 * 1000).toISOString(),
            },
            challengeStreak: Math.floor(10 + Math.random() * 25),
            profileViews: Math.floor(150 + Math.random() * 400),
            isBoosted: i < 3, // Top 3 users are boosted
            boostExpiresAt: i < 3 ? new Date(Date.now() + 48 * 60 * 60 * 1000) : null,
            lastActive: new Date(Date.now() - (i * 30 * 60 * 1000)), // Active within last few hours
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );

      createdUsers.push(userDoc);
      console.log(`  ✓ Seeded [${i + 1}/20]: ${userDoc.firstName} ${userDoc.lastName} (${userDoc.email})`);
    }

    // Map for easy user lookup by first name
    const userMap = {};
    createdUsers.forEach((u) => {
      userMap[u.firstName] = u;
    });

    console.log("\nSeeding Connections & Match Requests...");
    // Clear old connection requests for these demo users to avoid duplicates
    const userIds = createdUsers.map((u) => u._id);
    await ConnectionRequest.deleteMany({
      $or: [{ fromUserId: { $in: userIds } }, { toUserId: { $in: userIds } }],
    });

    // 1. Accepted Connections (Mutual matches)
    const connectionsToCreate = [
      // Aarav connections
      { from: "Aarav", to: "Priya", status: "accepted" },
      { from: "Aarav", to: "Rohan", status: "accepted" },
      { from: "Aarav", to: "Ananya", status: "accepted" },
      { from: "Aarav", to: "Ritesh", status: "accepted" },
      // Ritesh connections
      { from: "Ritesh", to: "Priya", status: "accepted" },
      { from: "Ritesh", to: "Neha", status: "accepted" },
      { from: "Ritesh", to: "Arjun", status: "accepted" },
      // Other peer connections
      { from: "Priya", to: "Kavya", status: "accepted" },
      { from: "Rohan", to: "Devansh", status: "accepted" },
      { from: "Vikram", to: "Rahul", status: "accepted" },
      { from: "Aditya", to: "Arjun", status: "accepted" },
      { from: "Pooja", to: "Ananya", status: "accepted" },
      { from: "Siddharth", to: "Shreya", status: "accepted" },
      { from: "Tanvi", to: "Vikram", status: "accepted" },
      { from: "Harsh", to: "Vikram", status: "accepted" },
      { from: "Riya", to: "Ananya", status: "accepted" },
      { from: "Ishita", to: "Kavya", status: "accepted" },
      { from: "Meera", to: "Siddharth", status: "accepted" },

      // 2. Pending Incoming Requests (Users requesting to connect with Aarav & Ritesh)
      { from: "Vikram", to: "Aarav", status: "interested" },
      { from: "Neha", to: "Aarav", status: "interested" },
      { from: "Aditya", to: "Aarav", status: "interested" },
      { from: "Kavya", to: "Ritesh", status: "interested" },
      { from: "Siddharth", to: "Ritesh", status: "interested" },
      { from: "Shreya", to: "Priya", status: "interested" },
      { from: "Devansh", to: "Priya", status: "interested" },
      { from: "Harsh", to: "Aarav", status: "interested" },
    ];

    for (const conn of connectionsToCreate) {
      const fromUser = userMap[conn.from];
      const toUser = userMap[conn.to];
      if (fromUser && toUser) {
        await ConnectionRequest.create({
          fromUserId: fromUser._id,
          toUserId: toUser._id,
          status: conn.status,
        });
      }
    }
    console.log(`  ✓ Seeded ${connectionsToCreate.length} connection records (Accepted + Pending Requests)`);

    console.log("\nSeeding Chat Conversations...");
    // Clear old demo messages
    await Message.deleteMany({
      $or: [{ senderId: { $in: userIds } }, { receiverId: { $in: userIds } }],
    });

    const sampleChats = [
      // Aarav & Priya
      {
        user1: "Aarav",
        user2: "Priya",
        messages: [
          { sender: "Priya", text: "Hey Aarav! Saw your CodeSync Live project on GitHub, really clean CRDT implementation! 🚀", hoursAgo: 24 },
          { sender: "Aarav", text: "Thanks Priya! Loved your Aura UI design system as well. The Tailwind token setup is super elegant.", hoursAgo: 23 },
          { sender: "Priya", text: "Are you free for a quick pair-programming session this weekend? Would love to integrate real-time collaboration widgets.", hoursAgo: 18 },
          { sender: "Aarav", text: "Absolutely! Let's jump on a DevTinder video call on Saturday around 4 PM.", hoursAgo: 12 },
          { sender: "Priya", text: "Perfect! I'll prepare the Figma specs and test components beforehand. See you then! 👍", hoursAgo: 2, reactions: { "👍": ["Aarav"] } },
        ],
      },
      // Aarav & Ritesh
      {
        user1: "Aarav",
        user2: "Ritesh",
        messages: [
          { sender: "Ritesh", text: "Hey Aarav! Welcome to DevTinder. Hope the real-time chat and WebRTC video calling are running smoothly.", hoursAgo: 30 },
          { sender: "Aarav", text: "Hey Ritesh! The platform is incredible. Love the clean glassmorphism UI and responsive feel.", hoursAgo: 20 },
          { sender: "Ritesh", text: "Thanks man! We just deployed the new activity feed and interactive project board. Feel free to post your open-source projects!", hoursAgo: 10 },
          { sender: "Aarav", text: "Will do right away! Let's connect on a call soon.", hoursAgo: 1, reactions: { "🔥": ["Ritesh"] } },
        ],
      },
      // Ritesh & Neha
      {
        user1: "Ritesh",
        user2: "Neha",
        messages: [
          { sender: "Neha", text: "Hey Ritesh, saw your work on DevTinder's real-time messaging. Are you planning a React Native mobile companion app?", hoursAgo: 36 },
          { sender: "Ritesh", text: "Hey Neha! Yes, definitely on our roadmap. We want offline-first chat syncing with SQLite/WatermelonDB.", hoursAgo: 28 },
          { sender: "Neha", text: "I can help architect that! I've built similar offline sync pipelines for 1M+ user apps.", hoursAgo: 14 },
          { sender: "Ritesh", text: "That would be awesome! Let me share our API swagger docs with you.", hoursAgo: 4 },
        ],
      },
      // Aarav & Rohan
      {
        user1: "Aarav",
        user2: "Rohan",
        messages: [
          { sender: "Rohan", text: "Hey Aarav, noticed your backend Docker image was ~850MB. We can easily bring it down to ~120MB with multi-stage Alpine builds.", hoursAgo: 40 },
          { sender: "Aarav", text: "Whoa, that would save so much CI/CD build time! Can you share a sample Dockerfile snippet?", hoursAgo: 32 },
          { sender: "Rohan", text: "```dockerfile\nFROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\n```\nHere you go! Tested on production Kubernetes clusters.", hoursAgo: 22 },
          { sender: "Aarav", text: "Worked like a charm! Cut deploy time in half. Thank you Rohan! 🙌", hoursAgo: 6, reactions: { "❤️": ["Rohan"] } },
        ],
      },
    ];

    let messageCount = 0;
    for (const chat of sampleChats) {
      const u1 = userMap[chat.user1];
      const u2 = userMap[chat.user2];
      if (!u1 || !u2) continue;

      for (const msg of chat.messages) {
        const sender = userMap[msg.sender];
        const receiver = msg.sender === chat.user1 ? u2 : u1;
        const msgDate = new Date(Date.now() - msg.hoursAgo * 60 * 60 * 1000);

        // Map reaction user names to actual ObjectIds
        const mappedReactions = {};
        if (msg.reactions) {
          for (const [emoji, names] of Object.entries(msg.reactions)) {
            mappedReactions[emoji] = names.map((name) => userMap[name]?._id?.toString()).filter(Boolean);
          }
        }

        await Message.create({
          senderId: sender._id,
          receiverId: receiver._id,
          text: msg.text,
          read: msg.hoursAgo > 5,
          reactions: mappedReactions,
          createdAt: msgDate,
          updatedAt: msgDate,
        });
        messageCount++;
      }
    }
    console.log(`  ✓ Seeded ${messageCount} chat messages across 4 active conversation threads`);

    console.log("\nSeeding Collaborative Projects...");
    await Project.deleteMany({});

    const projectsToCreate = [
      {
        creator: "Aarav",
        title: "CodeSync Live — Real-time Collaborative IDE",
        description: "Building a browser-based pair programming workspace with CRDT state synchronization, audio/video conferencing, and Monaco editor integration.",
        techStack: ["React", "TypeScript", "WebRTC", "Socket.IO", "Monaco Editor", "Docker"],
        lookingFor: "Looking for a Frontend Engineer experienced with Monaco Editor and an Infrastructure dev for WebRTC SFU scaling.",
        status: "open",
        applicantNames: ["Priya", "Ritesh", "Neha", "Arjun"],
      },
      {
        creator: "Priya",
        title: "Aura UI — Headless Design System & Token Studio",
        description: "An accessible, themeable React component library built with TailwindCSS, Radix UI primitives, and dynamic color science.",
        techStack: ["React", "TailwindCSS", "TypeScript", "Radix UI", "Storybook", "Jest"],
        lookingFor: "Seeking accessibility (a11y) advocates and test automation specialists.",
        status: "open",
        applicantNames: ["Kavya", "Ishita", "Meera"],
      },
      {
        creator: "Rohan",
        title: "InfraGuard — Automated Terraform Cloud Drift Detector",
        description: "Open-source CLI and dashboard that continuously monitors AWS/GCP resources against Terraform state files and generates automated remediation PRs.",
        techStack: ["Go", "AWS", "Terraform", "Kubernetes", "Prometheus", "Docker"],
        lookingFor: "Backend Go engineers and SREs passionate about GitOps and cloud security.",
        status: "in-progress",
        applicantNames: ["Devansh", "Vikram", "Tanvi"],
      },
      {
        creator: "Ananya",
        title: "DocuAI — Context-Aware AI Documentation Engine",
        description: "Automated codebase comprehension platform that parses ASTs, analyzes commit history, and generates interactive living documentation using LLMs.",
        techStack: ["Python", "FastAPI", "PyTorch", "LangChain", "React", "PostgreSQL"],
        lookingFor: "Full-stack Python/React developers and prompt evaluation researchers.",
        status: "open",
        applicantNames: ["Aarav", "Riya", "Shreya"],
      },
      {
        creator: "Aditya",
        title: "ZKPass — Zero-Knowledge Identity Verification Protocol",
        description: "Privacy-preserving authentication protocol enabling developers to prove identity and credentials without revealing sensitive data.",
        techStack: ["Rust", "Solidity", "Web3.js", "Circom", "React", "TypeScript"],
        lookingFor: "Cryptographers, Rust developers, and frontend Web3 engineers.",
        status: "open",
        applicantNames: ["Arjun", "Vikram", "Harsh"],
      },
      {
        creator: "Ritesh",
        title: "DevTinder Mobile — iOS & Android Pair Programming Companion",
        description: "Cross-platform mobile client for DevTinder featuring instant swipe discovery, push notifications, voice notes, and quick code snippet reviews.",
        techStack: ["React Native", "Expo", "TypeScript", "Socket.IO", "TailwindCSS"],
        lookingFor: "React Native and Flutter mobile developers with iOS/Android release experience.",
        status: "open",
        applicantNames: ["Neha", "Siddharth", "Aarav"],
      },
    ];

    for (const proj of projectsToCreate) {
      const creator = userMap[proj.creator];
      if (!creator) continue;

      const applicantIds = proj.applicantNames
        .map((name) => userMap[name]?._id)
        .filter(Boolean);

      await Project.create({
        userId: creator._id,
        title: proj.title,
        description: proj.description,
        techStack: proj.techStack,
        lookingFor: proj.lookingFor,
        status: proj.status,
        applicants: applicantIds,
      });
    }
    console.log(`  ✓ Seeded ${projectsToCreate.length} active collaborative projects with applicants`);

    console.log("\nSeeding Developer Activity Feed...");
    await Activity.deleteMany({});

    const activitiesToCreate = [
      {
        author: "Aarav",
        content: "Just deployed our new real-time CRDT collaborative editor to staging! Latency between Bangalore and US servers is down to under 65ms 🚀 Anyone interested in testing it out?",
        likers: ["Priya", "Rohan", "Ritesh", "Ananya", "Arjun"],
      },
      {
        author: "Priya",
        content: "Pro tip for React 19 / Next 15: Always memoize dynamic style calculation functions when animating SVG paths in high-frequency events. Saved us 40% CPU overhead! ✨",
        likers: ["Kavya", "Aarav", "Ishita", "Siddharth"],
      },
      {
        author: "Rohan",
        content: "Migrated our staging cluster to Kubernetes 1.30 with automated Karpenter node autoscaling. Cloud infrastructure costs dropped by 32% this month! 📈",
        likers: ["Devansh", "Vikram", "Harsh", "Aarav"],
      },
      {
        author: "Ananya",
        content: "Experimenting with small quantized LLMs running entirely in-browser using WebGPU and WebAssembly. The future of offline edge AI is coming fast! 🧠💡",
        likers: ["Arjun", "Riya", "Aarav", "Pooja"],
      },
      {
        author: "Ritesh",
        content: "DevTinder now supports WebRTC peer-to-peer audio & video calling for connected developers! Pair programming and live code reviews just got 10x easier 🎧💻",
        likers: ["Aarav", "Priya", "Neha", "Rohan", "Vikram", "Kavya"],
      },
      {
        author: "Arjun",
        content: "Wrote an image blur algorithm in pure Rust compiled to WebAssembly. Running 8x faster than Canvas 2D JavaScript equivalent. Rust on the web is phenomenal! 🦀",
        likers: ["Aarav", "Aditya", "Ishita"],
      },
    ];

    for (const act of activitiesToCreate) {
      const author = userMap[act.author];
      if (!author) continue;

      const likeIds = act.likers
        .map((name) => userMap[name]?._id)
        .filter(Boolean);

      await Activity.create({
        userId: author._id,
        content: act.content,
        likes: likeIds,
      });
    }
    console.log(`  ✓ Seeded ${activitiesToCreate.length} activity feed updates with likes`);

    console.log("\nSeeding Coding Challenges...");
    await Challenge.deleteMany({});

    const challengesToCreate = [
      {
        title: "Two Sum: Sub-Millisecond Hash Map Optimization",
        description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. Optimize for O(N) time and minimal memory allocation.",
        difficulty: "easy",
        tags: ["Arrays", "Hash Table", "Algorithms", "Optimization"],
        timeLimit: "20 min",
        endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        participants: 48,
        submissions: [
          { userId: userMap["Aarav"]?._id, solution: "function twoSum(nums, target) { const map = new Map(); for (let i = 0; i < nums.length; i++) { const diff = target - nums[i]; if (map.has(diff)) return [map.get(diff), i]; map.set(nums[i], i); } return []; }" },
          { userId: userMap["Priya"]?._id, solution: "const twoSum = (nums, target) => { const seen = {}; for (let i = 0; i < nums.length; i++) { if (seen[target - nums[i]] !== undefined) return [seen[target - nums[i]], i]; seen[nums[i]] = i; } };" },
        ],
      },
      {
        title: "Design a High-Performance LRU Cache",
        description: "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement get and put in O(1) average time complexity using a Doubly Linked List and Hash Map.",
        difficulty: "medium",
        tags: ["Data Structures", "Linked List", "System Design", "Caching"],
        timeLimit: "45 min",
        endsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        participants: 34,
        submissions: [
          { userId: userMap["Vikram"]?._id, solution: "// LRU Cache with Doubly Linked List\nclass Node { constructor(k, v) { this.k = k; this.v = v; this.prev = null; this.next = null; } }" },
          { userId: userMap["Arjun"]?._id, solution: "// High performance Rust-inspired Map LRU\nclass LRUCache { constructor(capacity) { this.cap = capacity; this.map = new Map(); } }" },
        ],
      },
      {
        title: "Concurrency Lock-Free Ring Buffer Queue",
        description: "Implement a bounded lock-free single-producer single-consumer ring buffer queue. Ensure atomic read/write head pointer synchronization without mutex deadlock risks.",
        difficulty: "hard",
        tags: ["Concurrency", "Multithreading", "Low Latency", "Systems"],
        timeLimit: "60 min",
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        participants: 19,
        submissions: [
          { userId: userMap["Harsh"]?._id, solution: "// Atomic ring buffer with cache line padding\nclass RingBuffer { constructor(size) { this.buffer = new Array(size); this.head = 0; this.tail = 0; } }" },
        ],
      },
    ];

    for (const ch of challengesToCreate) {
      await Challenge.create(ch);
    }
    console.log(`  ✓ Seeded ${challengesToCreate.length} active weekly coding challenges with submissions`);

    console.log("\n========================================================");
    console.log("🎉 ALL FEATURES SUCCESSFULLY SEEDED FOR DEVTINDER!");
    console.log("========================================================");
    console.log(`✓ 20 Indian Developers with Unsplash avatars & GitHub stats`);
    console.log(`✓ Accepted mutual connections for immediate Chat & Video Testing`);
    console.log(`✓ Pending match requests to test Accept/Ignore actions`);
    console.log(`✓ Active chat messages with emoji reactions and code blocks`);
    console.log(`✓ Collaborative project board with tech stacks and applicants`);
    console.log(`✓ Community activity feed with posts and likes`);
    console.log(`✓ Algorithmic coding challenges with participant submissions`);
    console.log(`\n🔑 Login credentials for any user:`);
    console.log(`   Email:    aarav.sharma@devmail.com  (or ritesh.yadav@devmail.com, priya.patel@devmail.com, etc.)`);
    console.log(`   Password: password123`);
    console.log("========================================================\n");

  } catch (error) {
    console.error("Error during database seeding:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

seedAll();
