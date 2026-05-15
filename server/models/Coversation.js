const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  sessionId: String,
  messages: [
    {
      role: String,
      content: String,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model("Conversation", ConversationSchema);