
import React, { useState, useCallback, useRef } from 'react';
import { Save, RotateCcw, RotateCw, Plus, Trash2, X, CheckCircle, Type, List, CheckSquare, Loader2, FileUp, Sparkles, Timer, Eye, ArrowLeft } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Question, generateUniqueCode } from '../utils/mockStore';
import { supabase } from '../utils/supabase';
import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

interface FormBuilderProps {
  username: string;
  userId: string;
  onClose: () => void;
}

// Custom hook for Undo/Redo history
function useHistory<T>(initialState: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback((newState: T | ((prevState: T) => T)) => {
    setPast((prev) => [...prev, present]);
    const value = newState instanceof Function ? newState(present) : newState;
    setPresent(value);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture((prev) => [present, ...prev]);
    setPresent(previous);
    setPast(newPast);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast((prev) => [...prev, present]);
    setPresent(next);
    setFuture(newFuture);
  }, [future, present]);

  return { state: present, set, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

export const FormBuilder: React.FC<FormBuilderProps> = ({ username, userId, onClose }) => {
  const { state: formState, set: setFormState, undo, redo, canUndo, canRedo } = useHistory<{
    title: string;
    description: string;
    questions: Question[];
  }>({
    title: '',
    description: '',
    questions: []
  });

  const [timeLimit, setTimeLimit] = useState<number | null>(null); // Minutes
  const [showTimerInput, setShowTimerInput] = useState(false);
  
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      type: 'short_answer',
      options: ['Option 1'],
      correctAnswer: ''
    };
    setFormState(prev => ({ ...prev, questions: [...prev.questions, newQuestion] }));
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setFormState(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, ...updates } : q)
    }));
  };

  const removeQuestion = (id: string) => {
    setFormState(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
  };

  const addOption = (qId: string) => {
    const q = formState.questions.find(q => q.id === qId);
    if (q) {
      updateQuestion(qId, { options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`] });
    }
  };

  // --- PDF Processing & AI ---

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setSaveError("Please upload a valid PDF file.");
      return;
    }

    setIsGenerating(true);
    setSaveError(null);
    setUsedModel(null);

    try {
      // 1. Extract Text
      const text = await extractTextFromPDF(file);
      
      // 2. Call Gemini
      let apiKey: string | undefined;
    
      if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
        apiKey = (import.meta as any).env.VITE_API_KEY;
      } else if (typeof process !== 'undefined' && process.env) {
        apiKey = process.env.API_KEY || process.env.VITE_API_KEY;
      }

      if (!apiKey) throw new Error("API Key missing in environment variables (VITE_API_KEY)");

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        You are an expert teacher. Analyze the following text and generate a structured quiz.
        
        Text Content:
        "${text.substring(0, 20000)}"

        Requirements:
        1. Create a title and short description based on the topic.
        2. Generate 5-10 mixed questions (multiple_choice, short_answer, checkbox).
        3. Return ONLY valid JSON. No markdown formatting.

        JSON Schema:
        {
          "title": "string",
          "description": "string",
          "questions": [
            {
              "text": "Question text",
              "type": "multiple_choice" | "short_answer" | "checkbox",
              "options": ["Option A", "Option B", ...], // Required for multiple_choice/checkbox
              "correctAnswer": "Exact string of the correct answer"
            }
          ]
        }
      `;

      // List of models to try sequentially. This prevents downtime if one model is busy or unavailable in the deployment region.
      const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-latest',
        'gemini-2.5-flash-lite-latest',
        'gemini-3-pro-preview' 
      ];

      let generatedData = null;
      let successModel = '';

      for (const modelName of modelsToTry) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                   responseMimeType: "application/json" 
                }
            });
            
            const jsonStr = response.text;
            if (jsonStr) {
                generatedData = JSON.parse(jsonStr);
                successModel = modelName;
                break; // Stop if successful
            }
        } catch (err: any) {
            console.warn(`Model ${modelName} failed:`, err);
            // Continue to next model
        }
      }

      if (!generatedData) {
          throw new Error("All available AI models failed to generate the form. Please try again later.");
      }
      
      console.log(`Generated form using ${successModel}`);
      setUsedModel(successModel);

      // 3. Populate Form
      setFormState({
        title: generatedData.title || "Generated Quiz",
        description: generatedData.description || "Generated from PDF",
        questions: generatedData.questions.map((q: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          text: q.text,
          type: q.type,
          options: q.options || [],
          correctAnswer: q.correctAnswer
        }))
      });

    } catch (err: any) {
      console.error("PDF Gen Error:", err);
      setSaveError("Failed to generate form from PDF. " + err.message);
    } finally {
      setIsGenerating(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---------------------------

  const handleSave = async () => {
    if (!formState.title) return alert("Please add a title");
    
    setSaving(true);
    setSaveError(null);

    const code = generateUniqueCode();

    try {
      const { error } = await supabase.from('forms').insert({
        code: code,
        title: formState.title,
        description: formState.description,
        questions: formState.questions,
        created_by: userId,
        time_limit: timeLimit
      });

      if (error) throw error;

      setGeneratedCode(code);
    } catch (err: any) {
      console.error("Error saving form:", err);
      setSaveError(err.message || "Failed to save form.");
    } finally {
      setSaving(false);
    }
  };

  if (generatedCode) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-green-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Form Published!</h2>
        <p className="text-gray-400 mb-8">Your form is now live. Share this code with your Viewers.</p>
        
        <div className="bg-white/10 border border-white/20 p-6 rounded-2xl mb-8">
          <span className="block text-sm text-gray-400 mb-2 uppercase tracking-wider">Unique Code</span>
          <span className="text-5xl font-mono font-bold text-indigo-400 tracking-widest select-all">{generatedCode}</span>
        </div>

        <Button onClick={onClose} className="max-w-xs">Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      
      {/* Toolbar */}
      <div className="flex flex-col gap-4 mb-6 shrink-0">
        {/* Top Row: Editing Tools (Hidden during preview) */}
        {!isPreviewing && (
        <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 shadow-lg relative z-20">
            
            {/* Left: History & Import */}
            <div className="flex items-center gap-2">
                <div className="flex bg-black/20 rounded-lg p-1 border border-white/5">
                    <button 
                        onClick={undo} 
                        disabled={!canUndo}
                        className={`p-2 rounded-md transition-colors ${!canUndo ? 'text-gray-600' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
                        title="Undo"
                    >
                        <RotateCcw size={16} />
                    </button>
                    <button 
                        onClick={redo} 
                        disabled={!canRedo}
                        className={`p-2 rounded-md transition-colors ${!canRedo ? 'text-gray-600' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
                        title="Redo"
                    >
                        <RotateCw size={16} />
                    </button>
                </div>

                <div className="h-8 w-px bg-white/10 mx-1"></div>

                <input 
                    type="file" 
                    accept="application/pdf" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                        isGenerating 
                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                    title="Import PDF"
                >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                    <span className="hidden sm:inline">{isGenerating ? 'Processing PDF...' : 'Import PDF'}</span>
                    <span className="sm:hidden">{isGenerating ? '...' : 'PDF'}</span>
                </button>
            </div>

            {/* Right: Settings (Timer) */}
            <div className="flex items-center gap-2">
                 {/* Timer Settings */}
                 <div className="relative">
                    {showTimerInput && (
                        <div className="absolute right-full mr-2 top-0 bg-[#1a1c2e] border border-white/10 p-2 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in w-40">
                            <input
                                type="number"
                                min="1"
                                max="180"
                                placeholder="Mins"
                                value={timeLimit || ''}
                                onChange={(e) => setTimeLimit(e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:border-indigo-500 outline-none"
                            />
                            <span className="text-xs text-gray-500">min</span>
                        </div>
                    )}
                    <button
                        onClick={() => setShowTimerInput(!showTimerInput)}
                        className={`p-2.5 rounded-xl border transition-all ${
                            timeLimit
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                            : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                        title="Set Time Limit"
                    >
                        <Timer size={20} className={timeLimit ? "fill-current" : ""} />
                    </button>
                 </div>
            </div>
        </div>
        )}

        {/* Bottom Row: Main Actions & Preview Toggle */}
        <div className="grid grid-cols-4 gap-3">
             {isPreviewing ? (
                <Button variant="secondary" onClick={() => setIsPreviewing(false)} className="col-span-4 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20">
                   <ArrowLeft size={18} /> Exit Preview
                </Button>
             ) : (
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving} className="col-span-1">
                        Cancel
                    </Button>
                    <Button 
                        variant="secondary" 
                        onClick={() => setIsPreviewing(true)} 
                        disabled={saving} 
                        className="col-span-1"
                        title="Preview Form"
                    >
                        <Eye size={18} /> <span className="hidden sm:inline ml-2">Preview</span>
                    </Button>
                    <Button onClick={handleSave} isLoading={saving} className="col-span-2 shadow-lg shadow-indigo-500/20">
                        <Save size={18} /> 
                        <span className="ml-2">Publish Form</span>
                    </Button>
                </>
             )}
        </div>
      </div>

      {/* Error Message */}
      {saveError && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm animate-fade-in flex items-center gap-2">
          <X size={16} /> {saveError}
        </div>
      )}

      {/* Content Area: Editor OR Preview */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-6 pb-4 scrollbar-thin">
        
        {/* --- PREVIEW MODE RENDER --- */}
        {isPreviewing ? (
            <div className="animate-slide-up px-2">
                 <div className="text-center mb-8">
                    <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-4 border border-indigo-500/30">
                        Viewer Preview
                    </span>
                 </div>
                 
                 <div className="mb-6 relative">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{formState.title || "Untitled Form"}</h1>
                            <p className="text-gray-400">{formState.description || "No description provided."}</p>
                        </div>
                        {timeLimit && (
                             <div className="px-4 py-2 rounded-xl border border-blue-500/50 bg-blue-500/20 text-blue-300 flex items-center gap-2">
                                <Timer size={18} />
                                <span className="font-mono font-bold">{timeLimit}:00</span>
                            </div>
                        )}
                    </div>
                    <div className="h-px bg-white/10 my-6" />
                </div>

                <div className="space-y-8 max-w-3xl mx-auto">
                    {formState.questions.map((q) => (
                        <div key={q.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                            <p className="text-lg font-medium text-white mb-4">{q.text || "Untitled Question"}</p>
                            
                            {q.type === 'short_answer' && (
                                <Input placeholder="Your answer..." disabled />
                            )}

                            {q.type === 'multiple_choice' && (
                                <div className="space-y-2">
                                    {q.options?.map((opt, idx) => (
                                        <label key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 opacity-70 cursor-not-allowed">
                                            <div className="w-5 h-5 rounded-full border border-gray-500" />
                                            <span className="text-gray-300">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {q.type === 'checkbox' && (
                                <div className="space-y-2">
                                     {q.options?.map((opt, idx) => (
                                        <label key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 opacity-70 cursor-not-allowed">
                                            <div className="w-5 h-5 rounded border border-gray-500" />
                                            <span className="text-gray-300">{opt}</span>
                                        </label>
                                     ))}
                                </div>
                            )}
                        </div>
                    ))}
                    <Button disabled className="mt-8 text-lg py-4 opacity-50 cursor-not-allowed">
                        Submit Response (Preview)
                    </Button>
                </div>
            </div>
        ) : (
            /* --- EDITOR MODE RENDER --- */
            <>
                {/* Form Header Card */}
                <div className="p-6 bg-gradient-to-b from-white/10 to-white/5 rounded-3xl border border-white/10 shadow-xl space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-70"></div>
                
                <div className="space-y-4 relative z-10">
                    {/* Status Badge - Moved here to prevent overlap */}
                    {(isGenerating || usedModel) && (
                        <div className="flex justify-end w-full">
                             {isGenerating && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 rounded-full border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider animate-pulse">
                                    <Sparkles size={14} />
                                    <span>AI Working</span>
                                </div>
                            )}
                            {!isGenerating && usedModel && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider animate-fade-in">
                                    <Sparkles size={14} />
                                    <span>Generated by {usedModel}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <input
                        className="w-full bg-transparent text-3xl md:text-4xl font-bold text-white placeholder-white/30 focus:outline-none transition-colors pb-2 border-b border-transparent focus:border-indigo-500/50"
                        placeholder="Untitled Form"
                        value={formState.title}
                        onChange={(e) => setFormState(prev => ({ ...prev, title: e.target.value }))}
                    />
                    <textarea
                        className="w-full bg-transparent text-gray-300 placeholder-white/30 focus:outline-none resize-none text-lg leading-relaxed"
                        placeholder="Add a description for this form..."
                        rows={2}
                        value={formState.description}
                        onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-2">
                        {timeLimit && (
                            <div className="flex items-center gap-1.5 text-blue-300 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                                <Timer size={14} />
                                <span>{timeLimit} min limit</span>
                            </div>
                        )}
                    </div>
                </div>
                </div>

                {/* Questions */}
                {formState.questions.length === 0 && !isGenerating && (
                    <div 
                        className="text-center py-16 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-gray-500 group hover:border-indigo-500/30 hover:bg-white/5 transition-all cursor-pointer"
                        onClick={addQuestion}
                    >
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Plus size={32} className="text-gray-600 group-hover:text-indigo-400" />
                        </div>
                        <p className="font-medium text-lg mb-1">Start adding questions</p>
                        <p className="text-sm opacity-60">Manually add below or import from PDF above</p>
                    </div>
                )}

                <div className="space-y-6">
                    {formState.questions.map((q, idx) => (
                    <div key={q.id} className="p-6 bg-white/5 rounded-2xl border border-white/10 relative group animate-slide-up hover:border-white/20 transition-colors shadow-lg shadow-black/20">
                        <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button onClick={() => removeQuestion(q.id)} className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="flex items-start gap-3 mb-6">
                            <span className="text-indigo-500 font-mono font-bold text-xl mt-3 pt-1">{idx + 1}.</span>
                            
                            <div className="flex-1 flex flex-col gap-4">
                                {/* Question Text - Full Width */}
                                <div className="w-full pr-10">
                                    <Input
                                        value={q.text}
                                        onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                                        placeholder={`Question Text`}
                                        className="text-lg font-medium bg-black/20 border-transparent focus:bg-black/40"
                                    />
                                </div>

                                {/* Type Selector - Below Text */}
                                <div className="w-full sm:w-56">
                                    <div className="relative">
                                        <select
                                            className="w-full appearance-none bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 pl-10 focus:outline-none focus:border-indigo-500 cursor-pointer text-sm font-medium"
                                            value={q.type}
                                            onChange={(e) => updateQuestion(q.id, { type: e.target.value as any })}
                                        >
                                            <option value="short_answer">Short Answer</option>
                                            <option value="multiple_choice">Multiple Choice</option>
                                            <option value="checkbox">Checkboxes</option>
                                        </select>
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            {q.type === 'short_answer' && <Type size={16} />}
                                            {q.type === 'multiple_choice' && <List size={16} />}
                                            {q.type === 'checkbox' && <CheckSquare size={16} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Options Logic */}
                        {(q.type === 'multiple_choice' || q.type === 'checkbox') && (
                        <div className="space-y-3 pl-4 border-l-2 border-white/10 ml-8 mb-6">
                            {q.options?.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-3 group/opt">
                                <div className={`w-4 h-4 rounded-full border border-gray-600 ${q.type === 'checkbox' ? 'rounded-sm' : ''}`} />
                                <input 
                                    className="bg-transparent border-b border-transparent focus:border-indigo-500 text-sm text-gray-300 focus:outline-none flex-1 py-1 hover:border-white/10 transition-colors"
                                    value={opt}
                                    onChange={(e) => {
                                        const newOptions = [...(q.options || [])];
                                        newOptions[optIdx] = e.target.value;
                                        updateQuestion(q.id, { options: newOptions });
                                    }}
                                />
                                <button 
                                    onClick={() => {
                                        const newOptions = q.options?.filter((_, i) => i !== optIdx);
                                        updateQuestion(q.id, { options: newOptions });
                                    }}
                                    className="text-gray-700 opacity-0 group-hover/opt:opacity-100 hover:text-red-400 transition-all"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            ))}
                            <button 
                                onClick={() => addOption(q.id)}
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 mt-2 px-2 py-1 rounded hover:bg-indigo-500/10 w-fit transition-colors"
                            >
                                <Plus size={14} /> Add Option
                            </button>
                        </div>
                        )}

                        {/* Answer Key */}
                        <div className="pt-4 border-t border-white/5 bg-black/10 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-gray-500 uppercase tracking-wide font-bold whitespace-nowrap">Correct Answer:</span>
                                <div className="flex-1">
                                    {q.type === 'short_answer' ? (
                                        <input 
                                            placeholder="Enter correct answer text..." 
                                            value={q.correctAnswer || ''}
                                            onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                                            className="w-full bg-transparent border-b border-white/10 focus:border-green-500 text-sm text-green-400 focus:outline-none py-1 placeholder-gray-600"
                                        />
                                    ) : (
                                        <select 
                                            className="w-full bg-transparent border-b border-white/10 text-green-400 text-sm py-1 focus:outline-none focus:border-green-500 cursor-pointer"
                                            value={q.correctAnswer || ''}
                                            onChange={(e) => updateQuestion(q.id, { correctAnswer: e.target.value })}
                                        >
                                            <option value="" className="bg-gray-900 text-gray-500">Select Correct Option</option>
                                            {q.options?.map(opt => (
                                                <option key={opt} value={opt} className="bg-gray-900 text-white">{opt}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    ))}
                </div>

                {/* Add Question Button */}
                <button 
                    onClick={addQuestion}
                    className="w-full py-4 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center gap-2 text-gray-400 hover:text-white hover:border-indigo-500 hover:bg-indigo-500/10 transition-all duration-200 group mt-8"
                >
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                        <Plus size={16} />
                    </div>
                    <span className="font-medium">Add New Question</span>
                </button>
            </>
        )}
      </div>
    </div>
  );
};
