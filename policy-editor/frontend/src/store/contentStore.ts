import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { fetchGitHubContent, GitHubFile, GitHubDirectoryItem } from '../lib/github';

// Define Message type (assuming structure from ChatPanel.tsx)
interface Message {
    id: number;
    text: string;
    sender: 'user' | 'bot';
}

// Use specific types from the API client
type GitHubContent = GitHubFile | GitHubDirectoryItem[] | null;

// Structure for chat threads associated with file paths
interface ChatThread {
    messages: Message[];
    branchId: string | null;
    nextMessageId: number; // To manage message IDs within a thread
}

interface ContentState {
    repoOwner: string;
    repoName: string;
    currentPath: string;
    content: GitHubContent;
    contentType: 'file' | 'dir' | null;
    isLoading: boolean;
    error: Error | null;
    chatThreads: Record<string, ChatThread>; // Map file path to chat thread
    // アクションの型定義
    setRepoInfo: (owner: string, name: string) => void;
    fetchContent: (path: string, ref?: string) => Promise<void>; // Add optional ref parameter
    // Chat related actions
    getOrCreateChatThread: (path: string) => ChatThread;
    addMessageToThread: (path: string, message: Omit<Message, 'id'>) => void; // Pass message content, ID is generated internally
    ensureBranchIdForThread: (path: string) => string; // Ensures branchId exists and returns it
    reloadCurrentContent: () => Promise<void>; // Action to reload content for the current path
    // Internal actions (optional, kept for consistency)
    _setContent: (content: GitHubContent, type: 'file' | 'dir' | null) => void;
    _setLoading: (loading: boolean) => void;
    _setError: (error: Error | null) => void;
    _setCurrentPath: (path: string) => void;
}

