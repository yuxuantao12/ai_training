import dotenv from "dotenv";

dotenv.config();

async function chat(msg: string) {}

async function main() {
	const userMessage = "What is the capital of France?";
	const response = await chat(userMessage);
	console.log(response);
}

main();
