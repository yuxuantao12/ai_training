import process from "node:process";
import { HumanMessage, isAIMessageChunk } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import dotenv from "dotenv";

dotenv.config();

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
});

const langgraphAgent = createReactAgent({
  llm: llm,
  tools: [],
});

async function agent(msg: string) {
  return langgraphAgent.streamEvents(
    {
      messages: [new HumanMessage(msg)],
    },
    { version: "v2" },
  );
}

async function main() {
  const response = await agent("What do you think about ChatGPT?");
  for await (const { event, data } of response) {
    if (event === "on_chat_model_stream" && isAIMessageChunk(data.chunk)) {
      const content = data.chunk.text;
      if (content) {
        process.stdout.write(content);
      }
    }
  }
}

main();
