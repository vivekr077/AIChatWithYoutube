import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { agent } from "./agent.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.urlencoded());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/generate", async (req, res) => {
    console.log(req.body);
    
  const { video_id, query, thread_id } = req.body;
  const result = await agent.invoke(
    {
      messages: [
        {
          role: "user",
          content: query
        },
      ],
    },
    { configurable: { thread_id, video_id } }
  );
  console.log(result.messages.at(-1).content);
  res.send(result.messages.at(-1).content);
});

app.listen(PORT, () => {
  console.log(`Server started running on PORT: ${PORT}`);
});
