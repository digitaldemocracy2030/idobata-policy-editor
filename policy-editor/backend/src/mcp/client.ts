import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { OPENROUTER_API_KEY } from '../config.js';

// Define types for MCP tools and OpenAI tools
interface McpTool {
    name: string;
    description?: string;
    input_schema: Record<string, any>;
}

// Convert MCP tools to OpenAI tools format
function convertMcpToolsToOpenAI(mcpTools: McpTool[]): OpenAI.Chat.ChatCompletionTool[] {
    return mcpTools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description || '',
            parameters: {
                type: 'object',
                properties: tool.input_schema.properties || {},
                required: tool.input_schema.required || []
            }
        }
    }));
}

// Initialize OpenAI client with OpenRouter base URL
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
});

// MCP Client class
export class McpClient {
    private mcp: Client;
    private transport: StdioClientTransport | null = null;
    private _tools: McpTool[] = [];
    private _initialized: boolean = false; // Track initialization status

    // Getter for tools
    get tools(): McpTool[] {
        return this._tools;
    }

    // Getter for initialization status
    get initialized(): boolean {
        return this._initialized;
    }

    constructor() {
        this.mcp = new Client({
            name: 'idobata-policy-editor-client',
            version: '1.0.0'
        });
    }

    /**
     * Connect to an MCP server
     * @param serverScriptPath Path to the server script
     */
    async connectToServer(serverScriptPath: string): Promise<void> {
        if (this._initialized) {
            logger.warn('MCP client is already initialized.');
            return;
        }
        try {
            const isJs = serverScriptPath.endsWith('.js');
            const isPy = serverScriptPath.endsWith('.py');

            if (!isJs && !isPy) {
                throw new Error('Server script must be a .js or .py file');
            }

            const command = isPy
                ? process.platform === 'win32' ? 'python' : 'python3'
                : process.execPath; // Use node executable path for .js

            this.transport = new StdioClientTransport({
                command,
                args: [serverScriptPath],
                // Environment variables from process.env should be inherited by the child process
            });

            await this.mcp.connect(this.transport); // Connect might be async

            const toolsResult = await this.mcp.listTools();
            this._tools = toolsResult.tools.map((tool: any) => ({ // Simplified map return
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
            }));

            this._initialized = true; // Mark as initialized

            logger.info(
                'Connected to MCP server with tools:',
                this.tools.map(({ name }) => name)
            );
        } catch (e) {
            logger.error('Failed to connect to MCP server:', e);
            this._initialized = false; // Ensure status is false on error
            this.transport = null; // Clear transport on error
            throw e; // Re-throw the error for the caller to handle
        }
    }

