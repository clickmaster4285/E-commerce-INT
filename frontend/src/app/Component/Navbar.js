'use client';

import { Search, Bell, Sun, Moon, Menu } from 'lucide-react';

export default function Navbar({ theme, toggleTheme, onMenuToggle }) {
  return (
    <header
      style={{
        backgroundColor: 'var(--bg-navbar)',
        borderBottom: '1px solid var(--border-navbar)',
        padding: '16px 24px',
      }}
    >
      {/* Top Row: Search + Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        {/* Search Bar */}
        <div
          style={{
            flex: 1,
            maxWidth: '500px',
            position: 'relative',
          }}
        >
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search modules, records..."
            className="input-field"
            style={{
              paddingLeft: '42px',
              height: '42px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-navbar)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-navbar)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button
            aria-label="Notifications"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-navbar)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Bell size={18} />
            <span
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--danger)',
              }}
            />
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginLeft: '8px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-navbar)' }}>
                admin1
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                COMPANY_ADMIN
              </span>
            </div>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              A
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Breadcrumb + Title */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          <span>Dashboard</span>
          <span>›</span>
          <span style={{ color: 'var(--text-navbar)', fontWeight: 500 }}>Overview</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-navbar)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Business Dashboard
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Unified view of finance, inventory, and sales metrics.
        </p>
      </div>
    </header>
  );
}