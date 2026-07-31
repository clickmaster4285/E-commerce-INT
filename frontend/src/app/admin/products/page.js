'use client';

import Link from 'next/link';

const modules = [
  {
    title: 'Brands',
    description: 'View and manage all your brands.',
    href: '/admin/brands',
    icon: '🏷️',
    stat: '24 brands',
  },
  {
    title: 'Categories',
    description: 'Organize your products by category.',
    href: '/admin/categories',
    icon: '📁',
    stat: '12 categories',
  },
  {
    title: 'Products',
    description: 'Check your inventory and prices.',
    href: '/admin/products',
    icon: '',
    stat: '156 products',
  },
];

export default function DashboardPage() {
  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
          Welcome back 
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Here's what's happening with your store today.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {[
          { label: 'Total Products', value: '156' },
          { label: 'Total Brands', value: '24' },
          { label: 'Total Categories', value: '12' },
          { label: 'Revenue', value: '$12,450' },
        ].map((stat) => (
          <div key={stat.label} className="card" style={{ padding: '20px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {stat.label}
            </p>
            <p style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
        Quick Access
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="card"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '28px' }}>{mod.icon}</span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {mod.stat}
              </span>
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                {mod.title}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{mod.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}