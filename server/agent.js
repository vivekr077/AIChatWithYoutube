import express from 'express'
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { tool } from '@langchain/core/tools';
import { Document } from '@langchain/core/documents';
import dotenv from 'dotenv'
import data from './data.js'
import z from 'zod';
// import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";

dotenv.config();

const app = express()
const port = 3000

const video1 = data[0];
const docs = [new Document({
  pageContent: video1.transcript,
  video_id: video1.video_id
},)];

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0
});


// split the text in chunks
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const chunks = await textSplitter.splitDocuments(docs);

// embed the chunks
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
});

// storing the vector generated in memory
const vectorStore = new MemoryVectorStore(embeddings);

await vectorStore.addDocuments(chunks);




// retrieval tool
const retrieveTool = tool(
  async({ query }) =>{
    console.log("retrieved docs for query-----------------------");
    console.log(query);
    
    // retrieve the most relevant chunks
    const retrievedDocs = await vectorStore.similaritySearch(query, 3); 
    console.log(retrievedDocs);

    const serializedDocs = retrievedDocs
      .map(
        (doc) => doc.pageContent)
      .join("\n");

    return serializedDocs;
  },
  {
    name: 'retrieve',
    description: "Retrieve information related to a query.",
    schema: z.object({
      query: z.string()
    }),
  }
)

const agent = createReactAgent( {llm, tools:[retrieveTool]} );
const result = await agent.invoke({
   messages: [{role: 'user', content: "what was the strategy of Lando norris?"}]
})

console.log(result);

// console.log(chunks);
























// const loader = YoutubeLoader.createFromUrl('https://youtu.be/Zs-trk42vFo?si=Jt_pNwTsbGErru8u', {
//       language: "en",
//       addVideoInfo: true
// });

// const docs = await loader.load();

// console.log(docs)