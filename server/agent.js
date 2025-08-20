import express from "express";
import {
  ChatGoogleGenerativeAI,
} from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { vectorStore, addYTVideoToVectorStore } from "./embeddings.js";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import dotenv from "dotenv";
import data from "./data.js";
import z from "zod";
// import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";

dotenv.config();

const video_id = '9w4jvRLR7M8'
const app = express();
const port = 3000;

const video1 = data[0];
await addYTVideoToVectorStore(video1);


const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
});


// retrieval tool
const retrieveTool = tool(
  async ({ query }, {configurable: {video_id}}) => {
    console.log("retrieved docs for query-----------------------");
    console.log(query);
    console.log(video_id);
    
    // retrieve the most relevant chunks
      const retrievedDocs = await vectorStore.similaritySearch(query, 3, (doc)=>doc.metadata.video_id==video_id);
      console.log(retrievedDocs);
      
      const serializedDocs = retrievedDocs
      .map((doc) => doc.pageContent)
      .join("\n");

    return serializedDocs;
  },
  {
    name: "retrieve",
    description: "Retrieve the most relevant chunks of text from the transcript of a youtube video.",
    schema: z.object({
      query: z.string(),
    }),
  }
);

const memorySaver = new MemorySaver();

const agent = createReactAgent({
  llm,
  tools: [retrieveTool],
  checkpointer: memorySaver,
});

const result = await agent.invoke(
  {
    messages: [{ role: "user", content: "who was norris? and what i can learn from this video on youtube with transcript" }],
  },
  { configurable: { thread_id: 1, video_id } }
);
console.log(result.messages.at(-1).content);