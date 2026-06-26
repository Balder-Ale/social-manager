'use client';

import { useEffect, useState } from 'react';

type Tenant = {
  id: string;
  name: string;
};

export default function TenantSwitcher() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [current, setCurrent] = useState<string>('');

  useEffect(() => {
    // Load saved tenant from localStorage
    const saved = localStorage.getItem('social-manager-tenant-id');
    if (saved) setCurrent(saved);

    // Fetch tenants from API
    fetch('/api/tenants')
      .then((r) => r.json())
      .then((data: Tenant[]) => {
        setTenants(data);
        if (!saved && data.length > 0) {
          setCurrent(data[0].id);
          localStorage.setItem('social-manager-tenant-id', data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setCurrent(id);
    localStorage.setItem('social-manager-tenant-id', id);
    window.location.reload();
  };

  if (tenants.length <= 1) return null;

  return (
    <select
      value={current}
      onChange={handleChange}
      style={{
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid #d1d5db',
        fontSize: 14,
        background: '#fff',
        color: '#111',
      }}
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}