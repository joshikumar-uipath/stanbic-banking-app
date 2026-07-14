// Centered "card" layout used by the admin login + tenant setup screens.
// Desktop-first — no responsive collapsing for mobile (admin is web-only).
// Subtle UiPath-branded gradient background with a wide form card.

import type { ReactNode } from 'react';
import { defaultConfig } from '../../config';

interface Props {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AdminShell({ children, title, subtitle }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: '#f4f5f7',
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 12% 18%, rgba(255,51,51,0.10) 0%, transparent 65%),
          radial-gradient(ellipse 50% 40% at 88% 82%, rgba(255,51,51,0.10) 0%, transparent 65%),
          radial-gradient(ellipse 40% 30% at 80% 8%, rgba(255,51,51,0.06) 0%, transparent 55%)
        `,
        fontFamily: "'Inter', Arial, sans-serif",
      }}
    >
      <style>{`
        body { margin: 0; }
        html { color-scheme: light; }
        .admin-input {
          transition: border-color 0.2s ease, box-shadow 0.25s ease, background 0.18s ease;
        }
        .admin-input:focus {
          outline: none;
          border-color: ${defaultConfig.branding.accentColor} !important;
          box-shadow: 0 0 0 4px rgba(255,51,51,0.16);
        }
        .admin-input::placeholder { color: rgba(24,33,38,0.34); }
      `}</style>
      <div
        style={{
          width: 'min(520px, 100%)',
          background: '#ffffff',
          borderRadius: 20,
          padding: '40px 36px 32px',
          border: '1px solid rgba(24,33,38,0.06)',
          boxShadow:
            '0 1px 2px rgba(24,33,38,0.04), 0 24px 56px -12px rgba(24,33,38,0.18), 0 12px 24px -8px rgba(24,33,38,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 28,
            paddingBottom: 24,
            borderBottom: '1px solid rgba(24,33,38,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: "'Poppins', Arial, sans-serif",
                fontWeight: 600,
                fontSize: 36,
                color: '#182126',
                letterSpacing: -1.2,
                lineHeight: 1,
              }}
            >
              {defaultConfig.branding.appName}
            </span>
            <span
              style={{
                fontFamily: "'Poppins', Arial, sans-serif",
                fontWeight: 600,
                fontSize: 11,
                color: defaultConfig.branding.accentColor,
                letterSpacing: 1.2,
                textTransform: 'uppercase' as const,
                background: `${defaultConfig.branding.accentColor}14`,
                border: `1px solid ${defaultConfig.branding.accentColor}40`,
                padding: '3px 9px',
                borderRadius: 999,
              }}
            >
              ADMIN
            </span>
          </div>
          {title && (
            <h1
              style={{
                fontFamily: "'Poppins', Arial, sans-serif",
                fontSize: 22,
                fontWeight: 600,
                color: '#182126',
                margin: '20px 0 0',
                letterSpacing: -0.4,
                textAlign: 'center',
              }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              style={{
                fontSize: 13,
                color: 'rgba(24,33,38,0.62)',
                margin: '6px 0 0',
                textAlign: 'center',
                lineHeight: 1.55,
                maxWidth: 380,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Shared field/button styles ──────────────────────────────────────────

export const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(24,33,38,0.55)',
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
  marginBottom: 6,
  display: 'block',
};

export const fieldInput: React.CSSProperties = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: 14,
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  background: '#ffffff',
  border: '1.5px solid rgba(24,33,38,0.10)',
  color: '#182126',
  outline: 'none',
  boxSizing: 'border-box',
};

export const primaryButton: React.CSSProperties = {
  fontFamily: "'Poppins', Arial, sans-serif",
  fontSize: 15,
  fontWeight: 600,
  padding: '13px 18px',
  borderRadius: 12,
  background: defaultConfig.branding.primaryColor,
  color: '#ffffff',
  border: 'none',
  boxShadow: `0 6px 20px -6px ${defaultConfig.branding.primaryColor}80, 0 2px 4px rgba(24,33,38,0.08)`,
  cursor: 'pointer',
  transition: 'transform 0.12s ease, box-shadow 0.18s ease, opacity 0.18s ease',
  letterSpacing: -0.2,
};

export const secondaryButton: React.CSSProperties = {
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: 14,
  fontWeight: 500,
  padding: '12px 18px',
  borderRadius: 12,
  background: 'rgba(24,33,38,0.06)',
  color: '#182126',
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.18s ease',
};

export const errorBanner: React.CSSProperties = {
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.28)',
  color: '#b91c1c',
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 13,
  textAlign: 'center' as const,
  lineHeight: 1.5,
};
