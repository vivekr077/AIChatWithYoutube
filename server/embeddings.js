import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TaskType } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
});

// storing the vector generated in memory
export const vectorStore = new MemoryVectorStore(embeddings);

export const addYTVideoToVectorStore = async(videoData)=> {

     const { transcript, video_id } = videoData
     const docs = [
       new Document({
         pageContent: transcript,
         metadata: {video_id: video_id},
       }),
     ];
          
     // split the text in chunks
     const textSplitter = new RecursiveCharacterTextSplitter({
       chunkSize: 1000,
       chunkOverlap: 200,
     });
     
     const chunks = await textSplitter.splitDocuments(docs);

     await vectorStore.addDocuments(chunks);
}