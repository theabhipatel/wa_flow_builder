import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { X, Send, RotateCcw, Loader2, Bot, User, Clock } from 'lucide-react';

interface Props {
    botId: string;
    flowId: string;
    onClose: () => void;
}

interface IMessage {
    id: string;
    role: 'user' | 'bot' | 'system';
    text: string;
    buttons?: Array<{ id: string; label: string }>;
    timestamp: Date;
}

export default function SimulatorPanel({ botId, flowId, onClose }: Props) {
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isWaitingForDelay, setIsWaitingForDelay] = useState(false);
    const [resumeAt, setResumeAt] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastPollTimeRef = useRef<string | null>(null);
    const pollAttemptsRef = useRef(0);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Re-focus chat input after loading finishes
    useEffect(() => {
        if (!loading) {
            inputRef.current?.focus();
        }
    }, [loading]);

    // Show welcome prompt instead of auto-starting the flow
    useEffect(() => {
        setMessages([{
            id: `system_${Date.now()}`,
            role: 'system',
            text: '💬 Send a message (e.g. "hi") to start the flow.',
            timestamp: new Date(),
        }]);
    }, []);

    // Countdown timer for delay
    useEffect(() => {
        if (!resumeAt) {
            setCountdown('');
            return;
        }

        const updateCountdown = () => {
            const now = Date.now();
            const target = new Date(resumeAt).getTime();
            const diff = Math.max(0, target - now);

            if (diff <= 0) {
                setCountdown('Resuming...');
                return;
            }

            const secs = Math.ceil(diff / 1000);
            if (secs >= 60) {
                const mins = Math.floor(secs / 60);
                const remainSecs = secs % 60;
                setCountdown(`${mins}m ${remainSecs}s`);
            } else {
                setCountdown(`${secs}s`);
            }
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [resumeAt]);

    // Stop polling helper
    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        pollAttemptsRef.current = 0;
        setIsWaitingForDelay(false);
        setResumeAt(null);
    }, []);

    // Polling for delayed messages
    const pollForMessages = useCallback(async () => {
        try {
            pollAttemptsRef.current += 1;

            // Safety: stop polling after 20 attempts (~60s) to prevent infinite polling
            if (pollAttemptsRef.current > 20) {
                stopPolling();
                return;
            }

            const since = lastPollTimeRef.current || new Date(0).toISOString();
            const res = await api.get('/simulator/poll', {
                params: { botId, since },
            });

            if (res.data.success && res.data.data) {
                const { messages: newMsgs, isWaiting, resumeAt: newResumeAt } = res.data.data;

                // Update delay countdown info
                if (isWaiting) {
                    setResumeAt(newResumeAt ? new Date(newResumeAt) : null);
                }

                // If we got new messages, display them and stop polling
                if (newMsgs && newMsgs.length > 0) {
                    const botMessages: IMessage[] = newMsgs.map((r: { type: string; content: string; sentAt: string }, i: number) => ({
                        id: `delayed_${Date.now()}_${i}`,
                        role: 'bot' as const,
                        text: r.content,
                        timestamp: new Date(r.sentAt),
                    }));
                    setMessages((prev) => [...prev, ...botMessages]);

                    // Update the poll time to the latest message time
                    const latestTime = newMsgs[newMsgs.length - 1].sentAt;
                    lastPollTimeRef.current = latestTime;

                    // Messages received! Stop polling.
                    stopPolling();
                    return;
                }

                // No new messages yet — if delay is no longer waiting (cron has cleared resumeAt
                // but may still be executing the flow), keep polling a bit more
                if (!isWaiting) {
                    setCountdown('Resuming...');
                    // Don't stop! The cron may still be running executeFlow.
                    // The max attempts check above will handle the safety timeout.
                }
            }
        } catch (err) {
            console.error('[Simulator] Poll error:', err);
        }
    }, [botId, stopPolling]);

    // Start/stop polling based on delay state
    useEffect(() => {
        if (isWaitingForDelay && !pollIntervalRef.current) {
            // Record the time so we only get new messages
            lastPollTimeRef.current = new Date().toISOString();
            pollAttemptsRef.current = 0;
            pollIntervalRef.current = setInterval(pollForMessages, 1500);
        }

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [isWaitingForDelay, pollForMessages]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };

    }, []);

    const sendMessage = async (text: string, buttonId?: string) => {
        if (text) {
            setMessages((prev) => [...prev, {
                id: `user_${Date.now()}`,
                role: 'user',
                text,
                timestamp: new Date(),
            }]);
        }
        setInput('');
        setLoading(true);

        try {
            const res = await api.post('/simulator/message', {
                botId,
                flowId,
                message: text || undefined,
                buttonId,
            });

            if (res.data.success && res.data.data.responses) {
                const responses = res.data.data.responses as Array<{ type: string; content: string; buttons?: Array<{ id: string; label: string }> }>;

                // If only 1 response, add immediately
                if (responses.length <= 1) {
                    const botMessages: IMessage[] = responses.map((r, i) => ({
                        id: `bot_${Date.now()}_${i}`,
                        role: 'bot' as const,
                        text: r.content,
                        buttons: r.buttons,
                        timestamp: new Date(),
                    }));
                    setMessages((prev) => [...prev, ...botMessages]);
                } else {
                    // Multiple responses (e.g., from loops) — stagger them
                    const STAGGER_DELAY = 400; // ms between each message
                    for (let i = 0; i < responses.length; i++) {
                        const r = responses[i];
                        await new Promise<void>((resolve) => {
                            setTimeout(() => {
                                setMessages((prev) => [...prev, {
                                    id: `bot_${Date.now()}_${i}`,
                                    role: 'bot' as const,
                                    text: r.content,
                                    buttons: r.buttons,
                                    timestamp: new Date(),
                                }]);
                                resolve();
                            }, i === 0 ? 0 : STAGGER_DELAY);
                        });
                    }
                }
            }

            // Check if the session is now paused with a delay (waiting)
            if (res.data.success && res.data.data.session) {
                const sessionData = res.data.data.session;
                if (sessionData.status === 'PAUSED') {
                    // Check if it's a delay pause by polling once to see if resumeAt is set
                    try {
                        const pollRes = await api.get('/simulator/poll', {
                            params: { botId, since: new Date().toISOString() },
                        });
                        if (pollRes.data.success && pollRes.data.data.isWaiting) {
                            setIsWaitingForDelay(true);
                            setResumeAt(pollRes.data.data.resumeAt ? new Date(pollRes.data.data.resumeAt) : null);
                        }
                    } catch {
                        // Polling check failed, not critical
                    }
                }
            }
        } catch (err) {
            setMessages((prev) => [...prev, {
                id: `err_${Date.now()}`,
                role: 'bot',
                text: '⚠️ Error processing message',
                timestamp: new Date(),
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        try {
            // Stop any active polling
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            setIsWaitingForDelay(false);
            setResumeAt(null);

            await api.post('/simulator/reset', { botId });
            setMessages([{
                id: `system_${Date.now()}`,
                role: 'system',
                text: '🔄 Session reset. Send a message to start the flow again.',
                timestamp: new Date(),
            }]);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        sendMessage(input.trim());
    };

    return (
        <div className="w-80 bg-white dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    Simulator
                </h3>
                <div className="flex gap-1">
                    <button onClick={handleReset} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800" title="Reset">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-surface-50 dark:bg-surface-950">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'system' ? (
                            <div className="w-full text-center py-3">
                                <p className="text-xs text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 rounded-full px-4 py-1.5 inline-block">
                                    {msg.text}
                                </p>
                            </div>
                        ) : (
                            <div className={`max-w-[85%] ${msg.role === 'user'
                                ? 'bg-brand-500 text-white rounded-2xl rounded-br-md px-3 py-2'
                                : 'bg-white dark:bg-surface-800 rounded-2xl rounded-bl-md px-3 py-2 shadow-sm border border-surface-200 dark:border-surface-700'
                                }`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                {msg.buttons && msg.buttons.length > 0 && (
                                    <div className="mt-2 space-y-1.5">
                                        {msg.buttons.map((btn) => (
                                            <button
                                                key={btn.id}
                                                onClick={() => sendMessage(btn.label, btn.id)}
                                                disabled={loading}
                                                className="w-full text-left text-xs px-3 py-2 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors border border-brand-200 dark:border-brand-800"
                                            >
                                                {btn.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-surface-800 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-surface-200 dark:border-surface-700">
                            <div className="flex gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                {isWaitingForDelay && (
                    <div className="flex justify-start">
                        <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-cyan-200 dark:border-cyan-800">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-cyan-500 animate-pulse" />
                                <span className="text-xs text-cyan-700 dark:text-cyan-400">
                                    Waiting for delay{countdown ? ` (${countdown})` : '...'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-surface-200 dark:border-surface-700 flex gap-2">
                <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="input-field flex-1"
                    placeholder="Type a message..."
                    disabled={loading}
                    autoFocus
                />
                <button type="submit" disabled={loading || !input.trim()} className="p-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}

