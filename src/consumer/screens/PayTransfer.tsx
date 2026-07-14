import { useMemo, useState } from 'react';
import { C, SHADOW, R } from '../theme';
import Icon from '../icons';
import { useNav } from '../nav';
import { Card, SegTabs, ScreenTitle, Avatar } from '../components';
import { payActions, recipients, type Recipient } from '../data';

export default function PayTransferScreen() {
  const nav = useNav();
  const [filter, setFilter] = useState<'recent' | 'all' | 'fav'>('recent');
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    let r: Recipient[] = recipients;
    if (filter === 'fav') r = r.filter((x) => x.fav);
    if (query.trim()) r = r.filter((x) => (x.name + x.detail).toLowerCase().includes(query.toLowerCase()));
    return r;
  }, [filter, query]);

  const openAction = (id: string, label: string) => {
    if (id === 'scan') return nav.push({ name: 'scan', title: 'Scan & Pay' });
    nav.push({ name: 'transfer', title: label, params: { action: id, label } });
  };

  return (
    <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ScreenTitle>Pay &amp; Transfer</ScreenTitle>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.card, boxShadow: SHADOW.sm, borderRadius: R.pill, padding: '12px 16px' }}>
        <Icon name="search" size={18} color={C.textFaint} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for a recipient" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, color: C.text }} />
      </div>

      {/* Action grid */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '18px 8px', rowGap: 18 }}>
          {payActions.map((a) => (
            <button key={a.id} type="button" onClick={() => openAction(a.id, a.label)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 50, height: 50, borderRadius: 16, background: `rgba(${C.brandRgb},0.10)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icon} size={23} strokeWidth={1.9} />
              </span>
              <span style={{ fontSize: 11.5, color: C.text, textAlign: 'center', lineHeight: 1.2, fontWeight: 500 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Recipients */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <SegTabs tabs={[{ id: 'recent', label: 'Recent' }, { id: 'all', label: 'All' }, { id: 'fav', label: 'Favourites' }]} active={filter} onChange={setFilter} />
        </div>
        <Card>
          <button type="button" onClick={() => nav.push({ name: 'add-recipient', title: 'Add Recipient' })} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px', textAlign: 'left' }}>
            <span style={{ width: 42, height: 42, borderRadius: 999, border: `1.5px dashed rgba(${C.brandRgb},0.45)`, color: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={20} /></span>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.brand }}>Add a new recipient</span>
          </button>
          {list.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: C.textFaint, fontSize: 13, borderTop: `1px solid ${C.hairline}` }}>No recipients found.</div>}
          {list.map((r) => (
            <button key={r.id} type="button" onClick={() => nav.push({ name: 'transfer', title: r.name, params: { recipient: r.id, label: 'Send Money' } })} style={{ width: '100%', background: 'transparent', border: 'none', borderTop: `1px solid ${C.hairline}`, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 18px' }}>
              <Avatar name={r.name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{r.name}</span>
                  {r.fav && <Icon name="star" size={13} color={C.brand} />}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: C.textSoft, marginTop: 1 }}>{r.detail}</span>
              </span>
              <Icon name="chevron" size={17} color={C.textFaint} />
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
}

