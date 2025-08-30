import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { agent } from "./agent.js";
import { addYTVideoToVectorStore } from "./embeddings.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded());
app.use(cors());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/generate", async (req, res) => {
  try {
    console.log("Received request:", req.body);
    
    const { query, thread_id } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const result = await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: query
          },
        ],
      },
      { configurable: { thread_id } }
    );
    
    console.log("Generated response:", result.messages.at(-1).content);
    res.send(result.messages.at(-1)?.content);
  } catch (error) {
    console.error("Error in /generate endpoint:", error);
    
    // Handle specific database connection errors
    if (error.message && error.message.includes('Connection terminated')) {
      return res.status(503).json({ 
        error: "Database connection issue. Please try again in a moment.",
        retryAfter: 30
      });
    }
    
    // Handle other errors
    res.status(500).json({ 
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const server = app.listen(PORT, () => {
  console.log(`Server started running on PORT: ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});


process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.close(() => {
    console.log('Server closed due to uncaught exception');
    process.exit(1);
  });
});


process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  server.close(() => {
    console.log('Server closed due to unhandled rejection');
    process.exit(1);
  });
});
