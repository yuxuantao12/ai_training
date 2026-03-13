import {
  HumanMessage,
  isAIMessageChunk,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import dotenv from "dotenv";
import { getRetrieveTool } from "./retrieval";

dotenv.config();

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
});

async function streamMessage(
  msg: string,
  agent: ReturnType<typeof createReactAgent>,
) {
  const systemPrompt = new SystemMessage(`\
You're a helpful assistant to help user retrieve documents.

If you don't know the answer, just say that you don't know, don't try to make up an answer.

If you get the answer, please also show the source of the answer, like this:

Source: [Document Title](Document URL)

Use three sentences maximum and keep the answer as concise as possible.
Always say "thanks for asking!" at the end of the answer.
`);
  return agent.streamEvents(
    {
      messages: [systemPrompt, new HumanMessage(msg)],
    },
    { version: "v2" },
  );
}

async function main() {
  const retrieveTool = await getRetrieveTool();
  const agent = createReactAgent({
    llm: llm,
    tools: [retrieveTool],
  });
  const response = await streamMessage(
    "根据你的知识库，提供一个智能手机助手的提示词",
    agent,
  );
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
