
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, FileText, Users, ChevronRight, Check, X, Trophy, BarChart3, LayoutList, Percent, Filter, Calendar, Search, Trash2, AlertTriangle, Copy } from 'lucide-react';
import { Button } from './ui/Button';
import { FormBuilder } from './FormBuilder';
import { Form, Response, Question } from '../utils/mockStore';
import { supabase } from '../utils/supabase';
import { SkeletonCard, SkeletonRow, LoadingOverlay } from './ui/Loading';

interface ModeratorDashboardProps {
  username: string;
  userId: string;
}

// --- Helper: Smart Answer Normalization ---
// Converts "eight" -> 8, "20" -> 20, "Twenty One" -> 21 for fuzzy comparison
const normalizeToNumberOrString = (val: any): string | number => {
  if (val === null || val === undefined) return '';
  
  const str = String(val).trim().toLowerCase();
  
  // 1. Check if it's a numeric string directly (e.g., "8", "8.5")
  const num = Number(str);
  if (!isNaN(num) && str !== '') {
    return num;
  }

  // 2. Check if it's a common number word
  const numberWords: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
    'hundred': 100, 'thousand': 1000
  };

  // Basic parser for compound words like "twenty-one" or "one hundred five"
  const parts = str.split(/[\s-]+/); // split by space or hyphen
  let total = 0;
  let subTotal = 0;
  let isNumberWord = true;

  // If empty or only symbols
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) return str;

  for (const part of parts) {
    if (part === 'and') continue;
    
    const val = numberWords[part];
    if (val !== undefined) {
       if (val >= 100) {
         subTotal = (subTotal === 0 ? 1 : subTotal) * val;
         total += subTotal;
         subTotal = 0;
       } else {
         subTotal += val;
       }
    } else {
       isNumberWord = false;
       break;
    }
  }
  
  total += subTotal;

  // If we successfully parsed a number word sequence
  if (isNumberWord) {
    return total;
  }

  // Fallback: return original string
  return str;
};

