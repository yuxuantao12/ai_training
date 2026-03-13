import { Document } from "@langchain/core/documents";
import { BufferLoader } from "langchain/document_loaders/fs/buffer";
import readXlsxFile from "read-excel-file/node";

export class ExcelLoader extends BufferLoader {
	constructor(readonly filePathOrBlob: string | Blob) {
		super(filePathOrBlob);
	}

	protected async parse(
		raw: Buffer,
		metadata: Document["metadata"],
	): Promise<Document[]> {
		const rows = await readXlsxFile(raw);

		if (rows.length === 0) {
			return [];
		}

		// Use first row as headers
		const headers = rows[0] as string[];
		const dataRows = rows.slice(1);

		const documents: Document[] = dataRows.map((row, _) => {
			// Convert row data to object using headers
			const rowData: Record<string, unknown> = {};
			headers.forEach((header, colIndex) => {
				rowData[header] = row[colIndex];
			});

			// Create document content as JSON string
			const pageContent = JSON.stringify(rowData);

			return new Document({
				pageContent,
				metadata,
			});
		});

		return documents;
	}
	catch(error: unknown) {
		throw new Error(
			`Failed to load Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
