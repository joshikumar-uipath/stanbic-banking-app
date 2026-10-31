// Profile — who you are, the job you're doing on this phone, and the few
// settings that matter. The work role reshapes Home and your queue.
import { Capacitor } from '@capacitor/core';
import { useMemo } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useBank } from '../../../config/bank';
import { useNav, useWorkData } from '../nav';
import { EMPLOYEE_ROLES, roleInfo } from '../role';
import { NScreen, NSection, NAvatar, NSegment, NBig, Glyph } from '../nkit';
import { useNk, C, haptic } from '../nk';
import { storyOf } from '../story';

export default function Profile() {
  const nav = useNav();
  const nk = useNk();
  const bank = useBank();
  const { theme, toggleTheme } = useTheme();
  const { branch, all } = useWorkData();
  const me = roleInfo(nav.role);
  const mine = nav.role === 'rm' ? branch : all;
  const month = useMemo(() => {
    const now = new Date();
    const inMonth = mine.filter((c) => { const d = new Date(c.createdAt); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
    return { opened: inMonth.filter((c) => !!c.accountNumber).length, need: mine.filter((c) => storyOf(c).lane === 'you').length };
  }, [mine]);
  const signedIn = Boolean(nav.userName && nav.userName !== 'User');
  const name = signedIn ? nav.userName : me.name;

  return (
    <NScreen title="Profile">
      <div className="mw-me-card">
        <NAvatar name={name} size={60} solid />
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span className="mw-me-n">{name}</span>
          <span style={{ fontSize: 14, color: nk.ink2 }}>{signedIn ? `${me.name} · ` : `${me.sub} · `}{bank.name}</span>
          {nav.userEmail && <span className="mono" style={{ fontSize: 12, color: nk.ink3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{nav.userEmail}</span>}
        </span>
      </div>

      <NSection title="Your work" aside="Opened this month · needing you now">
        <div className="mw-pair-nums" style={{ ['--sep' as string]: nk.sep }}>
          <span className="mw-pair-num"><NBig>{month.opened}</NBig><span className="mw-pair-l" style={{ color: C.green }}><Glyph color={C.green} />Opened</span></span>
          <span className="mw-pair-num"><NBig mark={false}>{month.need}</NBig><span className="mw-pair-l" style={{ color: C.red }}><Glyph color={C.red} />Need you</span></span>
        </div>
      </NSection>

      <NSection title="Work role" aside={nav.canSwitchRole ? 'Changes Home and your queue' : 'Set by your administrator'}>
        <div role="radiogroup" aria-label="Work role" className="nk-group" style={{ ['--sep' as string]: nk.sep }}>
          {EMPLOYEE_ROLES.filter((r) => nav.roles.includes(r.id)).map((r) => {
            const on = r.id === nav.role;
            return (
              <button key={r.id} type="button" role="radio" aria-checked={on} className="mw-radio-row tap" disabled={!nav.canSwitchRole && !on}
                onClick={() => { if (on || !nav.canSwitchRole) return; haptic('success'); nav.setRole(r.id); }}
                style={{ borderColor: nk.sep, color: on ? nk.accent : nk.ink }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, fontWeight: on ? 600 : 400 }}>{r.name}</span>
                  <span style={{ fontSize: 13, color: nk.ink2 }}>{r.sub}</span>
                </span>
                {on && <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
            );
          })}
        </div>
      </NSection>

      <NSection title="Preferences">
        <div className="nk-group" style={{ ['--sep' as string]: nk.sep }}>
          <div className="mw-pref" style={{ borderColor: nk.sep }}>
            <span style={{ fontSize: 16 }}>Appearance</span>
            <span style={{ width: 168 }}>
              <NSegment value={theme} onChange={(v) => { if (v !== theme) toggleTheme(); }} options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} />
            </span>
          </div>
        </div>
      </NSection>

      <NSection title="About">
        <div className="nk-group" style={{ ['--sep' as string]: nk.sep }}>
          <div className="mw-pref" style={{ borderColor: nk.sep }}><span style={{ fontSize: 16 }}>Bank</span><span style={{ fontSize: 15, color: nk.ink2 }}>{bank.legalName}</span></div>
          <div className="mw-pref" style={{ borderColor: nk.sep }}><span style={{ fontSize: 16 }}>App</span><span style={{ fontSize: 15, color: nk.ink2 }}>Field app for account opening</span></div>
        </div>
        {nav.onLogout && (
          <button type="button" className="nk-btn tap" onClick={() => { haptic(); nav.onLogout?.(); }}
            style={{ width: '100%', marginTop: 16, background: nk.page, color: C.red, borderColor: nk.sep, fontSize: 16, fontWeight: 500 }}>Sign out</button>
        )}
        {!Capacitor.isNativePlatform() && <button type="button" className="nk-link" style={{ color: nk.ink3, alignSelf: 'center', marginTop: 4 }} onClick={() => { haptic(); nav.toLauncher(); }}>Back to the launcher</button>}
      </NSection>
    </NScreen>
  );
}
