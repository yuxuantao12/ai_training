import {
	HumanMessage,
	isAIMessageChunk,
	SystemMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import "dotenv/config";
import { z } from "zod";
import { cagSearch } from "./cag";
import { JinaAIReranker } from "./hybridSearchWithReranking";
import { hybridSearch } from "./pgHybridSearch";

const ragPrompt = `You are a helpful assistant and can do the following tasks:
  1. answering users's question based on the given context.
  2. finding relevant information based on the input.
  3. **ALWAYS** show your information source when you answer the question.
  4. **ALWAYS** use retrieve tool to find relevant information based on the input.
  5. **NOTE**: If user ask **this book**, or **this article**, you need to use the CAG tool to find the relevant information.

  Workflow:
  1. try to answer the question based on the context.
  2. if the context is not sufficient, ask the user if he/she wants to search on web.
  3. if the user agrees, search the web and provide the answer. Don't try to answer the question without searching.

  Try to keep the answer concise and relevant to the context without providing unnecessary information and explanations.
  If you don't know how answer, just respond "I could not find the answer based on the context you provided.`;

async function getRetrieveTool(originalQuery: string) {
	return tool(
		async ({ query }) => {
			console.log("Retrieving documents for query:", query);
			const docs = await hybridSearch(query, 100);
			const reranker = new JinaAIReranker(process.env.JINA_API_KEY as string);
			const rerankedDocs = await reranker.compressDocuments(
				docs,
				originalQuery,
			);
			const serialized =
				rerankedDocs.length > 0
					? rerankedDocs
							.map(
								(doc) =>
									`Source: ${doc.metadata.source}\nMetadata: ${JSON.stringify(doc.metadata)}\nContent: ${doc.pageContent}`,
							)
							.join("\n")
					: "No relevant knowledge found.";
			console.log("Retrieved documents:", serialized);
			console.log("----------------------------------------");
			return [serialized, rerankedDocs];
		},
		{
			name: "retrieve",
			description: "Retrieves relevant documents based on the query.",
			schema: z.object({
				query: z
					.string()
					.describe("The query to search for relevant documents."),
			}),
			responseFormat: "content_and_artifact",
		},
	);
}

async function getCagTool() {
	return tool(
		async ({ query }) => {
			console.log("Retrieving documents for query:", query);
			const docs = await cagSearch();
			const serialized =
				docs.length > 0
					? docs
							.map(
								(doc) =>
									`Source: ${doc.metadata.source}\nMetadata: ${JSON.stringify(doc.metadata)}\nContent: ${doc.pageContent}`,
							)
							.join("\n")
					: "No relevant knowledge found.";
			console.log("Retrieved documents:", serialized);
			console.log("----------------------------------------");
			return [serialized, docs];
		},
		{
			name: "retrieve",
			description: "CAG tool to find the relevant information.",
			schema: z.object({
				query: z
					.string()
					.describe("The query to search for relevant documents."),
			}),
			responseFormat: "content_and_artifact",
		},
	);
}

export async function main() {
	const msg = "List the main idea of this text";
	const retrieveTool = await getCagTool();
	const llm = new ChatGoogleGenerativeAI({
		model: "gemini-2.5-flash",
	});

	const agent = createReactAgent({
		llm: llm,
		tools: [retrieveTool],
	});

	const response = agent.streamEvents(
		{
			messages: [new SystemMessage(ragPrompt), new HumanMessage(msg)],
		},
		{ version: "v2" },
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

if (require.main === module) {
	main();
}
