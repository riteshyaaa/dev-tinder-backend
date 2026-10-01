const dns = require("node:dns");

const configuredDnsServers = process.env.MONGODB_DNS_SERVERS
  ?.split(",")
  .map((server) => server.trim())
  .filter(Boolean);

dns.setServers(configuredDnsServers?.length ? configuredDnsServers : ["1.1.1.1"]);

const mongoose = require("mongoose");

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
};

module.exports = connectDB;
