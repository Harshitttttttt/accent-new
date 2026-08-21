import { useState } from 'react';
import { Search, Plus, ChevronDown, LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import { PROJECTS, EMPLOYEES } from '../data/mock';

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return `${n}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-cyan',
  review: 'badge-warning',
  'on-hold': 'badge-neutral',
  completed: 'badge-success',
};

const PHASES = ['All', 'Concept', 'Basic Engineering', 'FEED', 'Detailed Design', 'Completed'];
const STATUSES = ['All', 'active', 'review', 'on-hold', 'completed'];

export default function Projects({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [phaseFilter, setPhaseFilter] = useState('All');
  const [view, setView] = useState<'table' | 'grid'>('table');

  const filtered = PROJECTS.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchPhase = phaseFilter === 'All' || p.phase === phaseFilter;
    return matchSearch && matchStatus && matchPhase;
  });

  function getTeamMembers(ids: string[]) {
    return ids.map(id => EMPLOYEES.find(e => e.id === id)).filter(Boolean);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Projects</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} projects · AED {fmt(PROJECTS.reduce((s, p) => s + p.budget, 0))} total budget</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-secondary" style={{ gap: 6 }}>
            <SlidersHorizontal size={14} /> Saved Views <ChevronDown size={13} />
          </button>
          <button className="btn-primary">
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', flex: '0 0 260px' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input className="input-base" style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 13 }}
            placeholder="Search projects or clients..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`btn-ghost`} style={{ fontSize: 12.5, padding: '5px 12px', borderRadius: 999, background: statusFilter === s ? '#F3E8F5' : undefined, color: statusFilter === s ? 'var(--brand-primary)' : undefined, fontWeight: statusFilter === s ? 600 : 500 }}>
              {s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>

        <select className="input-base" style={{ width: 'auto', fontSize: 13 }} value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}>
          {PHASES.map(p => <option key={p}>{p}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button className={`topbar-icon-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}
            style={{ background: view === 'table' ? 'var(--surface-secondary)' : undefined }}>
            <List size={15} />
          </button>
          <button className={`topbar-icon-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}
            style={{ background: view === 'grid' ? 'var(--surface-secondary)' : undefined }}>
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        {view === 'table' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Phase</th>
                  <th>Status</th>
                  <th>Budget</th>
                  <th>Progress</th>
                  <th>Manager</th>
                  <th>Team</th>
                  <th>End Date</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const team = getTeamMembers(p.team);
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate('project-detail')}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.id} · {p.discipline}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{p.client}</td>
                      <td>
                        <span className="badge badge-steel" style={{ fontSize: 11 }}>{p.phase}</span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[p.status] || 'badge-neutral'}`} style={{ fontSize: 11 }}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1).replace('-', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>AED {fmt(p.budget)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(p.spent)} spent</div>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}>
                            <div className="progress-bar-fill" style={{ width: `${p.progress}%`, background: p.progress === 100 ? '#16A34A' : p.progress > 60 ? 'var(--brand-primary)' : '#06B6D4' }} />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 30 }}>{p.progress}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{p.manager}</td>
                      <td>
                        <div style={{ display: 'flex', gap: -4 }}>
                          {team.slice(0, 3).map((member, i) => member && (
                            <div key={member.id} className="avatar" title={member.name}
                              style={{ background: member.color, width: 26, height: 26, fontSize: 10, marginLeft: i > 0 ? -6 : 0, border: '2px solid white', zIndex: 3 - i }}>
                              {member.avatar}
                            </div>
                          ))}
                          {p.team.length > 3 && (
                            <div className="avatar" style={{ background: 'var(--border)', color: 'var(--text-muted)', width: 26, height: 26, fontSize: 10, marginLeft: -6, border: '2px solid white' }}>
                              +{p.team.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.endDate}</td>
                      <td>
                        <span className={`badge ${p.priority === 'high' ? 'badge-danger' : p.priority === 'medium' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: 11 }}>
                          {p.priority}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filtered.map(p => {
              const team = getTeamMembers(p.team);
              return (
                <div key={p.id} className="card" style={{ padding: '18px 20px', cursor: 'pointer' }} onClick={() => onNavigate('project-detail')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.client}</div>
                    </div>
                    <span className={`badge ${STATUS_COLORS[p.status] || 'badge-neutral'}`} style={{ fontSize: 11 }}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Progress</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Budget</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>AED {fmt(p.budget)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phase</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.phase}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex' }}>
                      {team.slice(0, 4).map((member, i) => member && (
                        <div key={member.id} className="avatar" title={member.name}
                          style={{ background: member.color, width: 26, height: 26, fontSize: 10, marginLeft: i > 0 ? -6 : 0, border: '2px solid white' }}>
                          {member.avatar}
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Due {p.endDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
