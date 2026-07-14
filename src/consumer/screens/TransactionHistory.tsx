import { useMemo, useState } from 'react';
import { C } from '../theme';
import Icon from '../icons';
import { Card, Amount, Pill } from '../components';
import { transactions, type Txn } from '../data';

export default function TransactionHistory() {
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    let list: Txn[] = transactions;
    if (filter === 'in') list = list.filter((t) => t.amount > 0);
    if (filter === 'out') list = list.filter((t) => t.amount < 0);
    if (query.trim()) list = list.filter((t) => (t.title + t.subtitle).toLowerCase().includes(query.toLowerCase()));
    const byDate = new Map<string, Txn[]>();
    for (const t of list) {
      if (!byDate.has(t.date)) byDate.set(t.date, []);
      byDate.get(t.date)!.push(t);
    }
    return Array.from(byDate.entries());
  }, [filter, query]);

  return (
    <div style={{ paddingBottom: 28 }}>
      {/* Search + filters */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.page, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px' }}>
          <Icon name="search" size={18} color={C.textFaint} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transactions" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, color: C.text }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {([['all', 'All'], ['in', 'Money in'], ['out', 'Money out']] as const).map(([id, label]) => (
            <Pill key={id} active={filter === id} onClick={() => setFilter(id)}>{label}</Pill>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.length === 0 && <div style={{ textAlign: 'center', color: C.textFaint, fontSize: 13, padding: 24 }}>No transactions found.</div>}
        {groups.map(([date, items]) => (
          <div key={date}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textSoft, padding: '0 2px 8px' }}>{date}</div>
            <Card>
              {items.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 11, background: t.amount > 0 ? 'rgba(31,157,87,0.12)' : `rgba(${C.brandRgb},0.08)`, color: t.amount > 0 ? C.good : C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={t.amount > 0 ? 'arrowDown' : 'transfer'} size={19} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: C.text }}>{t.title}</span>
                    <span style={{ display: 'block', fontSize: 12, color: C.textSoft, marginTop: 1 }}>{t.subtitle} · {t.account}</span>
                  </span>
                  <Amount value={t.amount} size={14.5} color={t.amount > 0 ? C.good : C.text} />
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
