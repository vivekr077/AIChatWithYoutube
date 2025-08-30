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
    console.log("Triggering youtube video scraper", url);
    const scraper = new YouTubeScraper();
    const result = await scraper.scrapeVideo(url);
    console.log("result is: ", result);
    return result;
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
// retrieval tool
// const retrieveTool = tool(
//   async ({ query, video_id }, {configurable: {}}) => {    
//     try {
//       // Fix the filter syntax - it should be a function
//       const retrievedDocs = await vectorStore.similaritySearch(
//         query, 
//         5, // Increase to 5 for better coverage
//         {
//           filter: {
//             video_id: video_id
//           }
//         }
//       );
      
//       console.log(`Found ${retrievedDocs.length} relevant chunks`);
      
//       if (retrievedDocs.length === 0) {
//         return `No content found for video ${video_id}. The video might not be in the database or the search query didn't match any content.`;
//       }
      
//       // Add context to the response
//       const serializedDocs = retrievedDocs
//         .map((doc, index) => `[Segment ${index + 1}]\n${doc.pageContent}`)
//         .join("\n\n---\n\n");

//       return `Here are the relevant segments from the video transcript:\n\n${serializedDocs}`;
      
//     } catch (error) {
//       console.error("Error in retrieval:", error);
//       return "Error retrieving video content. Please try again.";
//     }
//   },
//   {
//     name: "retrieve_video_content",
//     description: `This tool searches and retrieves relevant segments from a YouTube video transcript.

//     WHEN TO USE THIS TOOL:
//     - ANY question about what is explained, discussed, or shown in a video
//     - Questions about video content, topics, themes, or specific information
//     - Requests for summaries or overviews of the video
//     - Questions about specific people, events, or concepts mentioned in the video
    
//     HOW TO USE:
//     - For general video overview: use queries like "main topics content summary overview"
//     - For specific topics: use the exact terms from the user's question
//     - For people mentioned: include their names in the query
//     - Always cast a wide net with your search terms to ensure comprehensive results
    
//     WHAT IT RETURNS:
//     - Relevant transcript segments that match the search query
//     - Multiple segments are returned to provide context
//     - Use all returned segments to form a comprehensive answer
    
//     IMPORTANT: This tool MUST be used for ANY question about video content. Never answer questions about videos without first retrieving the actual transcript content.`,
    
//     schema: z.object({
//       query: z.string().describe("Search keywords. For general questions use broad terms like 'main topics summary content'. For specific questions, include all relevant terms from the user's question."),
//       video_id: z.string().describe('the id of the video to retrieve.')
//     }),
//   }
// );

const retrieveTool = tool(
  async ({ query, video_id }, { configurable: {} }) => {
    const retrievedDocs = await vectorStore.similaritySearch(query, 3, {
      video_id,
    });

    const serializedDocs = retrievedDocs
      .map((doc) => doc.pageContent)
      .join('\n ');

    return serializedDocs;
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
    const retrievedDocs = await vectorStore.similaritySearch(query, 30);

    const ids = retrievedDocs.map((doc) => doc.metadata.video_id).join('\n ');

    return ids;
  },
  {
    name: 'retrieveSimilarVideos',
    description: 'Retrieve the ids of the most similar videos to the query',
    schema: z.object({
      query: z.string(),
    }),
  }
);


// console.log("Testing vector store...");
// const testDocs = await vectorStore.similaritySearch("video", 3);
// console.log(testDocs);
// console.log("Test search found", testDocs.length, "documents");

export const agent = createReactAgent({
  llm,
  tools: [
    retrieveTool, 
    triggerYouTubeVideoScrapeTool, 
    retrieveSimilarVideosTool
  ],
  checkpointer,
});