const useContentStore = create<ContentState>()(
    devtools(
        (set, get) => ({
            // --- State ---
            repoOwner: import.meta.env.VITE_GITHUB_REPO_OWNER || '',
            repoName: import.meta.env.VITE_GITHUB_REPO_NAME || '',
            currentPath: '',
            content: null,
            contentType: null,
            isLoading: false,
            error: null,
            chatThreads: {}, // Initialize chatThreads as an empty object

            // --- Actions ---
            setRepoInfo: (owner, name) => set({ repoOwner: owner, repoName: name }),

            fetchContent: async (path: string, ref?: string) => {
                console.log(`Fetching content for path: ${path}`);
                // Only set loading, error, and path. Keep existing content/type during fetch.
                set({ isLoading: true, error: null, currentPath: path });

                try {
                    const { repoOwner, repoName } = get(); // Get owner/name from state
                    if (!repoOwner || !repoName) {
                        throw new Error('Repository owner and name are not set in the store.');
                    }
                    // Pass the ref to the API call if provided
                    const data = await fetchGitHubContent(repoOwner, repoName, path, ref);

                    if (Array.isArray(data)) { // Directory content
                        // Sort directory items: folders first, then files, alphabetically
                        const sortedData = [...data].sort((a, b) => {
                            if (a.type === b.type) {
                                return a.name.localeCompare(b.name); // Sort alphabetically if types are the same
                            }
                            return a.type === 'dir' ? -1 : 1; // Put 'dir' type first
                        });
                        set({ content: sortedData, contentType: 'dir', isLoading: false });
                    } else if (typeof data === 'object' && data !== null && data.type === 'file') { // File content
                        set({ content: data, contentType: 'file', isLoading: false });
                    } else {
                        // Should not happen with the current API client, but good practice
                        console.error('Unexpected API response format:', data);
                        throw new Error('Unexpected API response format');
                    }
                } catch (fetchError) {
                    console.error('Error in fetchContent action:', fetchError);
                    const error = fetchError instanceof Error ? fetchError : new Error('An unknown error occurred');

                    // Check if a ref was provided and the error is a 404 indicating the ref doesn't exist
                    if (ref && error.message.includes('404') && (error.message.includes('Not Found') || error.message.includes('No commit found for the ref'))) {
                        console.warn(`Ref '${ref}' not found for path '${path}'. Falling back to default branch.`);
                        // Try fetching again without the ref (default branch)
                        try {
                            const { repoOwner, repoName } = get();
                            if (!repoOwner || !repoName) {
                                throw new Error('Repository owner and name are not set.');
                            }
                            // Fetch without ref
                            const fallbackData = await fetchGitHubContent(repoOwner, repoName, path);

                            if (Array.isArray(fallbackData)) { // Directory
                                const sortedData = [...fallbackData].sort((a, b) => {
                                    if (a.type === b.type) return a.name.localeCompare(b.name);
                                    return a.type === 'dir' ? -1 : 1;
                                });
                                set({ content: sortedData, contentType: 'dir', error: null }); // Clear previous error
                            } else if (typeof fallbackData === 'object' && fallbackData !== null && fallbackData.type === 'file') { // File
                                set({ content: fallbackData, contentType: 'file', error: null }); // Clear previous error
                            } else {
                                throw new Error('Unexpected fallback API response format');
                            }
                        } catch (fallbackFetchError) {
                            console.error('Error during fallback fetch:', fallbackFetchError);
                            const finalError = fallbackFetchError instanceof Error ? fallbackFetchError : new Error('An unknown error occurred during fallback fetch');
                            // On final fallback error, reset content/type
                            set({ error: finalError, content: null, contentType: null, isLoading: false });
                        }
                    } else {
                        // If it wasn't a ref-related 404, or no ref was provided, set the original error
                        // On initial fetch error (not ref-related 404), reset content/type
                        set({ error: error, content: null, contentType: null, isLoading: false });
                    }
                } finally {
                    set({ isLoading: false }); // Ensure loading is always set to false regardless of success, initial error, or fallback error
                }
            },

            // --- Chat Actions ---
            getOrCreateChatThread: (path) => {
                const state = get();
                if (!state.chatThreads[path]) {
                    // Create a new thread if it doesn't exist
                    set((prevState) => ({
                        chatThreads: {
                            ...prevState.chatThreads,
                            [path]: { messages: [], branchId: null, nextMessageId: 1 },
                        },
                    }));
                    // Return the newly created structure
                    return { messages: [], branchId: null, nextMessageId: 1 };
                }
                return state.chatThreads[path];
            },

            addMessageToThread: (path, messageContent) => {
                set((state) => {
                    const thread = state.chatThreads[path];
                    if (!thread) {
                        console.warn(`Attempted to add message to non-existent thread: ${path}`);
                        return {}; // No change if thread doesn't exist
                    }
                    const newMessage: Message = {
                        ...messageContent,
                        id: thread.nextMessageId,
                    };
                    return {
                        chatThreads: {
                            ...state.chatThreads,
                            [path]: {
                                ...thread,
                                messages: [...thread.messages, newMessage],
                                nextMessageId: thread.nextMessageId + 1,
                            },
                        },
                    };
                });
            },

            ensureBranchIdForThread: (path) => {
                const state = get();
                let thread = state.chatThreads[path];

                // Ensure thread exists first
                if (!thread) {
                    thread = state.getOrCreateChatThread(path); // Create it if missing
                }

                if (thread.branchId) {
                    return thread.branchId; // Return existing ID
                } else {
                    // Generate new branch ID: idobata- + 6 random alphanumeric chars
                    const randomPart = Math.random().toString(36).substring(2, 8);
                    const newBranchId = `idobata-${randomPart}`;

                    set((prevState) => ({
                        chatThreads: {
                            ...prevState.chatThreads,
                            [path]: {
                                ...prevState.chatThreads[path], // Get the latest state of the thread
                                branchId: newBranchId,
                            },
                        },
                    }));
                    return newBranchId;
                }
            },
            reloadCurrentContent: async () => {
                const { currentPath, fetchContent, chatThreads } = get();
                if (currentPath) {
                    console.log(`Reloading content for path: ${currentPath}`);
                    // Check if there's a branchId associated with the current path's chat thread
                    const currentThread = chatThreads[currentPath];
                    const ref = currentThread?.branchId ?? undefined; // Use branchId as ref if it exists, otherwise undefined
                    await fetchContent(currentPath, ref); // Pass ref if available
                } else {
                    console.warn('Attempted to reload content, but currentPath is not set.');
                }
            },

            // --- Internal Actions --- (Kept for potential internal use)
            _setContent: (content, type) => set({ content, contentType: type }),
            _setLoading: (loading) => set({ isLoading: loading }),
            _setError: (error) => set({ error }),
            // _setCurrentPath was duplicated here, removed. The correct one is below.
            _setCurrentPath: (path) => set({ currentPath: path }),
        }),
        {
            name: 'github-content-store', // devtoolsでの表示名
        }
    )
);

// 初期化処理: 環境変数から読み込む (createの外でも可能)
// useContentStore.getState().setRepoInfo(
//   import.meta.env.VITE_GITHUB_REPO_OWNER || '',
//   import.meta.env.VITE_GITHUB_REPO_NAME || ''
// );
// Note: create内の初期値設定で十分な場合が多い

export default useContentStore;