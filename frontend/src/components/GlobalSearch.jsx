import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Users, BarChart3, UserPlus, X, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../context/AuthContext';

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_META = {
  account:     { label: 'Accounts',      icon: Building2, color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/30',   path: '/accounts' },
  contact:     { label: 'Contacts',      icon: Users,     color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', path: '/contacts' },
  opportunity: { label: 'Opportunities', icon: BarChart3, color: 'text-emerald-500',bg: 'bg-emerald-50 dark:bg-emerald-900/30', path: '/opportunities' },
  lead:        { label: 'Leads',         icon: UserPlus,  color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/30',  path: '/leads' },
};

const GROUP_ORDER = ['account', 'contact', 'opportunity', 'lead'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenResults(data) {
  // Returns [{type, ...result}, ...] preserving group order
  return GROUP_ORDER.flatMap(type =>
    (data[type + 's'] ?? []).map(r => ({ ...r, type }))
  );
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Component ─────────────────────────────────────────────────────────────────

const GlobalSearch = () => {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState(null);   // null = idle, [] = empty
  const [loading, setLoading] = useState(false);
  const [active, setActive]   = useState(0);      // keyboard cursor index into flat list

  const inputRef    = useRef(null);
  const listRef     = useRef(null);
  const navigate    = useNavigate();
  const debouncedQ  = useDebounce(query, 280);

  // ── Open / close ────────────────────────────────────────────────────────────

  const openModal  = useCallback(() => { setOpen(true);  setQuery(''); setResults(null); }, []);
  const closeModal = useCallback(() => { setOpen(false); setQuery(''); setResults(null); setActive(0); }, []);

  // Cmd+K / Ctrl+K and custom button event
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open ? closeModal() : openModal();
      }
      if (e.key === 'Escape' && open) closeModal();
    };
    const onCustom = () => openModal();
    window.addEventListener('keydown', onKey);
    window.addEventListener('crm:open-search', onCustom);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('crm:open-search', onCustom);
    };
  }, [open, openModal, closeModal]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // ── Search ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !debouncedQ.trim()) {
      setResults(null);
      setActive(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.get('/search/', { params: { q: debouncedQ } })
      .then(res => {
        if (!cancelled) {
          setResults(res.data);
          setActive(0);
        }
      })
      .catch(() => { if (!cancelled) setResults({}); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQ, open]);

  // ── Keyboard navigation ──────────────────────────────────────────────────────

  const flat = results ? flattenResults(results) : [];

  const handleKeyDown = (e) => {
    if (!flat.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault();
      navigateTo(flat[active]);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // ── Navigate ─────────────────────────────────────────────────────────────────

  const navigateTo = (result) => {
    closeModal();
    navigate(TYPE_META[result.type].path);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!open) return null;

  const hasResults = flat.length > 0;
  const showEmpty  = results !== null && !loading && !hasResults && query.trim();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-crmCard rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          {loading
            ? <Loader2 size={18} className="text-crmAccent flex-shrink-0 animate-spin" />
            : <Search size={18} className="text-slate-400 flex-shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search accounts, contacts, deals, leads…"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X size={15} />
              </button>
            )}
            <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
              esc
            </kbd>
          </div>
        </div>

        {/* Results list */}
        <div ref={listRef} className="overflow-y-auto max-h-[420px]">

          {/* Idle state */}
          {!query.trim() && (
            <div className="px-4 py-8 text-center">
              <Search size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">Type to search your CRM</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Accounts · Contacts · Deals · Leads</p>
            </div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">No results for <span className="font-medium text-slate-600 dark:text-slate-300">"{query}"</span></p>
            </div>
          )}

          {/* Grouped results */}
          {hasResults && GROUP_ORDER.map(type => {
            const groupKey = type + 's';
            const items = results[groupKey] ?? [];
            if (!items.length) return null;
            const meta = TYPE_META[type];
            const Icon = meta.icon;

            // Flat index offset for keyboard cursor tracking
            const offset = GROUP_ORDER.slice(0, GROUP_ORDER.indexOf(type))
              .reduce((sum, t) => sum + (results[t + 's']?.length ?? 0), 0);

            return (
              <div key={type}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                  <Icon size={12} className={meta.color} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{meta.label}</span>
                </div>

                {/* Items */}
                {items.map((result, idx) => {
                  const flatIdx = offset + idx;
                  const isActive = flatIdx === active;
                  return (
                    <button
                      key={result.id}
                      data-active={isActive}
                      onMouseEnter={() => setActive(flatIdx)}
                      onClick={() => navigateTo(result)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive
                          ? 'bg-slate-50 dark:bg-slate-800/70'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Icon badge */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <Icon size={14} className={meta.color} />
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {result.display_name}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{result.subtitle}</p>
                        )}
                      </div>

                      {/* Arrow — only on active */}
                      <ArrowRight
                        size={14}
                        className={`flex-shrink-0 text-slate-300 dark:text-slate-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                      />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5">↵</kbd>
              open
            </span>
          </div>
          {flat.length > 0 && (
            <span className="text-[10px] text-slate-400">{flat.length} result{flat.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
