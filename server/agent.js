import express from "express";
import {
  ChatGoogleGenerativeAI,
} from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { vectorStore, addYTVideoToVectorStore } from "./embeddings.js"
import { YouTubeScraper } from "./scrapVideo.js";
import dotenv from "dotenv";
import z from "zod";
// import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";

dotenv.config();

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
});

//triggerYouTubeVideo tool
const triggerYouTubeVideoScrapeTool = tool(
  async({ url }) => {
    try {
      console.log("Triggering youtube video scraper", url);
      const scraper = new YouTubeScraper();
      const result = await scraper.scrapeVideo(url);
      console.log("result is: ", result);
      return result;
    } catch (error) {
      console.error("Error in triggerYouTubeVideoScrapeTool:", error);
      throw new Error(`Failed to scrape YouTube video: ${error.message}`);
    }
  }, {
    name: 'triggerYouTubeVideoScrape',
    description: 
      `Trigger the scraping of a youtube video using the url.
       The tool start a scraping job, that usually take 5 seconds
       The tool will return a video_id that can be check the status of the scraping job
       Use the tool only if the video is not in the vector store already`,
    schema: z.object({
      url: z.string().describe("The YouTube video URL to scrape")
    })
  }
)

const retrieveTool = tool(
  async ({ query, video_id }, { configurable: {} }) => {
    try {
      const retrievedDocs = await vectorStore.similaritySearch(query, 3, {
        video_id,
      });

      const serializedDocs = retrievedDocs
        .map((doc) => doc.pageContent)
        .join('\n ');

      return serializedDocs;
    } catch (error) {
      console.error("Error in retrieveTool:", error);
      
      // Handle database connection errors
      if (error.message && error.message.includes('Connection terminated')) {
        throw new Error("Database connection issue. Please try again in a moment.");
      }
      
      throw new Error(`Failed to retrieve documents: ${error.message}`);
    }
  },
  {
    name: 'retrieve',
    description:
      'Retrieve the most relevant chunks of text from the transcript for a specific youtube video',
    schema: z.object({
      query: z.string(),
      video_id: z.string().describe('The id of the video to retrieve'),
    }),
  }
);

const checkpointer = new MemorySaver();

// retrieveal similar videos tool
const retrieveSimilarVideosTool = tool(
  async ({ query }) => {
    try {
      const retrievedDocs = await vectorStore.similaritySearch(query, 30);

      const ids = retrievedDocs.map((doc) => doc.metadata.video_id).join('\n ');

      return ids;
    } catch (error) {
      console.error("Error in retrieveSimilarVideosTool:", error);
      
      // Handle database connection errors
      if (error.message && error.message.includes('Connection terminated')) {
        throw new Error("Database connection issue. Please try again in a moment.");
      }
      
      throw new Error(`Failed to retrieve similar videos: ${error.message}`);
    }
  },
  {
    name: 'retrieveSimilarVideos',
    description: 'Retrieve the ids of the most similar videos to the query',
    schema: z.object({
      query: z.string(),
    }),
  }
);

export const agent = createReactAgent({
  llm,
  tools: [
    retrieveTool, 
    triggerYouTubeVideoScrapeTool, 
    retrieveSimilarVideosTool
  ],
  checkpointer,
});

