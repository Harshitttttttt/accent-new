import { useState } from 'react';
import { Search, Plus, Grid3X3, List, Mail, MapPin } from 'lucide-react';
import { EMPLOYEES } from '../data/mock';

export default function EmployeeDirectory({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [deptFilter, setDeptFilter] = useState('All');

  const departments = ['All', ...Array.from(new Set(EMPLOYEES.map(e => e.dept)))];
  const filtered = EMPLOYEES.filter(e =>
    (deptFilter === 'All' || e.dept === deptFilter) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Employee Directory</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} employees · {EMPLOYEES.filter(e => e.status === 'active').length} active</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, width: 180 }}
              placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-base" style={{ width: 'auto', fontSize: 13 }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="topbar-icon-btn" onClick={() => setView('grid')} style={{ background: view === 'grid' ? 'var(--surface-secondary)' : undefined }}>
              <Grid3X3 size={15} />
            </button>
            <button className="topbar-icon-btn" onClick={() => setView('list')} style={{ background: view === 'list' ? 'var(--surface-secondary)' : undefined }}>
              <List size={15} />
            </button>
          </div>
          <button className="btn-primary"><Plus size={14} /> Add Employee</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {view === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(e => (
              <div key={e.id} className="card" style={{ padding: '18px 20px', cursor: 'pointer' }} onClick={() => onNavigate('employee-profile')}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                  <div className="avatar" style={{ background: e.color, width: 48, height: 48, fontSize: 16 }}>{e.avatar}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{e.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.role}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <MapPin size={12} style={{ color: 'var(--text-muted)' }} />{e.location}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <Mail size={12} style={{ color: 'var(--text-muted)' }} />{e.email}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {e.skills.slice(0, 3).map(s => (
                    <span key={s} className="badge badge-steel" style={{ fontSize: 10 }}>{s}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Utilization</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="progress-bar" style={{ width: 50 }}>
                      <div className="progress-bar-fill" style={{ width: `${e.utilization}%`, background: e.utilization >= 85 ? '#DC2626' : 'var(--brand-primary)' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: e.utilization >= 85 ? '#DC2626' : 'var(--text-primary)' }}>{e.utilization}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Employee</th><th>Role</th><th>Department</th><th>Location</th><th>Utilization</th><th>Skills</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('employee-profile')}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ background: e.color, width: 30, height: 30, fontSize: 11 }}>{e.avatar}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{e.role}</td>
                    <td><span className="badge badge-steel" style={{ fontSize: 11 }}>{e.dept}</span></td>
                    <td style={{ fontSize: 13 }}>{e.location}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="progress-bar" style={{ width: 50 }}>
                          <div className="progress-bar-fill" style={{ width: `${e.utilization}%`, background: e.utilization >= 85 ? '#DC2626' : 'var(--brand-primary)' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{e.utilization}%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {e.skills.slice(0, 2).map(s => <span key={s} className="badge badge-steel" style={{ fontSize: 10 }}>{s}</span>)}
                      </div>
                    </td>
                    <td><span className="badge badge-success" style={{ fontSize: 11 }}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