    /**
     * Process a user query using Claude via OpenRouter
     * @param query User's query text
     * @param history Conversation history (array of messages)
     * @param branchId The current branch ID associated with the chat (optional)
     * @param fileContent The content of the currently viewed file (optional)
     * @param userName The name of the user initiating the request (optional)
     * @returns Response from the model
     */
    async processQuery(
        query: string,
        history: OpenAI.Chat.ChatCompletionMessageParam[] = [],
        branchId?: string,
        fileContent?: string,
        userName?: string
    ): Promise<string> {
        if (!this._initialized || !this.mcp) {
            return 'Error: MCP client is not connected.';
        }

        // Define messages with proper typing for OpenAI API, starting with the system prompt and history
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: `あなたは、ユーザーが政策案の改善提案を作成するのを支援するAIアシスタントです。「現在のファイル内容」として提供された政策文書について、ユーザー（名前：${userName || '不明'}）が改善提案を練り上げるのを手伝うことがあなたの目標です。

政策案は共有オンラインワークスペース（GitHub）で保管・管理されています。あなたのタスクは、改善の可能性についてユーザーと議論し、ファイル内容を変更し、他の人によるレビューのために準備することです。

以下の手順で協力しましょう：
1.  **改善点の議論:** ユーザーが政策改善のアイデアを共有します。これらのアイデアについて、批判的に議論してください。ユーザーの提案に疑問を投げかけ、最終的な変更が強力でよく考慮されたものになるように、その影響をユーザーが考えるのを手伝ってください。提供されたテキストのみを扱ってください。
2.  **下書きの編集:** 具体的な変更点について合意したら、利用可能なツールを使って、これらの変更をあなた専用の下書きスペース（ブランチ）に新しいバージョン（コミット）として保存します。これはユーザーの個人的な編集作業です。変更点の要約を提示して最終確認を求め、承認を得たら直接変更をコミットします。変更箇所は本当に必要なものだけにしてください。コミットメッセージにはユーザー名（${userName || '不明'}）を含めてください。
    この作業は、ユーザーが望む限り何度でも繰り返せます。
3.  **レビュー依頼の準備:** 下書きの編集にユーザーが満足したら、他の人にフィードバックをもらうためにレビューを依頼する準備をします。利用可能なツールを使ってプルリクエストのタイトルと説明を設定してください。ツールで設定するプルリクエストの説明には、行われた改善点、その意図や目的、背景などを可能な限り明確かつ詳細（1000文字以上）に述べ、ユーザー名（${userName || '匿名'}）を記載しましょう。このメッセージは、変更内容とその理由を他の人に伝えるために使われます（プルリクエスト）。
4.  **リンクの共有:** ツールを使ってプルリクエストを更新した後に、提案された変更へのウェブリンク（プルリクエストリンク）をユーザーに提供してください。

注意点：ユーザーは「Git」、「コミット」、「ブランチ」、「プルリクエスト」のような技術用語に詳しくありません。プロセスやあなたが取る行動を説明する際には、シンプルで日常的な言葉を使用してください。提供された政策文書の内容改善にのみ集中しましょう。
返答は最大500文字。`
            },
            ...history
        ];

        // Construct and add context message if branchId or fileContent is available
        let contextContent = "";
        if (branchId) {
            contextContent += `Current Branch ID: ${branchId}\n`;
        }
        if (fileContent) {
            // Truncate potentially long file content to avoid excessive token usage
            const maxContentLength = 50000; // Adjust as needed
            const truncatedContent = fileContent.length > maxContentLength
                ? fileContent.substring(0, maxContentLength) + "\n... (content truncated)"
                : fileContent;
            contextContent += `\nCurrent File Content:\n---\n${truncatedContent}\n---`;
        }

        if (contextContent) {
            messages.push({
                role: 'system', // Use system role for context
                content: contextContent.trim(),
            });
        }

        // Add the current user query *after* the context
        messages.push({
            role: 'user',
            content: query,
        });

        try {
            // Convert MCP tools to OpenAI format
            const openaiTools = convertMcpToolsToOpenAI(this.tools);

            const response = await openai.chat.completions.create({
                model: 'google/gemini-2.5-pro-preview-03-25',
                messages: messages,
                tools: openaiTools.length > 0 ? openaiTools : undefined, // Only pass tools if available
                tool_choice: openaiTools.length > 0 ? 'auto' : undefined, // Only allow tool choice if tools exist
                max_tokens: 50000,
            });

            const finalText: string[] = [];
            const toolResults: any[] = [];

            // Process the response content
            if (response.choices && response.choices.length > 0) {
                const message = response.choices[0].message;

                // Handle text content
                if (message.content) {
                    finalText.push(message.content);
                }

                // Handle tool calls
                if (message.tool_calls && message.tool_calls.length > 0) {
                    // Add the assistant's message with tool calls to history
                    messages.push({
                        role: 'assistant',
                        content: message.content, // Include any text content alongside tool calls
                        tool_calls: message.tool_calls,
                    });

                    for (const toolCall of message.tool_calls) {
                        const toolName = toolCall.function.name;
                        let toolArgs = {};
                        try {
                            toolArgs = JSON.parse(toolCall.function.arguments);
                        } catch (parseError) {
                            logger.error(`Failed to parse arguments for tool ${toolName}:`, parseError);
                            // Add an error message for this specific tool call
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                // name: toolName, // Removed invalid 'name' property
                                content: `Error: Invalid arguments format. ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
                            });
                            continue; // Skip to the next tool call
                        }


                        logger.debug(`Calling tool ${toolName} with args:`, toolArgs);

                        try {
                            const result = await this.mcp.callTool({
                                name: toolName,
                                arguments: toolArgs,
                            });

                            toolResults.push(result);
                            // Add the tool result to messages for follow-up
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                // name: toolName, // Removed invalid 'name' property
                                content: JSON.stringify(result.content || result), // Send back content or the whole result
                            });

                        } catch (toolError) {
                            logger.error(`Error calling tool ${toolName}:`, toolError);
                            messages.push({
                                tool_call_id: toolCall.id,
                                role: 'tool',
                                // name: toolName, // Removed invalid 'name' property
                                content: `Error executing tool: ${toolError instanceof Error ? toolError.message : 'Unknown tool error'}`,
                            });
                        }
                    }

                    // Get a follow-up response from the model after processing all tool calls
                    const followUpResponse = await openai.chat.completions.create({
                        model: 'google/gemini-2.5-pro-preview-03-25',
                        messages: messages, // Send updated history including tool results/errors
                        max_tokens: 50000,
                    });

                    if (followUpResponse.choices && followUpResponse.choices.length > 0) {
                        finalText.push(followUpResponse.choices[0].message.content || '');
                    }
                }
            }

            // If finalText is empty after processing, return a default message
            if (finalText.length === 0 || finalText.every(t => t.trim() === '')) {
                return "I received the request but didn't generate a text response.";
            }

            return finalText.join('\n').trim();
        } catch (error) {
            logger.error('Error processing query:', error);
            return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        if (this.mcp && this._initialized) {
            try {
                await this.mcp.close();
                logger.info('MCP client connection closed.');
            } catch (error) {
                logger.error('Error closing MCP client connection:', error);
            } finally {
                this._initialized = false;
                this.transport = null;
                this._tools = [];
            }
        }
    }
}