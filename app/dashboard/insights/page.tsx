'use client';

import { useEffect, useMemo, useState } from 'react';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultDateRange() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 1);
  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
}

function buildAssistantWelcome(startDate: string, endDate: string) {
  return `Pronto para analisar o periodo de ${startDate} a ${endDate}. Pergunte sobre vendedores, clientes, produtos, riscos, oportunidades ou peca uma leitura executiva.`;
}

export default function InsightsPage() {
  const defaults = defaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: buildAssistantWelcome(defaults.startDate, defaults.endDate),
    },
  ]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMessages([
      {
        id: `welcome-${startDate}-${endDate}`,
        role: 'assistant',
        content: buildAssistantWelcome(startDate, endDate),
      },
    ]);
    setError('');
    setDraft('');
  }, [startDate, endDate]);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.id !== 'welcome' && !message.id.startsWith('welcome-'))
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages]
  );

  async function handleSend(messageText?: string) {
    const prompt = (messageText ?? draft).trim();
    if (!prompt || isLoading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: prompt,
    };
    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
    };

    const nextHistory = [
      ...history,
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDraft('');
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startDate,
          endDate,
          message: prompt,
          history,
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `Erro ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessage.id ? { ...message, content: accumulated } : message
          )
        );
      }

      if (!accumulated.trim()) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: 'Nao houve resposta da IA para essa pergunta.' }
              : message
          )
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((message) => message.id !== assistantMessage.id));
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">IA Estrategica</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Inteligencia de Negocios</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded border border-cyan-400/15 bg-[#0B2440] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.24)] md:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-cyan-100/80">Data inicial</span>
          <input
            className="w-full rounded border border-cyan-300/20 bg-[#07182D] px-3 py-2 text-cyan-50 outline-none focus:border-emerald-300"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-cyan-100/80">Data final</span>
          <input
            className="w-full rounded border border-cyan-300/20 bg-[#07182D] px-3 py-2 text-cyan-50 outline-none focus:border-emerald-300"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => handleSend('Faca uma leitura executiva do periodo atual.')}
          disabled={isLoading}
          className="self-end rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Analisando...' : 'Gerar leitura inicial'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">
          {error.includes('ANTHROPIC_API_KEY')
            ? 'Configure a variavel ANTHROPIC_API_KEY no arquivo .env para usar esta funcionalidade.'
            : `Falha ao responder: ${error}`}
        </div>
      )}

      <div className="rounded border border-cyan-400/15 bg-[#0B2440] shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
        <div className="border-b border-cyan-400/15 p-5">
          <h2 className="text-lg font-bold text-white">Chat com a IA</h2>
          <p className="mt-1 text-sm text-cyan-100/60">A IA responde usando os dados do periodo selecionado acima.</p>
        </div>

        <div className="space-y-4 p-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[88%] rounded border p-4 text-sm leading-relaxed ${
                message.role === 'assistant'
                  ? 'border-cyan-400/15 bg-[#07182D] text-cyan-50'
                  : 'ml-auto border-emerald-400/20 bg-emerald-400/10 text-emerald-50'
              }`}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/55">
                {message.role === 'assistant' ? 'IA' : 'Voce'}
              </p>
              <pre className="whitespace-pre-wrap font-sans">{message.content || (isLoading && message.role === 'assistant' ? 'Pensando...' : '')}</pre>
            </div>
          ))}
        </div>

        <div className="border-t border-cyan-400/15 p-5">
          <div className="flex flex-wrap gap-2 pb-4">
            {[
              'Quais vendedores merecem atencao imediata?',
              'Quais clientes concentram mais risco?',
              'Quais produtos devo priorizar?',
              'Me de 5 acoes praticas para os proximos 15 dias.',
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSend(suggestion)}
                disabled={isLoading}
                className="rounded-full border border-cyan-400/20 bg-[#07182D] px-3 py-2 text-xs text-cyan-100/75 transition-colors hover:border-emerald-300 hover:text-white disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={3}
              placeholder="Pergunte o que voce quer analisar neste periodo..."
              className="min-h-[92px] flex-1 rounded border border-cyan-300/20 bg-[#07182D] px-3 py-3 text-cyan-50 outline-none focus:border-emerald-300"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isLoading || !draft.trim()}
              className="self-end rounded bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
