import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:3000/api'; // Adjust if your backend runs elsewhere

function VisualizationArea() {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [questionDetails, setQuestionDetails] = useState(null);
  const [policyDrafts, setPolicyDrafts] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isGeneratingPolicy, setIsGeneratingPolicy] = useState(false);
  const [error, setError] = useState(null);
  const [generationStatus, setGenerationStatus] = useState('');

  // Fetch all questions on component mount
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/questions`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setQuestions(data);
      } catch (e) {
        console.error("Failed to fetch questions:", e);
        setError('問いの読み込みに失敗しました。');
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, []);

  // Fetch details when a question is selected
  useEffect(() => {
    if (!selectedQuestionId) {
      setQuestionDetails(null);
      setPolicyDrafts([]);
      setError(null);
      setGenerationStatus('');
      return;
    }

    const fetchDetails = async () => {
      setIsLoadingDetails(true);
      setError(null);
      setGenerationStatus('');
      try {
        const response = await fetch(`${API_BASE_URL}/questions/${selectedQuestionId}/details`);
        if (!response.ok) {
           if (response.status === 404) {
             throw new Error('問いの詳細が見つかりません。');
           } else {
             throw new Error(`HTTP error! status: ${response.status}`);
           }
        }
        const data = await response.json();
        setQuestionDetails(data);
      } catch (e) {
        console.error("Failed to fetch question details:", e);
        setError(`問い (${selectedQuestionId}) の詳細読み込みに失敗しました。 ${e.message}`);
        setQuestionDetails(null);
      } finally {
        setIsLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedQuestionId]);

  // Fetch policy drafts when a question is selected
  useEffect(() => {
    if (!selectedQuestionId) {
      setPolicyDrafts([]);
      return;
    }

    const fetchDrafts = async () => {
      setIsLoadingDrafts(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/policy-drafts?questionId=${selectedQuestionId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setPolicyDrafts(data);
      } catch (e) {
        console.error("Failed to fetch policy drafts:", e);
        setError(`問い (${selectedQuestionId}) の政策ドラフト読み込みに失敗しました。 ${e.message}`);
        setPolicyDrafts([]);
      } finally {
        setIsLoadingDrafts(false);
      }
    };

    fetchDrafts();
  }, [selectedQuestionId]);

  const handleQuestionSelect = (questionId) => {
    setSelectedQuestionId(prevId => (prevId === questionId ? null : questionId));
  };

  // Handle policy generation request
  const handleGeneratePolicy = async () => {
    if (!selectedQuestionId) return;

    setIsGeneratingPolicy(true);
    setError(null);
    setGenerationStatus('政策ドラフトを生成中...');
    try {
      const response = await fetch(`${API_BASE_URL}/questions/${selectedQuestionId}/generate-policy`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '政策生成の開始に失敗しました。' }));
        throw new Error(`HTTP error! status: ${response.status}. ${errorData.message}`);
      }
      setGenerationStatus('政策生成を開始しました。準備ができ次第、ドラフトが以下に表示されます（更新が必要な場合や、しばらくお待ちいただく場合があります）。');
      setTimeout(() => {
           if (selectedQuestionId) {
                const fetchDrafts = async () => {
                  setIsLoadingDrafts(true);
                  try {
                    const response = await fetch(`${API_BASE_URL}/policy-drafts?questionId=${selectedQuestionId}`);
                    if (!response.ok) throw new Error('ドラフトの取得に失敗しました');
                    const data = await response.json();
                    setPolicyDrafts(data);
                  } catch (e) {
                    console.error("Delayed draft fetch failed:", e);
                  } finally {
                    setIsLoadingDrafts(false);
                  }
                };
                fetchDrafts();
           }
      }, 10000);
    } catch (e) {
      console.error("Failed to trigger policy generation:", e);
      setError(`政策生成の開始に失敗しました: ${e.message}`);
      setGenerationStatus('');
    } finally {
      setIsGeneratingPolicy(false);
    }
  };

  return (
    <div className="p-6 animate-fade-in min-h-full minimal-pattern">
      <h2 className="text-2xl font-semibold mb-6 text-primary border-b border-neutral-200 pb-2">シャープな問いとインサイト</h2>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <p className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Questions List */}
        <div className="lg:col-span-1">
          <div className="bg-white p-4 h-full border border-neutral-200 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium mb-4 text-primary-dark border-b border-neutral-200 pb-2">問いを選択</h3>
            {isLoadingQuestions ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-pulse-slow flex space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              </div>
            ) : questions.length > 0 ? (
              <ul className="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
                {questions.map((q) => (
                  <li key={q._id}>
                    <button
                      onClick={() => handleQuestionSelect(q._id)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-200 text-sm ${
                        selectedQuestionId === q._id
                          ? 'bg-neutral-700 text-white shadow-md'
                          : 'bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      {q.questionText}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-neutral-500 text-sm border border-dashed border-neutral-300 rounded-lg">
                <p>まだ問いが生成されていません</p>
                <p className="mt-2 text-xs">管理パネルから生成してみてください</p>
              </div>
            )}
          </div>
        </div>

        {/* Details Area */}
        <div className="lg:col-span-2">
          <div className="bg-white p-4 h-full border border-neutral-200 rounded-lg shadow-sm">
            {isLoadingDetails && selectedQuestionId ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-pulse-slow flex space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                </div>
              </div>
            ) : selectedQuestionId && questionDetails ? (
              <div className="animate-slide-up">
                <h3 className="text-xl font-semibold mb-6 text-primary border-b border-neutral-200 pb-2">
                  {questionDetails.question.questionText}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Related Problems */}
                  <div className="card p-4 bg-neutral-50 border border-neutral-200">
                    <h4 className="text-md font-semibold mb-3 text-primary-dark flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                      関連する課題 ({questionDetails.relatedProblems.length})
                    </h4>
                    <div className="overflow-y-auto max-h-[300px] pr-2">
                      {questionDetails.relatedProblems.length > 0 ? (
                        <ul className="space-y-3">
                          {questionDetails.relatedProblems.map(p => (
                            <li key={p._id} className="p-3 bg-white rounded-lg border border-neutral-200 text-sm text-neutral-700 shadow-sm">
                              <div className="flex flex-col">
                                <div className="mb-1">{p.statement}</div>
                                <div className="text-xs text-right text-primary-dark">
                                  関連度 {(p.relevanceScore * 100).toFixed(0)}%
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-neutral-500 p-3 bg-white rounded-lg border border-neutral-200">
                          この問いにはまだ課題がリンクされていません
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Related Solutions */}
                  <div className="card p-4 bg-neutral-50 border border-neutral-200">
                    <h4 className="text-md font-semibold mb-3 text-success flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success inline-block"></span>
                      関連する解決策 ({questionDetails.relatedSolutions.length})
                    </h4>
                    <div className="overflow-y-auto max-h-[300px] pr-2">
                      {questionDetails.relatedSolutions.length > 0 ? (
                        <ul className="space-y-3">
                          {questionDetails.relatedSolutions.map(s => (
                            <li key={s._id} className="p-3 bg-white rounded-lg border border-neutral-200 text-sm text-neutral-700 shadow-sm">
                              <div className="flex flex-col">
                                <div className="mb-1">{s.statement}</div>
                                <div className="text-xs text-right text-success">
                                  関連度 {(s.relevanceScore * 100).toFixed(0)}%
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-neutral-500 p-3 bg-white rounded-lg border border-neutral-200">
                          この問いにはまだ解決策がリンクされていません
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Policy Generation Button & Status */}
                <div className="mb-6 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-md font-semibold text-primary-dark mb-1">政策ドラフト生成</h4>
                      <p className="text-sm text-neutral-600">この問いに関連する課題と解決策から政策ドラフトを生成します</p>
                    </div>
                    <button
                      onClick={handleGeneratePolicy}
                      disabled={isGeneratingPolicy || isLoadingDetails}
                      className="btn btn-primary px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm whitespace-nowrap"
                    >
                      {isGeneratingPolicy ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          生成中...
                        </span>
                      ) : '政策ドラフト生成'}
                    </button>
                  </div>
                  {generationStatus && (
                    <div className="mt-3 p-3 bg-primary-light/20 border border-primary-light rounded-lg text-sm text-primary-dark">
                      {generationStatus}
                    </div>
                  )}
                </div>

                {/* Policy Drafts Display */}
                <div>
                  <h4 className="text-lg font-semibold mb-4 text-primary-dark border-b border-neutral-200 pb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary-dark inline-block"></span>
                    政策ドラフト ({policyDrafts.length})
                  </h4>
                  {isLoadingDrafts ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-pulse-slow flex space-x-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      </div>
                    </div>
                  ) : policyDrafts.length > 0 ? (
                    <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
                      {policyDrafts.map(draft => (
                        <div key={draft._id} className="card p-4 border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-all duration-200">
                          <h5 className="font-semibold text-primary-dark text-lg mb-2">{draft.title}</h5>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="badge badge-primary text-xs">v{draft.version || '1'}</span>
                            <span className="text-xs text-neutral-500">
                              {new Date(draft.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="prose prose-sm max-w-none text-neutral-700 bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                            <p className="whitespace-pre-wrap">{draft.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-neutral-500 text-sm border border-dashed border-neutral-300 rounded-lg">
                      <p>この問いに対する政策ドラフトはまだ生成されていません</p>
                      <p className="mt-2 text-xs">上のボタンから生成を開始できます</p>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedQuestionId && !isLoadingDetails ? (
              <div className="p-6 text-center text-red-600 text-sm border border-dashed border-red-300 rounded-lg">
                <p>選択された問いの詳細を読み込めませんでした</p>
                <p className="mt-2 text-xs">別の問いを選択するか、ページを更新してみてください</p>
              </div>
            ) : (
              <div className="p-12 text-center text-neutral-500 flex flex-col items-center justify-center h-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-neutral-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium mb-2">問いを選択してください</p>
                <p className="text-sm">リストから問いを選択すると、詳細と政策オプションが表示されます</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VisualizationArea;