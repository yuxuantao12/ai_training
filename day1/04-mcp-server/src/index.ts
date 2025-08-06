import dotenv from "dotenv";
import { FastMCP } from "fastmcp";
import { z } from "zod";

dotenv.config();

const mcpServer = new FastMCP({
  name: "MyMCPServer",
  version: "1.0.0",
});

mcpServer.addTool({
  name: "add",
  description: "Add two numbers",
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async (args) => {
    console.log("Executing add tool with args:", args);
    return String(args.a + args.b);
  },
});

async function main() {
  mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      port: 8000,
    },
  });
}

main();

