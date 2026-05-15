require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const Conversation = require("./models/Coversation");

const PORT = process.env.PORT || 5000;
const LLM_URL = process.env.LLM_URL || "http://127.0.0.1:8000";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/curalink";

let mongoReady = false;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    mongoReady = true;
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.warn(`MongoDB unavailable: ${error.message}`);
    console.warn("Continuing without chat persistence.");
  });

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ message: "CuraLink API server running", llmUrl: LLM_URL });
});

app.get("/api/health", async (req, res) => {
  try {
    const llm = await axios.get(`${LLM_URL}/`, { timeout: 5000 });
    res.json({
      api: "ok",
      database: mongoReady ? "connected" : "offline",
      llm: llm.data,
    });
  } catch (error) {
    res.status(503).json({
      api: "ok",
      database: mongoReady ? "connected" : "offline",
      llm: "offline",
      error: error.message,
    });
  }
});

app.post("/api/reason", async (req, res) => {
  try {
    const {
      disease = "",
      query,
      publications = [],
      trials = [],
      chat_history = [],
      sessionId = "default",
    } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    let persistedHistory = [];
    if (mongoReady) {
      const conversation = await Conversation.findOne({ sessionId }).lean();
      persistedHistory = conversation?.messages || [];
    }

    const history = persistedHistory.length ? persistedHistory : chat_history;

    const llmResponse = await axios.post(
      `${LLM_URL}/reason`,
      {
        disease: disease || query,
        query,
        publications,
        trials,
        chat_history: history,
      },
      { timeout: 60000 }
    );

    const data = llmResponse.data;

    if (mongoReady) {
      await Conversation.findOneAndUpdate(
        { sessionId },
        {
          $push: {
            messages: {
              $each: [
                { role: "user", content: query },
                {
                  role: "assistant",
                  content: JSON.stringify(data),
                },
              ],
            },
          },
        },
        { upsert: true, new: true }
      );
    }

    res.json(data);
  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message;
    console.error("Reasoning failed:", detail);
    res.status(status).json({ error: "LLM failed", detail });
  }
});

app.listen(PORT, () => {
  console.log(`CuraLink API server running on port ${PORT}`);
});
