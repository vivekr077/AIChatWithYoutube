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

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/generate", async (req, res) => {
    console.log(req.body);
    
  const { query, thread_id } = req.body;

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
  console.log(result.messages.at(-1).content);
  res.send(result.messages.at(-1).content);
});

app.listen(PORT, () => {
  console.log(`Server started running on PORT: ${PORT}`);
});
