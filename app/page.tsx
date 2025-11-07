"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Expense = {
  id: string;
  date: string; // yyyy-mm-dd
  amount: number;
  category: string;
  note: string;
};

type Filters = {
  q: string;
  category: string;
  from: string;
  to: string;
};

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Housing",
  "Utilities",
  "Health",
  "Entertainment",
  "Shopping",
  "Travel",
  "Other"
];

const STORAGE_KEY = "expenses-v1";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

export default function Page() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<Pick<Expense, "date" | "amount" | "category" | "note">>((){
    const today = new Date().toISOString().slice(0, 10);
    return { date: today, amount: 0, category: "", note: "" };
  });
  const [filters, setFilters] = useState<Filters>({ q: "", category: "", from: "", to: "" });
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Expense[];
        if (Array.isArray(parsed)) setExpenses(parsed);
      }
    } catch {}
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    } catch {}
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return expenses.filter((e) => {
      if (filters.category && e.category !== filters.category) return false;
      if (filters.from && e.date < filters.from) return false;
      if (filters.to && e.date > filters.to) return false;
      if (q && !(e.note.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [expenses, filters]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, e) => s + e.amount, 0);
    const byCategory = new Map<string, number>();
    for (const e of filtered) byCategory.set(e.category || "Uncategorized", (byCategory.get(e.category || "Uncategorized") || 0) + e.amount);
    const top = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, byCategory: top };
  }, [filtered]);

  function addExpense() {
    if (!form.amount || isNaN(form.amount)) return;
    const item: Expense = {
      id: crypto.randomUUID(),
      date: form.date || new Date().toISOString().slice(0, 10),
      amount: Math.round(form.amount * 100) / 100,
      category: form.category || "Other",
      note: form.note || ""
    };
    setExpenses((prev) => [item, ...prev]);
    setForm((prev) => ({ ...prev, amount: 0, note: "" }));
  }

  function deleteExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function clearAll() {
    if (confirm("Delete all expenses?")) {
      setExpenses([]);
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(expenses, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        if (Array.isArray(json)) {
          const cleaned: Expense[] = json
            .map((x) => ({
              id: typeof x.id === "string" ? x.id : crypto.randomUUID(),
              date: typeof x.date === "string" ? x.date : new Date().toISOString().slice(0, 10),
              amount: Number(x.amount) || 0,
              category: typeof x.category === "string" ? x.category : "Other",
              note: typeof x.note === "string" ? x.note : ""
            }))
            .filter((e) => e.amount > 0);
          setExpenses(cleaned);
        }
      } catch {}
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  const categories = useMemo(() => {
    const userCats = Array.from(new Set(expenses.map((e) => e.category).filter(Boolean)));
    return Array.from(new Set([...
      DEFAULT_CATEGORIES,
      ...userCats
    ])).sort();
  }, [expenses]);

  return (
    <div className="container">
      <div className="header">
        <div className="h1">Expense Tracker</div>
        <div className="flex">
          <span className="badge">
            <span style={{ width: 8, height: 8, background: "var(--accent)", borderRadius: 999 }} />
            {expenses.length} records
          </span>
          <button className="button" onClick={exportData}>Export</button>
          <input ref={fileRef} className="file" type="file" accept="application/json" onChange={(e) => onImportFile(e.target.files)} />
          <button className="button destructive" onClick={clearAll}>Clear</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3 className="section-title">Add expense</h3>
          <div className="row" style={{ marginBottom: 8 }}>
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount"
              value={form.amount || ""}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
            />
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <select
              className="select"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              className="input"
              type="text"
              placeholder="Note (optional)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") addExpense(); }}
            />
          </div>
          <div className="row">
            <button className="button primary" onClick={addExpense}>Add</button>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Filter</h3>
          <div className="row" style={{ marginBottom: 8 }}>
            <input className="input" placeholder="Search note/category" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
            <select className="select" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="row">
            <input className="input" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            <input className="input" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="summary" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="small">Total</div>
          <div className="kpi">{formatCurrency(totals.total)}</div>
        </div>
        <div className="card">
          <div className="small">This month</div>
          <div className="kpi">{formatCurrency(
            filtered.filter(e => e.date.slice(0,7) === new Date().toISOString().slice(0,7)).reduce((s,e)=>s+e.amount,0)
          )}</div>
        </div>
        <div className="card">
          <div className="small">Top categories</div>
          <div>
            {totals.byCategory.length === 0 ? <span className="small">No data</span> : totals.byCategory.map(([c, v]) => (
              <div key={c} className="row" style={{ alignItems: "center" }}>
                <div style={{ flex: 1 }}>{c}</div>
                <div className="small" style={{ textAlign: "right" }}>{formatCurrency(v)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th className="th">Date</th>
              <th className="th">Category</th>
              <th className="th">Note</th>
              <th className="th" style={{ textAlign: "right" }}>Amount</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td className="td" colSpan={5}>
                <span className="small">No expenses yet.</span>
              </td></tr>
            ) : filtered.map((e) => (
              <tr key={e.id} className="tr">
                <td className="td">{e.date}</td>
                <td className="td">{e.category || "?"}</td>
                <td className="td">{e.note || ""}</td>
                <td className="td amount" style={{ textAlign: "right" }}>{formatCurrency(e.amount)}</td>
                <td className="td">
                  <div className="actions">
                    <button className="button ghost" onClick={() => deleteExpense(e.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="footer">Data is stored locally in your browser via localStorage.</div>
    </div>
  );
}
