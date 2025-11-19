
import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, CheckCircle, AlertCircle, Timer, Clock } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Form } from '../utils/mockStore';
import { supabase } from '../utils/supabase';
import { LoadingOverlay } from './ui/Loading';

interface ViewerDashboardProps {
  username: string;
}

export const ViewerDashboard: React.FC<ViewerDashboardProps> = ({ username }) => {
  const [code, setCode] = useState('');
  const [activeForm, setActiveForm] = useState<Form | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // seconds
  const answersRef = useRef(answers); // Ref to access latest answers in closure

  // Keep ref updated
  useEffect(() => {
      answersRef.current = answers;
  }, [answers]);

  // Timer Logic
  useEffect(() => {
    if (!activeForm || !activeForm.time_limit || submitted) {
        setTimeLeft(null);
        return;
    }

    // Init timer
    setTimeLeft(activeForm.time_limit * 60);

    const timer = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev === null) return null;
            if (prev <= 1) {
                clearInterval(timer);
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeForm, submitted]);

  // Watch for time expiration
  useEffect(() => {
      if (timeLeft === 0 && activeForm && !submitted && !submitting) {
          handleAutoSubmit();
      }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    // Minimum loading time for better UX feel
    const minLoad = new Promise(resolve => setTimeout(resolve, 600));
    
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      await minLoad; // Wait for min loading time

      if (error) throw error;
      if (!data) throw new Error("Form not found");

      setActiveForm(data);
      setAnswers({});
    } catch (err: any) {
      setError("Form not found. Please check the code.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSubmit = async () => {
      // Use ref for answers to ensure we submit what's currently typed
      if (submitting || submitted) return;
      await submitForm(answersRef.current, true);
  };

  const handleSubmit = async () => {
      await submitForm(answers);
  };

  const submitForm = async (submissionAnswers: Record<string, any>, isAuto = false) => {
    if (!activeForm) return;
    setSubmitting(true);
    
    try {
      // Minimum loading time if manual
      if (!isAuto) await new Promise(resolve => setTimeout(resolve, 1000));

      const { error } = await supabase.from('responses').insert({
        form_code: activeForm.code,
        username: username,
        answers: submissionAnswers,
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting response:", err);
      alert("Failed to submit response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12 animate-slide-up">
        <div className="w-24 h-24 bg-gradient-to-tr from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30 animate-[bounce_1s_ease-in-out]">
          <CheckCircle size={48} className="text-white" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-4">Thank You!</h2>
        <p className="text-gray-300 text-lg mb-8">Your response has been recorded successfully.</p>
        <Button 
            onClick={() => {
                setSubmitted(false);
                setActiveForm(null);
                setCode('');
                setTimeLeft(null);
            }}
            className="max-w-xs mx-auto"
        >
            Take Another Form
        </Button>
      </div>
    );
  }

  if (activeForm) {
    return (
      <div className="w-full max-w-3xl mx-auto animate-slide-up pb-8 h-full overflow-y-auto pr-2 relative">
        {submitting && <LoadingOverlay message={timeLeft === 0 ? "Time's up! Submitting..." : "Submitting Response..."} />}

        <div className="mb-6 relative">
            <button onClick={() => setActiveForm(null)} className="text-gray-400 hover:text-white text-sm mb-4">
                &larr; Back to Code
            </button>
            
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{activeForm.title}</h1>
                    <p className="text-gray-400">{activeForm.description}</p>
                </div>
                
                {/* Timer Display */}
                {timeLeft !== null && (
                    <div className={`sticky top-0 z-20 px-4 py-2 rounded-xl border backdrop-blur-md shadow-lg flex items-center gap-2 transition-colors duration-300 ${
                        timeLeft < 60 
                        ? 'bg-red-500/20 border-red-500 text-red-300 animate-pulse' 
                        : 'bg-blue-500/20 border-blue-500 text-blue-300'
                    }`}>
                        <Timer size={18} className={timeLeft < 60 ? "animate-bounce" : ""} />
                        <span className="font-mono text-xl font-bold">{formatTime(timeLeft)}</span>
                    </div>
                )}
            </div>
            
            <div className="h-px bg-white/10 my-6" />
        </div>

        <div className="space-y-8">
            {activeForm.questions.map((q) => (
                <div key={q.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl transition-colors hover:border-indigo-500/30">
                    <p className="text-lg font-medium text-white mb-4">{q.text}</p>
                    
                    {q.type === 'short_answer' && (
                        <Input 
                            placeholder="Your answer..."
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                        />
                    )}

                    {q.type === 'multiple_choice' && (
                        <div className="space-y-2">
                            {q.options?.map(opt => (
                                <label key={opt} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:bg-white/5 cursor-pointer transition-colors group">
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${answers[q.id] === opt ? 'border-indigo-500 bg-indigo-500 scale-110' : 'border-gray-500 group-hover:border-gray-400'}`}>
                                        {answers[q.id] === opt && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                    <input 
                                        type="radio" 
                                        name={q.id} 
                                        className="hidden"
                                        checked={answers[q.id] === opt}
                                        onChange={() => setAnswers({...answers, [q.id]: opt})}
                                    />
                                    <span className={`transition-colors ${answers[q.id] === opt ? 'text-white font-medium' : 'text-gray-300'}`}>{opt}</span>
                                </label>
                            ))}
                        </div>
                    )}

                    {q.type === 'checkbox' && (
                        <div className="space-y-2">
                             {q.options?.map(opt => {
                                 const current = (answers[q.id] as string[]) || [];
                                 const isSelected = current.includes(opt);
                                 return (
                                    <label key={opt} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:bg-white/5 cursor-pointer transition-colors group">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500 scale-110' : 'border-gray-500 group-hover:border-gray-400'}`}>
                                            {isSelected && <CheckCircle size={12} className="text-white" />}
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            className="hidden"
                                            checked={isSelected}
                                            onChange={() => {
                                                if (isSelected) {
                                                    setAnswers({...answers, [q.id]: current.filter(v => v !== opt)});
                                                } else {
                                                    setAnswers({...answers, [q.id]: [...current, opt]});
                                                }
                                            }}
                                        />
                                        <span className={`transition-colors ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>{opt}</span>
                                    </label>
                                 );
                             })}
                        </div>
                    )}
                </div>
            ))}

            <Button onClick={handleSubmit} className="mt-8 text-lg py-4" isLoading={submitting}>
                Submit Response
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-slide-up">
      <div className="text-center mb-10">
         <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-4">
             Enter Form Code
         </h1>
         <p className="text-gray-400 text-lg">
             Please enter the 6-digit unique code provided by your Moderator.
         </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-md space-y-4">
         <div className="relative">
            <input 
                type="text"
                maxLength={6}
                placeholder="XXXXXX"
                className="w-full bg-black/30 border-2 border-white/20 rounded-2xl py-6 text-center text-4xl tracking-[0.5em] font-mono text-white focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all uppercase placeholder-gray-700"
                value={code}
                onChange={(e) => {
                    setError(null);
                    setCode(e.target.value.toUpperCase());
                }}
            />
            {code.length === 6 && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                </div>
            )}
         </div>

         {error && (
             <div className="flex items-center justify-center gap-2 text-red-400 text-sm animate-fade-in p-2 bg-red-500/10 rounded-lg border border-red-500/10">
                 <AlertCircle size={16} />
                 {error}
             </div>
         )}

         <Button type="submit" className="h-14 text-lg" disabled={code.length !== 6} isLoading={loading}>
             Start Form <ArrowRight size={20} />
         </Button>
      </form>
    </div>
  );
};