export const ModeratorDashboard: React.FC<ModeratorDashboardProps> = ({ username, userId }) => {
  const [view, setView] = useState<'list' | 'create' | 'responses'>('list');
  const [activeTab, setActiveTab] = useState<'individual' | 'analytics'>('individual');
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(false);

  // Deletion State
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy Code State
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filtering State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    minScore: '',
    maxScore: '',
    questionId: '',
    answerKeyword: ''
  });

  useEffect(() => {
    if (view === 'list') {
      fetchForms();
    }
  }, [view]);

  const fetchForms = async () => {
    setLoading(true);
    // Artificial delay for smooth skeleton animation demonstration (remove in prod if needed)
    await new Promise(resolve => setTimeout(resolve, 800)); 
    
    const { data, error } = await supabase
      .from('forms')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setForms(data);
    }
    setLoading(false);
  };

  const handleCreate = () => {
    setView('create');
  };

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteForm = async () => {
    if (!formToDelete || !formToDelete.id) return;
    setIsDeleting(true);

    try {
        // 1. Delete responses associated with this form
        // We perform this first. If RLS policies are missing, this might fail or delete nothing.
        const { error: respError } = await supabase
            .from('responses')
            .delete()
            .eq('form_code', formToDelete.code);

        if (respError) throw respError;

        // 2. Delete the form itself
        // requesting 'exact' count ensures we know if the row was actually deleted from DB
        const { error: formError, count } = await supabase
            .from('forms')
            .delete({ count: 'exact' })
            .eq('id', formToDelete.id);

        if (formError) throw formError;
        
        // If count is 0, it means the database operation didn't delete any rows (likely due to permission/RLS)
        // even if no error was thrown.
        if (count === 0) {
            throw new Error("Database permission denied. Please run the provided SQL script in Supabase to enable deletion.");
        }

        // 3. Update local state
        setForms(prev => prev.filter(f => f.id !== formToDelete.id));
        setFormToDelete(null);
    } catch (err: any) {
        console.error("Error deleting form:", err);
        alert("Failed to delete form. " + err.message);
    } finally {
        setIsDeleting(false);
    }
  };

  const handleViewResponses = async (form: Form) => {
    setSelectedForm(form);
    setView('responses');
    setActiveTab('individual'); // Default to list view
    setLoading(true);
    
    // Reset filters when opening a new form
    setFilters({
      dateFrom: '',
      dateTo: '',
      minScore: '',
      maxScore: '',
      questionId: '',
      answerKeyword: ''
    });
    setShowFilters(false);

    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('form_code', form.code)
      .order('submitted_at', { ascending: false });
      
    if (!error && data) {
      setResponses(data);
    }
    setLoading(false);
  };

  const checkAnswer = (q: Question, userAnswer: any): boolean => {
    if (!userAnswer) return false;
    if (!q.correctAnswer) return false;

    if (q.type === 'short_answer') {
      // Use smart normalization for comparison
      const userNorm = normalizeToNumberOrString(userAnswer);
      const correctNorm = normalizeToNumberOrString(q.correctAnswer);
      return userNorm === correctNorm;
    } else if (q.type === 'multiple_choice') {
      return userAnswer === q.correctAnswer;
    } else if (q.type === 'checkbox') {
      // Lenient check: If the correct answer key is present in the user's selected options.
      return Array.isArray(userAnswer) && userAnswer.includes(q.correctAnswer);
    }
    return false;
  };

  const calculateScore = (form: Form, response: Response) => {
    let score = 0;
    let total = 0;

    form.questions.forEach(q => {
      if (q.correctAnswer) {
        total++;
        if (checkAnswer(q, response.answers[q.id])) {
          score++;
        }
      }
    });

    return { score, total };
  };

  // --- Filtering Logic ---
  const filteredResponses = useMemo(() => {
    if (!selectedForm) return [];
    
    return responses.filter(r => {
      // 1. Date Range Filter
      if (filters.dateFrom) {
        const submitDate = new Date(r.submitted_at || '');
        const fromDate = new Date(filters.dateFrom);
        if (submitDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const submitDate = new Date(r.submitted_at || '');
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999); // Include the entire end day
        if (submitDate > toDate) return false;
      }

      // 2. Score Filter
      if (filters.minScore || filters.maxScore) {
        const { score } = calculateScore(selectedForm, r);
        if (filters.minScore && score < parseInt(filters.minScore)) return false;
        if (filters.maxScore && score > parseInt(filters.maxScore)) return false;
      }

      // 3. Answer Content Filter
      if (filters.questionId && filters.answerKeyword) {
        const userVal = r.answers[filters.questionId];
        const keyword = filters.answerKeyword.toLowerCase();
        
        let answerStr = '';
        if (Array.isArray(userVal)) answerStr = userVal.join(' ');
        else if (userVal) answerStr = String(userVal);
        
        if (!answerStr.toLowerCase().includes(keyword)) return false;
      }

      return true;
    });
  }, [responses, filters, selectedForm]);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-400';
    if (percentage >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  // --- Analytics Helper ---
  const getAnalytics = (dataSet: Response[]) => {
    if (!selectedForm || dataSet.length === 0) return null;

    let totalScore = 0;
    let passingCount = 0;

    // Question Analysis Map
    const questionStats: Record<string, { counts: Record<string, number>, total: number }> = {};

    // Initialize stats structure
    selectedForm.questions.forEach(q => {
        questionStats[q.id] = { counts: {}, total: 0 };
    });

    dataSet.forEach(r => {
        // Score Calc
        const { score, total } = calculateScore(selectedForm, r);
        totalScore += score;
        
        // Pass Rate (Arbitrary 50% threshold for now)
        if (total > 0 && (score/total) >= 0.5) passingCount++;

        // Answer Frequency
        selectedForm.questions.forEach(q => {
            const answer = r.answers[q.id];
            let answersToCount: string[] = [];

            if (Array.isArray(answer)) {
                answersToCount = answer.map(String);
            } else if (answer) {
                answersToCount = [String(answer)];
            }

            answersToCount.forEach(ans => {
                // Normalize short answers for better grouping
                const key = q.type === 'short_answer' ? String(normalizeToNumberOrString(ans)) : ans;
                questionStats[q.id].counts[key] = (questionStats[q.id].counts[key] || 0) + 1;
                questionStats[q.id].total++;
            });
        });
    });

    let formMaxPoints = 0;
    selectedForm.questions.forEach(q => { if(q.correctAnswer) formMaxPoints++; });

    const avgScore = dataSet.length > 0 ? (totalScore / dataSet.length).toFixed(1) : "0";
    const avgPercent = formMaxPoints > 0 && dataSet.length > 0 
        ? Math.round((totalScore / (dataSet.length * formMaxPoints)) * 100) 
        : 0;

    return {
        totalResponses: dataSet.length,
        avgScore,
        formMaxPoints,
        avgPercent,
        passingRate: Math.round((passingCount / dataSet.length) * 100),
        questionStats
    };
  };

  const analytics = view === 'responses' && activeTab === 'analytics' ? getAnalytics(filteredResponses) : null;

  if (view === 'create') {
    return <FormBuilder username={username} userId={userId} onClose={() => setView('list')} />;
  }

  if (view === 'responses' && selectedForm) {
    return (
        <div className="h-full flex flex-col animate-slide-up relative">
            {/* Header */}
            <div className="flex flex-col space-y-4 mb-6 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <button onClick={() => setView('list')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
                        &larr; Back to Forms
                    </button>
                    <button
                        onClick={(e) => handleCopyCode(selectedForm.code, e)} 
                        className="bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30 text-indigo-300 text-sm font-mono select-all flex items-center gap-2 hover:bg-indigo-500/30 transition-colors"
                        title="Copy Code"
                    >
                        Code: {selectedForm.code}
                        {copiedCode === selectedForm.code ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                </div>
                
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{selectedForm.title}</h2>
                        <p className="text-gray-400 text-sm">
                          {loading ? 'Syncing responses...' : `Showing ${filteredResponses.length} ${filteredResponses.length !== responses.length ? `of ${responses.length}` : ''} responses`}
                        </p>
                    </div>
                    <Button 
                        variant="secondary" 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`w-auto px-4 py-2 h-10 ${showFilters ? 'bg-white/20 text-white' : ''}`}
                        disabled={loading}
                    >
                        <Filter size={16} /> <span className="hidden sm:inline">Filter</span>
                    </Button>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 font-medium ml-1 flex items-center gap-1"><Calendar size={12}/> Date Range</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="date" 
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                        value={filters.dateFrom}
                                        onChange={e => setFilters({...filters, dateFrom: e.target.value})}
                                    />
                                    <span className="text-gray-500">-</span>
                                    <input 
                                        type="date" 
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                        value={filters.dateTo}
                                        onChange={e => setFilters({...filters, dateTo: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-400 font-medium ml-1 flex items-center gap-1"><Trophy size={12}/> Score (Points)</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Min"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                        value={filters.minScore}
                                        onChange={e => setFilters({...filters, minScore: e.target.value})}
                                    />
                                    <span className="text-gray-500">-</span>
                                    <input 
                                        type="number" 
                                        placeholder="Max"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                        value={filters.maxScore}
                                        onChange={e => setFilters({...filters, maxScore: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1 col-span-1 sm:col-span-2">
                                <label className="text-xs text-gray-400 font-medium ml-1 flex items-center gap-1"><Search size={12}/> Search Answer</label>
                                <div className="flex gap-2">
                                    <select 
                                        className="bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:border-indigo-500 outline-none max-w-[150px]"
                                        value={filters.questionId}
                                        onChange={e => setFilters({...filters, questionId: e.target.value})}
                                    >
                                        <option value="">Any Question</option>
                                        {selectedForm.questions.map((q, i) => (
                                            <option key={q.id} value={q.id}>{i+1}. {q.text.substring(0, 20)}...</option>
                                        ))}
                                    </select>
                                    <input 
                                        type="text"
                                        placeholder={filters.questionId ? "Search in this question..." : "Select question first"}
                                        disabled={!filters.questionId}
                                        className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none disabled:opacity-50"
                                        value={filters.answerKeyword}
                                        onChange={e => setFilters({...filters, answerKeyword: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end mt-3">
                             <button 
                                onClick={() => setFilters({dateFrom: '', dateTo: '', minScore: '', maxScore: '', questionId: '', answerKeyword: ''})}
                                className="text-xs text-red-400 hover:text-red-300 hover:underline"
                             >
                                Clear All Filters
                             </button>
                        </div>
                    </div>
                )}

                {/* Tab Switcher */}
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 w-full max-w-md">
                    <button 
                        onClick={() => setActiveTab('individual')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'individual' 
                            ? 'bg-indigo-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <LayoutList size={16} /> Individual Responses
                    </button>
                    <button 
                        onClick={() => setActiveTab('analytics')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'analytics' 
                            ? 'bg-indigo-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <BarChart3 size={16} /> Analytics
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
                {loading ? (
                     <div className="space-y-3 animate-fade-in">
                        <SkeletonRow />
                        <SkeletonRow />
                        <SkeletonRow />
                        <SkeletonRow />
                        <SkeletonRow />
                    </div>
                ) : filteredResponses.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10 animate-fade-in">
                        <p className="text-gray-500">{responses.length > 0 ? "No responses match your filters." : "No responses yet."}</p>
                    </div>
                ) : activeTab === 'analytics' && analytics ? (
                    <div className="space-y-6 animate-fade-in">
                        {/* Stats Overview Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2 text-gray-400">
                                    <Users size={18} />
                                    <span className="text-sm font-medium uppercase tracking-wider">Total Responses</span>
                                </div>
                                <p className="text-3xl font-bold text-white">{analytics.totalResponses}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2 text-gray-400">
                                    <Trophy size={18} />
                                    <span className="text-sm font-medium uppercase tracking-wider">Average Score</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-white">{analytics.avgScore} <span className="text-lg text-gray-500 font-normal">/ {analytics.formMaxPoints}</span></p>
                                </div>
                            </div>
                             <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2 text-gray-400">
                                    <Percent size={18} />
                                    <span className="text-sm font-medium uppercase tracking-wider">Avg. Percentage</span>
                                </div>
                                <p className={`text-3xl font-bold ${getScoreColor(analytics.avgPercent)}`}>{analytics.avgPercent}%</p>
                            </div>
                        </div>

                        {/* Question Breakdown */}
                        <h3 className="text-lg font-bold text-white mt-8 mb-4">Question Breakdown</h3>
                        <div className="space-y-4">
                            {selectedForm.questions.map((q, idx) => {
                                const stats = analytics.questionStats[q.id];
                                const sortedAnswers = Object.entries(stats.counts)
                                    .sort(([,a], [,b]) => b - a)
                                    .slice(0, 5); // Top 5 answers
                                
                                return (
                                    <div key={q.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="text-white font-medium text-lg">
                                                <span className="text-indigo-400 mr-2">{idx + 1}.</span>
                                                {q.text}
                                            </h4>
                                            <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-400 uppercase">
                                                {q.type.replace('_', ' ')}
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            {sortedAnswers.length > 0 ? sortedAnswers.map(([answer, count]) => {
                                                const percentage = Math.round((count / analytics.totalResponses) * 100);
                                                // Re-normalize for display check to see if it matches correct answer
                                                const normAnswer = normalizeToNumberOrString(answer);
                                                const normCorrect = q.correctAnswer ? normalizeToNumberOrString(q.correctAnswer) : null;
                                                
                                                const isCorrect = q.correctAnswer && (
                                                    q.type === 'short_answer' 
                                                    ? normAnswer === normCorrect
                                                    : answer === q.correctAnswer
                                                );

                                                return (
                                                    <div key={answer} className="relative">
                                                        <div className="flex justify-between text-sm mb-1 relative z-10">
                                                            <span className={`font-medium flex items-center gap-2 ${isCorrect ? 'text-green-400' : 'text-gray-300'}`}>
                                                                {answer}
                                                                {isCorrect && <Check size={12} />}
                                                            </span>
                                                            <span className="text-gray-500">{count} ({percentage}%)</span>
                                                        </div>
                                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${isCorrect ? 'bg-green-500/50' : 'bg-indigo-500/50'}`} 
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            }) : (
                                                <p className="text-gray-500 text-sm italic">No answers yet.</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    // INDIVIDUAL RESPONSES LIST
                    <div className="space-y-4 animate-fade-in">
                        {filteredResponses.map((r, i) => {
                            const { score, total } = calculateScore(selectedForm, r);
                            const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
                            const hasGradableQuestions = total > 0;

                            return (
                                <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-xl">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 pb-4 border-b border-white/5 gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                                                {r.username[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="text-white font-medium block">{r.username}</span>
                                                <span className="text-xs text-gray-500">
                                                    {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'Unknown date'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {hasGradableQuestions && (
                                            <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                                                <Trophy size={18} className={getScoreColor(percentage)} />
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-lg font-bold leading-none ${getScoreColor(percentage)}`}>
                                                        {score}/{total}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Score</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        {selectedForm.questions.map(q => {
                                            const answer = r.answers[q.id];
                                            const isCorrect = q.correctAnswer ? checkAnswer(q, answer) : null;
                                            const answerText = Array.isArray(answer) ? answer.join(', ') : (answer || 'No answer');

                                            return (
                                                <div key={q.id} className="text-sm bg-white/5 p-3 rounded-lg border border-white/5">
                                                    <span className="text-gray-300 font-medium block mb-2">{q.text}</span>
                                                    
                                                    <div className="flex items-start gap-2.5">
                                                        {q.correctAnswer && (
                                                            <div className={`mt-0.5 flex-shrink-0 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                                {isCorrect ? <Check size={16} /> : <X size={16} />}
                                                            </div>
                                                        )}
                                                        <div className="flex-1">
                                                            <p className={`break-words ${q.correctAnswer && !isCorrect ? 'text-red-200 line-through opacity-75' : 'text-white'}`}>
                                                                {answerText}
                                                            </p>
                                                            {q.correctAnswer && !isCorrect && (
                                                                <div className="mt-1.5 text-xs flex items-center gap-1 text-green-400/80 bg-green-400/10 px-2 py-1 rounded w-fit">
                                                                    <Check size={10} />
                                                                    <span>Expected: {q.correctAnswer}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold text-white mb-1">My Forms</h1>
            <p className="text-gray-400 text-sm">Manage and track your forms</p>
        </div>
        <Button onClick={handleCreate} className="w-auto px-6">
            <Plus size={18} /> Create New
        </Button>
      </div>

      {loading && view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4 pr-2 animate-fade-in">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4 pr-2">
            {forms.length === 0 ? (
                <div className="col-span-full text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <FileText size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400 text-lg mb-2">You haven't created any forms yet</p>
                    <Button variant="ghost" onClick={handleCreate} className="text-indigo-400 hover:text-indigo-300 w-auto mx-auto">
                        Get Started
                    </Button>
                </div>
            ) : (
                forms.map(form => (
                    <div key={form.id} className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 rounded-2xl p-5 transition-all duration-300 flex flex-col animate-slide-up">
                        <div className="flex justify-between items-start mb-4">
                            <button
                                onClick={(e) => handleCopyCode(form.code, e)}
                                className="bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 px-2 py-1 rounded text-indigo-300 text-xs font-mono font-medium tracking-wider flex items-center gap-2 transition-all group/btn"
                                title="Copy Code"
                            >
                                {form.code}
                                {copiedCode === form.code ? <Check size={12} /> : <Copy size={12} className="opacity-70 group-hover/btn:opacity-100" />}
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">
                                    {form.created_at ? new Date(form.created_at).toLocaleDateString() : ''}
                                </span>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFormToDelete(form);
                                    }}
                                    className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Delete Form"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        
                        <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{form.title}</h3>
                        <p className="text-gray-400 text-sm line-clamp-2 mb-6 flex-1">{form.description || 'No description'}</p>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 text-gray-400 text-xs">
                                <Users size={14} />
                                <span>View Stats</span>
                            </div>
                            <button 
                                onClick={() => handleViewResponses(form)}
                                className="p-2 rounded-full bg-white/5 hover:bg-indigo-500 hover:text-white text-gray-400 transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {formToDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 rounded-[2.5rem]">
            <div className="bg-[#1a1c2e] border border-white/10 p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center animate-slide-up">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Delete Form?</h3>
                <p className="text-gray-400 mb-6 text-sm">
                    Are you sure you want to delete <strong>"{formToDelete.title}"</strong>? This action cannot be undone and all responses will be lost.
                </p>
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" onClick={() => setFormToDelete(null)} disabled={isDeleting}>Cancel</Button>
                    <Button 
                        onClick={handleDeleteForm} 
                        isLoading={isDeleting}
                        className="bg-red-500 hover:bg-red-600 border-red-500 text-white shadow-red-500/20"
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
