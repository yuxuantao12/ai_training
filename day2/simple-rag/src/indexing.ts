import fs from "node:fs/promises";
import path from "node:path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PostgresRecordManager } from "@langchain/community/indexes/postgres";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import dotenv from "dotenv";
import type { Document } from "langchain/document";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { index } from "langchain/indexes";

dotenv.config();

const embeddings = new GoogleGenerativeAIEmbeddings({
	model: "text-embedding-004",
});

async function loadPdf(filePath: string) {
	console.log(`Found PDF file: ${filePath}`);
	const loader = new PDFLoader(filePath);
	const docs = await loader.load();
	return docs;
}

async function loadTxt(filePath: string) {
	console.log(`Found TXT file: ${filePath}`);
	const loader = new TextLoader(filePath);
	const docs = await loader.load();
	return docs;
}

async function splitDocument(docs: Document[]) {
	const textSplitter = new RecursiveCharacterTextSplitter({
		chunkSize: 4096,
		chunkOverlap: 200,
	});
	return textSplitter.splitDocuments(docs);
}

async function indexingDocuments(documents: Document[]) {
	const namespace = documents[0].metadata.source;
	const recordManager = new PostgresRecordManager(namespace, {
		postgresConnectionOptions: {
			connectionString: process.env.DATABASE_URL,
		},
	});
	await recordManager.createSchema();
	const vectorStore = await PGVectorStore.initialize(embeddings, {
		postgresConnectionOptions: {
			connectionString: process.env.DATABASE_URL,
		},
		tableName: "documents",
	});
	const result = await index({
		docsSource: documents,
		recordManager,
		vectorStore,
		options: {
			cleanup: "full",
			sourceIdKey: "source",
		},
	});
	await vectorStore.end();
	await recordManager.end();
	return result;
}

async function indexDocs(dir: string) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
    const docs: Document[] = [];
		if (entry.isFile()) {
			if (entry.name.endsWith(".pdf")) {
				const filePath = path.join("docs", entry.name);
				docs.push(...(await loadPdf(filePath)));
			} else if (entry.name.endsWith(".txt")) {
				const filePath = path.join("docs", entry.name);
				docs.push(...(await loadTxt(filePath)));
			} else {
				console.warn(`Unsupport file type: ${entry.name}`);
			}
		}
		if (docs.length > 0) {
			const splitedDocuments = await splitDocument(docs);
			const result = await indexingDocuments(splitedDocuments);
			console.log(result);
		}
	}
}

async function indexing() {
	const dir = path.join(process.cwd(), "docs");
	await indexDocs(dir);
}

indexing();
