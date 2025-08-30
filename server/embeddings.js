import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TaskType } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
});

// Connection retry logic
const initializeVectorStore = async (retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to connect to PostgreSQL (attempt ${i + 1}/${retries})`);
      
      const vectorStore = await PGVectorStore.initialize(embeddings, {
        postgresConnectionOptions: {
          connectionString: process.env.DB_URL,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        },
        tableName: 'transcripts',
        columns: {
          idColumnName: 'id',
          vectorColumnName: 'vector',
          contentColumnName: 'content',
          metadataColumnName: 'metadata'
        },
        distanceStrategy: 'cosine'
      });
      
      console.log('Successfully connected to PostgreSQL');
      return vectorStore;
    } catch (error) {
      console.error(`Connection attempt ${i + 1} failed:`, error.message);
      
      if (i === retries - 1) {
        console.error('All connection attempts failed. Using fallback to MemoryVectorStore');
        return new MemoryVectorStore(embeddings);
      }
        await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

let vectorStore;
try {
  vectorStore = await initializeVectorStore();
} catch (error) {
  console.error('Failed to initialize vector store:', error);
  vectorStore = new MemoryVectorStore(embeddings);
}

export { vectorStore };

export const addYTVideoToVectorStore = async(videoData) => {
  try {
    const { transcript, video_id } = videoData;
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
    console.log(`Successfully added video ${video_id} to vector store`);
  } catch (error) {
    console.error('Error adding video to vector store:', error);
    throw error;
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  try {
    if (vectorStore && vectorStore.pool) {
      await vectorStore.pool.end();
      console.log('Database connections closed');
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  try {
    if (vectorStore && vectorStore.pool) {
      await vectorStore.pool.end();
      console.log('Database connections closed');
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  process.exit(0);
});