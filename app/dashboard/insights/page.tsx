'use client';

import { useState } from 'react';

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

export default function InsightsPage() {
  const defaults = defaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setIsLoading(true);
    setContent('');
    setError('');

    try {
      const res = await fetch(`/api/insights?startDate=${startDate}&endDate=${endDate}`, { credentials: 'include' });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `Erro ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setContent((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
          IA Estratégica
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">Inteligência de Negócios</h1>
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
          onClick={handleGenerate}
          disabled={isLoading}
          className="self-end rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Analisando...' : content ? 'Regenerar Análise' : 'Gerar Análise'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">
          {error.includes('ANTHROPIC_API_KEY')
            ? 'Configure a variável ANTHROPIC_API_KEY no arquivo .env para usar esta funcionalidade.'
            : `Falha ao gerar análise: ${error}`}
        </div>
      )}

      {isLoading && !content && (
        <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-6 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
          <div className="flex items-center gap-3 text-cyan-100/60">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span>Analisando dados e gerando insights estratégicos...</span>
          </div>
        </div>
      )}

      {content && (
        <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-6 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
          {isLoading && (
            <div className="mb-4 flex items-center gap-2 text-sm text-emerald-300">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <span>Gerando análise...</span>
            </div>
          )}
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-cyan-50">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
