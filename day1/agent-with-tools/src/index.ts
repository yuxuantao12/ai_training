import process from "node:process";
import { HumanMessage, isAIMessageChunk } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
});

const calculatorSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide"])
    .describe("The type of operation to execute."),
  number1: z.number().describe("The first number to operate on."),
  number2: z.number().describe("The second number to operate on."),
});

const calculatorTool = tool(
  async ({ operation, number1, number2 }) => {
    console.log("Calculator tool called with:", {
      operation,
      number1,
      number2,
    });
    // Functions must return strings
    if (operation === "add") {
      return `${number1 + number2}`;
    } else if (operation === "subtract") {
      return `${number1 - number2}`;
    } else if (operation === "multiply") {
      return `${number1 * number2}`;
    } else if (operation === "divide") {
      return `${number1 / number2}`;
    } else {
      throw new Error("Invalid operation.");
    }
  },
  {
    name: "calculator",
    description: "Can perform mathematical operations.",
    schema: calculatorSchema,
  },
);

const langgraphAgent = createReactAgent({
  llm: llm,
  tools: [calculatorTool],
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
  const response = await agent("What is 3 * 5?");
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
