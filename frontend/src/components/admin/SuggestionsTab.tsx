'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import {
  type SageSuggestion,
  type SuggestionCategory,
  type SuggestionArea,
  type SuggestionStatus,
  SUGGESTION_CATEGORIES,
  SUGGESTION_AREAS,
  SUGGESTION_STATUSES,
} from '@/types/sage-suggestion';

const CATEGORY_COLORS: Record<SuggestionCategory, string> = {
  bug: 'bg-red-100 text-red-700',
  friction: 'bg-orange-100 text-orange-700',
  feature: 'bg-blue-100 text-blue-700',
  praise: 'bg-green-100 text-green-700',
  question: 'bg-purple-100 text-purple-700',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-gray-50 text-gray-700 border-gray-200',
};

const STATUS_COLORS: Record<SuggestionStatus, string> = {
  new: 'bg-roots-primary/10 text-roots-primary',
  triaged: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  shipped: 'bg-green-100 text-green-700',
  wontfix: 'bg-gray-100 text-gray-700',
};

const STATUS_LABELS: Record<SuggestionStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  in_progress: 'In progress',
  shipped: 'Shipped',
  wontfix: "Won't fix",
};

export function SuggestionsTab() {
  const { address } = useAdminStatus();
  const [suggestions, setSuggestions] = useState<SageSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<SuggestionCategory | 'all'>('all');
  const [filterArea, setFilterArea] = useState<SuggestionArea | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<SuggestionStatus | 'all'>('new');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesEditId, setNotesEditId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/sage-suggestions?adminAddress=${address}&limit=200`,
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      }
      const data = (await res.json()) as { suggestions: SageSuggestion[] };
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const filtered = useMemo(() => {
    return suggestions.filter(s => {
      if (filterCategory !== 'all' && s.category !== filterCategory) return false;
      if (filterArea !== 'all' && s.area !== filterArea) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      return true;
    });
  }, [suggestions, filterCategory, filterArea, filterStatus]);

  const updateStatus = async (id: string, status: SuggestionStatus) => {
    if (!address) return;
    setActionLoading(id);
    try {
      const res = await fetch('/api/sage-suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, adminAddress: address, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { suggestion } = (await res.json()) as { suggestion: SageSuggestion };
      setSuggestions(prev =>
        prev.map(s => (s.id === id ? suggestion : s)),
      );
    } catch (err) {
      alert('Failed to update: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  const saveNotes = async (id: string) => {
    if (!address) return;
    setActionLoading(id);
    try {
      const res = await fetch('/api/sage-suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, adminAddress: address, notes: notesDraft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { suggestion } = (await res.json()) as { suggestion: SageSuggestion };
      setSuggestions(prev => prev.map(s => (s.id === id ? suggestion : s)));
      setNotesEditId(null);
      setNotesDraft('');
    } catch (err) {
      alert('Failed to save notes: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  const counts = useMemo(() => {
    const c = { new: 0, triaged: 0, in_progress: 0, shipped: 0, wontfix: 0 };
    for (const s of suggestions) c[s.status]++;
    return c;
  }, [suggestions]);

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="font-heading text-xl font-bold">Sage Suggestions</h2>
          <p className="text-roots-gray text-sm">
            User feedback captured by Sage during conversations.{' '}
            <span className="text-roots-primary font-medium">{counts.new}</span> new ·{' '}
            {counts.triaged} triaged · {counts.in_progress} in progress · {counts.shipped} shipped ·{' '}
            {counts.wontfix} won&apos;t fix
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSuggestions}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 pb-4 border-b">
        <FilterSelect
          label="Status"
          value={filterStatus}
          onChange={v => setFilterStatus(v as SuggestionStatus | 'all')}
          options={['all', ...SUGGESTION_STATUSES]}
          render={v => (v === 'all' ? 'All' : STATUS_LABELS[v as SuggestionStatus])}
        />
        <FilterSelect
          label="Category"
          value={filterCategory}
          onChange={v => setFilterCategory(v as SuggestionCategory | 'all')}
          options={['all', ...SUGGESTION_CATEGORIES]}
          render={v => (v === 'all' ? 'All' : v)}
        />
        <FilterSelect
          label="Area"
          value={filterArea}
          onChange={v => setFilterArea(v as SuggestionArea | 'all')}
          options={['all', ...SUGGESTION_AREAS]}
          render={v => (v === 'all' ? 'All' : v)}
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-roots-gray">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-roots-gray">
          {suggestions.length === 0
            ? 'No suggestions yet. Sage will capture feedback when users confirm in chat.'
            : 'No suggestions match the current filters.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const isExpanded = expanded === s.id;
            const isEditingNotes = notesEditId === s.id;
            return (
              <div
                key={s.id}
                className="border rounded-lg p-4 bg-white"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[s.category]}`}
                  >
                    {s.category}
                  </span>
                  <span className="text-xs text-roots-gray">{s.area}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs border ${SEVERITY_COLORS[s.severity]}`}
                  >
                    {s.severity}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.status]}`}
                  >
                    {STATUS_LABELS[s.status]}
                  </span>
                  <span className="text-xs text-roots-gray ml-auto">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="font-medium text-sm mb-1">{s.sageSummary}</p>

                {isExpanded ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <div>
                      <div className="text-xs font-medium text-roots-gray mb-1">
                        User said:
                      </div>
                      <div className="bg-gray-50 rounded p-2 whitespace-pre-wrap">
                        {s.userQuote}
                      </div>
                    </div>
                    <div className="text-xs text-roots-gray">
                      User: {s.userId ? <code className="text-[11px]">{s.userId}</code> : 'Anonymous'}
                    </div>
                    {s.notes && !isEditingNotes && (
                      <div>
                        <div className="text-xs font-medium text-roots-gray mb-1">
                          Admin notes:
                        </div>
                        <div className="bg-yellow-50 rounded p-2 whitespace-pre-wrap text-xs">
                          {s.notes}
                        </div>
                      </div>
                    )}
                    {isEditingNotes && (
                      <div>
                        <div className="text-xs font-medium text-roots-gray mb-1">
                          Notes:
                        </div>
                        <textarea
                          value={notesDraft}
                          onChange={e => setNotesDraft(e.target.value)}
                          className="w-full p-2 border rounded text-xs h-20 resize-none"
                          placeholder="Triage notes…"
                        />
                        <div className="flex gap-2 mt-1">
                          <Button
                            size="sm"
                            onClick={() => saveNotes(s.id)}
                            disabled={actionLoading === s.id}
                          >
                            Save notes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setNotesEditId(null);
                              setNotesDraft('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {s.status !== 'triaged' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(s.id, 'triaged')}
                          disabled={actionLoading === s.id}
                        >
                          Mark triaged
                        </Button>
                      )}
                      {s.status !== 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(s.id, 'in_progress')}
                          disabled={actionLoading === s.id}
                        >
                          In progress
                        </Button>
                      )}
                      {s.status !== 'shipped' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(s.id, 'shipped')}
                          disabled={actionLoading === s.id}
                        >
                          Mark shipped
                        </Button>
                      )}
                      {s.status !== 'wontfix' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(s.id, 'wontfix')}
                          disabled={actionLoading === s.id}
                        >
                          Won&apos;t fix
                        </Button>
                      )}
                      {!isEditingNotes && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNotesEditId(s.id);
                            setNotesDraft(s.notes || '');
                          }}
                        >
                          {s.notes ? 'Edit notes' : 'Add note'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpanded(null)}
                      >
                        Collapse
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setExpanded(s.id)}
                    className="text-xs text-roots-primary hover:underline mt-1"
                  >
                    Expand details
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  render,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  render: (v: string) => string;
}) {
  return (
    <label className="text-xs flex items-center gap-2">
      <span className="text-roots-gray">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border rounded px-2 py-1 text-xs"
      >
        {options.map(o => (
          <option key={o} value={o}>
            {render(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
