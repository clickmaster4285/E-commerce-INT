'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Tag,
  FolderOpen,
  Package,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Zap,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Brands', href: '/admin/brands', icon: Tag },
  { label: 'Categories', href: '/admin/categories', icon: FolderOpen },
  { label: 'Products', href: '/admin/products', icon: Package },
  { label: 'Users', href: '/admin/users', icon: Users },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href) => pathname === href;

  return (
    <aside
      style={{
        width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-sidebar)',
        color: 'var(--text-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        borderRight: '1px solid var(--border-sidebar)',
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '16px 12px' : '16px 20px',
          borderBottom: '1px solid var(--border-sidebar)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minHeight: '64px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '16px',
            flexShrink: 0,
          }}
        >
          C
        </div>
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em' }}>
              ClickMaster
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-sidebar-muted)' }}>
              v1.3
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: '16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          overflowY: 'auto',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '12px' : '12px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                backgroundColor: active ? 'var(--bg-sidebar-active)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                color: active ? 'var(--accent)' : 'var(--text-sidebar)',
                fontWeight: active ? 600 : 400,
                fontSize: '14px',
                transition: 'all 0.15s ease',
                borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Section - Settings, Logout & Collapse Arrow */}
      <div
        style={{
          padding: collapsed ? '12px 8px' : '12px 12px',
          borderTop: '1px solid var(--border-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <Link
          href=""
          title={collapsed ? 'Settings' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: collapsed ? '12px' : '12px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--text-sidebar)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </Link>
        
        <Link
          href="/login"
          title={collapsed ? 'Logout' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: collapsed ? '12px' : '12px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
        
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </Link>

        {!collapsed && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-sidebar-muted)',
              padding: '12px 12px 8px',
              textAlign: 'center',
              borderTop: '1px solid var(--border-sidebar)',
              marginTop: '8px',
            }}
          >
            Powered by <strong>ClickMasters</strong> · v1.3
          </div>
        )}

        {/* Collapse Toggle Button - AT THE END */}
        {/* <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            padding: '10px',
            marginTop: '8px',
            backgroundColor: 'var(--bg-sidebar-hover)',
            border: '1px solid var(--border-sidebar)',
            color: 'var(--text-sidebar)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-active)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)';
          }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span style={{ marginLeft: '8px', fontSize: '13px' }}>Collapse</span>}
        </button> */}
      </div>
    </aside>
  );
}