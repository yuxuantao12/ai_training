import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import dotenv from "dotenv";
import pg from "pg";
import { z } from "zod";

dotenv.config();

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
});

async function initVectorStore() {
  const vectorStore = await PGVectorStore.initialize(embeddings, {
    pool: new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    }),
    tableName: "documents",
  });
  return vectorStore;
}

export async function getRetrieveTool() {
  const vectorStore = await initVectorStore();
  const retriever = vectorStore.asRetriever(10);

  const tool = retriever.asTool({
    name: "retriever",
    description:
      "A tool to retrieve relevant documents from a vector store. Input is a question, output is a list of relevant documents. Use this tool when you need to find information from the indexed documents.",
    schema: z
      .string()
      .describe("The question to retrieve relevant documents for."),
  });

  return tool;
}
