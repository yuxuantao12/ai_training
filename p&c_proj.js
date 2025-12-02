import React, { useState, useCallback, useMemo } from 'react';
import { RefreshCcw, Copy, Zap, Cpu } from 'lucide-react';

// --- CONFIGURATION ---
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const apiKey = ""; // Canvas environment will provide this at runtime

// Helper function for exponential backoff retry logic
const fetchWithRetry = async (url, options, maxRetries = 5) => {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // If 429 (Rate Limit), attempt retry. Otherwise, throw for immediate handling.
                if (response.status === 429 && i < maxRetries - 1) {
                    throw new Error("Rate limit exceeded. Retrying...");
                }
                const errorBody = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorBody}`);
            }
            return response;
        } catch (error) {
            lastError = error;
            // Only retry on specific error types (like network errors or rate limiting)
            if (error.message.includes("Rate limit") || error.message.includes("Failed to fetch")) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
                // console.log(`Retrying in ${delay}ms...`); // Suppress console log for retries as per instructions
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw lastError; // Re-throw other errors immediately
            }
        }
    }
    throw lastError; // Throw the last error after max retries
};

const PromptGenerator = () => {
    // --- State Management ---
    const [task, setTask] = useState('');
    const [role, setRole] = useState('Senior Software Engineer');
    const [language, setLanguage] = useState('Python');
    const [context, setContext] = useState('');
    const [format, setFormat] = useState('markdown code block');
    const [constraints, setConstraints] = useState('Must use modern standards. Do not include introductory or concluding text.');

    const [optimizedPrompt, setOptimizedPrompt] = useState('');
    const [modelResponse, setModelResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [copyStatus, setCopyStatus] = useState('');

    // --- Prompt Assembly Logic ---
    const assemblePrompt = useCallback(() => {
        // Core structure derived from prompt engineering best practices (Role, Context, Task, Format, Constraints)
        const parts = [
            `System Instruction: You are a world-class, detail-oriented ${role}. Your goal is to solve the user's request flawlessly.`,
            `--- CONTEXT ---`,
            context || "No specific context provided. Assume standard environment.",
            `--- TASK ---`,
            `The user requires assistance with the following coding task, focusing on the ${language} language:`,
            task,
            `--- OUTPUT REQUIREMENTS ---`,
            `Format: ${format}.`,
            `Constraints: ${constraints}.`,
            `ACTION: Based on the context and requirements, provide the direct, complete solution.`,
        ];

        return parts.join('\n\n');
    }, [task, role, language, context, format, constraints]);

    // --- API Call Handler ---
    const handleGenerate = useCallback(async () => {
        setError(null);
        setCopyStatus('');
        setIsLoading(true);
        const finalPrompt = assemblePrompt();
        setOptimizedPrompt(finalPrompt); // Show the assembled prompt

        const userQuery = finalPrompt;

        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            // Use the Role as the system instruction
            systemInstruction: { parts: [{ text: `You are a world-class, detail-oriented ${role}. Your goal is to solve the user's request flawlessly.` }] },
            tools: [{ "google_search": {} }], // Enable grounding for broader context
        };

        try {
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            };

            const response = await fetchWithRetry(`${API_URL}?key=${apiKey}`, options);
            const result = await response.json();

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Error: Could not extract generated text.";
            setModelResponse(text);

        } catch (err) {
            console.error("API Call Error:", err);
            setError(`Failed to execute prompt: ${err.message}. Check console for details.`);
        } finally {
            setIsLoading(false);
        }
    }, [assemblePrompt, role]);

    // --- Utility Handlers ---
    const handleCopy = (textToCopy, fieldName) => {
        // Using execCommand for better cross-browser compatibility in certain environments (like iframes)
        const tempElement = document.createElement('textarea');
        tempElement.value = textToCopy;
        document.body.appendChild(tempElement);
        tempElement.select();
        try {
            document.execCommand('copy');
            setCopyStatus(`${fieldName} copied!`);
        } catch (err) {
            setCopyStatus(`Failed to copy ${fieldName}.`);
        }
        document.body.removeChild(tempElement);

        setTimeout(() => setCopyStatus(''), 2000);
    };

    // --- UI Structure ---
    const InputField = ({ label, value, onChange, placeholder, isTextArea = false, options = [] }) => (
        <div className="flex flex-col mb-4">
            <label className="text-sm font-semibold mb-1 text-gray-700">{label}</label>
            {isTextArea ? (
                <textarea
                    rows="4"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-sm resize-y font-mono text-sm"
                />
            ) : options.length > 0 ? (
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-sm"
                >
                    {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-sm"
                />
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10 font-sans">
            <header className="text-center mb-10">
                <h1 className="text-4xl font-extrabold text-gray-900 flex items-center justify-center">
                    <Zap className="w-8 h-8 mr-3 text-blue-600" />
                    AI Prompt Generator
                </h1>
                <p className="text-gray-500 mt-2 text-lg">Structure your thoughts to gain expert-level AI outputs.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {/* --- Input Form (Left Column) --- */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-2xl h-fit sticky top-6">
                    <h2 className="text-xl font-bold mb-4 text-blue-600 border-b pb-2">1. Define Your Request</h2>
                    
                    <InputField
                        label="AI Role/Persona (System Instruction)"
                        value={role}
                        onChange={setRole}
                        placeholder="e.g., Senior Python Developer, QA Tester, Financial Analyst"
                    />

                    <InputField
                        label="Target Language/Domain"
                        value={language}
                        onChange={setLanguage}
                        placeholder="e.g., Python, TypeScript, SQL, Physics"
                        options={['Python', 'TypeScript', 'JavaScript', 'SQL', 'Bash', 'Markdown']}
                    />

                    <InputField
                        label="Core Task/Instruction (What do you need?)"
                        value={task}
                        onChange={setTask}
                        placeholder="e.g., Write a function for binary search, Debug the class definition, Summarize the attached code"
                        isTextArea
                    />

                    <InputField
                        label="Context/Background Code"
                        value={context}
                        onChange={setContext}
                        placeholder="Paste relevant code snippets, error logs, or project details here..."
                        isTextArea
                    />

                    <InputField
                        label="Output Format"
                        value={format}
                        onChange={setFormat}
                        placeholder="e.g., Structured JSON, Markdown Table, Code Block only"
                        options={['markdown code block', 'Structured JSON', 'Detailed step-by-step list', 'Single paragraph']}
                    />

                    <InputField
                        label="Specific Constraints"
                        value={constraints}
                        onChange={setConstraints}
                        placeholder="e.g., Must use recursion, Do not use external libraries, Response under 50 words"
                        isTextArea
                    />
                </div>

                {/* --- Output and Execution (Right Columns) --- */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Action Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !task}
                        className={`w-full py-3 px-6 rounded-xl text-white font-bold text-lg shadow-lg transition duration-300 ${
                            isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300'
                        }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center">
                                <RefreshCcw className="w-5 h-5 mr-2 animate-spin" />
                                Executing Prompt...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center">
                                <Cpu className="w-6 h-6 mr-2" />
                                Generate & Execute Prompt
                            </span>
                        )}
                    </button>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md" role="alert">
                            <p className="font-bold">Execution Error</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {/* 2. Optimized Prompt Output */}
                    <div className="bg-white p-6 rounded-xl shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-gray-800 flex justify-between items-center">
                            2. Optimized Prompt (Input to the AI)
                            <button
                                onClick={() => handleCopy(optimizedPrompt, 'Prompt')}
                                disabled={!optimizedPrompt}
                                className="text-sm text-blue-600 hover:text-blue-800 transition disabled:text-gray-400 disabled:cursor-not-allowed flex items-center"
                            >
                                <Copy className="w-4 h-4 mr-1" />
                                {copyStatus.includes('Prompt') ? copyStatus : 'Copy Prompt'}
                            </button>
                        </h2>
                        <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto whitespace-pre-wrap border border-gray-200 min-h-[150px]">
                            {optimizedPrompt || "Fill in the fields and click 'Generate & Execute' to see the final, structured prompt sent to the AI."}
                        </pre>
                    </div>

                    {/* 3. AI Model Response */}
                    <div className="bg-white p-6 rounded-xl shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-gray-800 flex justify-between items-center">
                            3. AI Model Response (Output)
                            <button
                                onClick={() => handleCopy(modelResponse, 'Response')}
                                disabled={!modelResponse}
                                className="text-sm text-blue-600 hover:text-blue-800 transition disabled:text-gray-400 disabled:cursor-not-allowed flex items-center"
                            >
                                <Copy className="w-4 h-4 mr-1" />
                                {copyStatus.includes('Response') ? copyStatus : 'Copy Response'}
                            </button>
                        </h2>
                        <div className="prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-[300px]">
                            {isLoading && <p className="text-center text-blue-500">Loading response...</p>}
                            {!isLoading && (
                                <p dangerouslySetInnerHTML={{ __html: modelResponse.replace(/\n/g, '<br/>') }} />
                            )}
                            {!isLoading && !modelResponse && !error && (
                                <p className="text-gray-400 text-center italic">The AI's final, high-quality response will appear here after execution.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromptGenerator;
