import React, { useState, useEffect } from 'react';

const ThreadExtractions = ({ threadId }) => {
    const [problems, setProblems] = useState([]);
    const [solutions, setSolutions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Don't fetch if threadId is not available (e.g., before first message)
        if (!threadId) {
            setProblems([]);
            setSolutions([]);
            return;
        }

        const fetchExtractions = async () => {
            // Don't set loading if it's just a background refresh
            // setIsLoading(true); // Maybe only set loading on initial load?
            setError(null);
            try {
                // Construct the correct API URL using the backend port (default 3000)
                const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
                const response = await fetch(`${apiUrl}/api/chat/threads/${threadId}/extractions`);

                if (!response.ok) {
                    // Handle specific errors like 404 Not Found
                    if (response.status === 404) {
                        console.warn(`No extractions found for thread ${threadId} or thread does not exist.`);
                        setProblems([]);
                        setSolutions([]);
                    } else {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                } else {
                    const data = await response.json();
                    setProblems(data.problems || []);
                    setSolutions(data.solutions || []);
                }
            } catch (err) {
                console.error("Failed to fetch extractions:", err);
                setError('抽出結果の読み込みに失敗しました。'); // Translated error
                // Keep stale data? Or clear? Clearing might be less confusing.
                // setProblems([]);
                // setSolutions([]);
            } finally {
                // setIsLoading(false);
            }
        };

        // Fetch immediately on threadId change
        fetchExtractions();

        // Set up interval for periodic fetching (e.g., every 5 seconds)
        const intervalId = setInterval(fetchExtractions, 5000);

        // Cleanup function to clear the interval when the component unmounts or threadId changes
        return () => clearInterval(intervalId);

    }, [threadId]); // Re-run effect when threadId changes

    // Do not render anything if there's no threadId
    if (!threadId) {
        return null;
    }

    // Optional: Show loading state
    // if (isLoading) {
    //     return <div className="p-2 text-sm text-gray-500">Loading extractions...</div>;
    // }

    // Show error state
    if (error) {
        return <div className="p-2 text-sm text-red-600">{error}</div>; // Slightly darker red
    }

    // Show extractions if available
    const hasExtractions = problems.length > 0 || solutions.length > 0;

    return (
        <div className="text-xs md:text-sm text-neutral-700 animate-slide-up custom-scrollbar">
            <div className="flex items-center justify-between mb-2 md:mb-3">
                <h3 className="font-semibold text-primary text-sm md:text-base">抽出されたインサイト</h3>
                <span className="badge badge-secondary text-xs">自動抽出</span>
            </div>
            
            {!hasExtractions && (
                <div className="p-4 bg-white rounded-lg border border-neutral-200 text-neutral-500 italic text-center">
                    このスレッドからはまだインサイトが抽出されていません
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {problems.length > 0 && (
                    <div className="bg-white p-2 md:p-3 border border-neutral-200 rounded-lg shadow-sm">
                        <h4 className="font-medium text-primary-dark flex items-center gap-1 md:gap-2 mb-1 md:mb-2 text-xs md:text-sm">
                            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary inline-block"></span>
                            課題 ({problems.length})
                        </h4>
                        <ul className="space-y-2">
                            {problems.map((p) => (
                                <li key={p._id} className="bg-neutral-50 p-1.5 md:p-2 rounded-md border border-neutral-200 text-neutral-800 text-xs md:text-sm">
                                    {p.statement || 'ステートメントが見つかりません'}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                
                {solutions.length > 0 && (
                    <div className="bg-white p-2 md:p-3 border border-neutral-200 rounded-lg shadow-sm">
                        <h4 className="font-medium text-success flex items-center gap-1 md:gap-2 mb-1 md:mb-2 text-xs md:text-sm">
                            <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-success inline-block"></span>
                            解決策 ({solutions.length})
                        </h4>
                        <ul className="space-y-2">
                            {solutions.map((s) => (
                                <li key={s._id} className="bg-neutral-50 p-1.5 md:p-2 rounded-md border border-neutral-200 text-neutral-800 text-xs md:text-sm">
                                    {s.statement || 'ステートメントが見つかりません'}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ThreadExtractions;