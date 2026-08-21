import { useState } from 'react';
import { ChevronLeft, Mail, Phone, MapPin, Calendar, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { EMPLOYEES, PROJECTS } from '../data/mock';

const employee = EMPLOYEES[0];

const TIMESHEET_DATA = [
  { week: 'W30', regular: 40, overtime: 4 },
  { week: 'W31', regular: 40, overtime: 8 },
  { week: 'W32', regular: 38, overtime: 2 },
  { week: 'W33', regular: 40, overtime: 0 },
  { week: 'W34', regular: 40, overtime: 6 },
];

const PAYROLL = [
  { month: 'Apr 2026', basic: 18000, allowances: 5000, deductions: 500, net: 22500 },
  { month: 'May 2026', basic: 18000, allowances: 5000, deductions: 500, net: 22500 },
  { month: 'Jun 2026', basic: 18000, allowances: 6500, deductions: 500, net: 24000 },
  { month: 'Jul 2026', basic: 18000, allowances: 5000, deductions: 500, net: 22500 },
];

const ATTENDANCE = [
  { month: 'Apr', present: 21, absent: 0, leave: 1 },
  { month: 'May', present: 20, absent: 1, leave: 1 },
  { month: 'Jun', present: 22, absent: 0, leave: 0 },
  { month: 'Jul', present: 20, absent: 0, leave: 2 },
];

const TABS = ['Personal', 'Projects', 'Attendance', 'Payroll', 'Timesheets', 'Performance'];

const customTooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 };

export default function EmployeeProfile({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [activeTab, setActiveTab] = useState('Personal');

  const assignedProjects = PROJECTS.filter(p => p.team.includes(employee.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <button className="btn-ghost" style={{ marginBottom: 10, fontSize: 12.5 }} onClick={() => onNavigate('employee-master')}>
          <ChevronLeft size={14} /> Back to Employees
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div className="avatar" style={{ background: employee.color, width: 60, height: 60, fontSize: 20 }}>{employee.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{employee.name}</h2>
              <span className="badge badge-success" style={{ fontSize: 11 }}>{employee.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{employee.role}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{employee.location}</span>
              <span>{employee.dept} Department</span>
              <span>{employee.id}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />Joined {employee.joined}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary"><Mail size={14} /> Email</button>
            <button className="btn-secondary"><Phone size={14} /> Call</button>
            <button className="btn-primary">Edit Profile</button>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
          {[
            { label: 'Utilization', value: `${employee.utilization}%`, color: employee.utilization >= 85 ? '#DC2626' : 'var(--brand-primary)' },
            { label: 'Active Projects', value: `${assignedProjects.length}`, color: 'var(--text-primary)' },
            { label: 'Skills', value: `${employee.skills.length}`, color: 'var(--text-primary)' },
            { label: 'Tenure', value: '5+ years', color: 'var(--text-primary)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface-secondary)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 28px', flexShrink: 0 }}>
        <div className="tab-nav" style={{ borderBottom: 'none' }}>
          {TABS.map(tab => (
            <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {activeTab === 'Personal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Contact Information</div>
              {[
                { icon: <Mail size={14} />, label: 'Email', value: employee.email },
                { icon: <Phone size={14} />, label: 'Phone', value: employee.phone },
                { icon: <MapPin size={14} />, label: 'Location', value: employee.location },
                { icon: <Calendar size={14} />, label: 'Joined', value: employee.joined },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 70, flexShrink: 0 }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
                <Award size={14} style={{ display: 'inline', marginRight: 6 }} />
                Skills & Expertise
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {employee.skills.map(skill => (
                  <span key={skill} className="badge badge-purple" style={{ fontSize: 12 }}>{skill}</span>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '18px 20px', gridColumn: '1 / -1' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Utilization Trend</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={TIMESHEET_DATA}>
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Bar dataKey="regular" fill="#64126D" radius={[4, 4, 0, 0]} stackId="a" name="Regular" />
                  <Bar dataKey="overtime" fill="#06B6D4" radius={[4, 4, 0, 0]} stackId="a" name="Overtime" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'Projects' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Assigned Projects</span>
            </div>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th>Project</th><th>Client</th><th>Phase</th><th>Status</th><th>Progress</th><th>End Date</th></tr>
              </thead>
              <tbody>
                {assignedProjects.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.id}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{p.client}</td>
                    <td><span className="badge badge-steel" style={{ fontSize: 11 }}>{p.phase}</span></td>
                    <td><span className={`badge ${p.status === 'active' ? 'badge-cyan' : 'badge-neutral'}`} style={{ fontSize: 11 }}>{p.status}</span></td>
                    <td style={{ width: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ flex: 1 }}>
                          <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{p.endDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Payroll' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Payroll History</span>
            </div>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th>Month</th><th>Basic Salary</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th><th>Status</th></tr>
              </thead>
              <tbody>
                {PAYROLL.map(p => (
                  <tr key={p.month}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{p.month}</td>
                    <td style={{ fontSize: 13 }}>AED {p.basic.toLocaleString()}</td>
                    <td style={{ fontSize: 13, color: '#16A34A' }}>+AED {p.allowances.toLocaleString()}</td>
                    <td style={{ fontSize: 13, color: '#DC2626' }}>-AED {p.deductions.toLocaleString()}</td>
                    <td style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-primary)' }}>AED {p.net.toLocaleString()}</td>
                    <td><span className="badge badge-success" style={{ fontSize: 11 }}>Processed</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Present Days', value: 83, color: '#16A34A' },
                { label: 'Absent Days', value: 1, color: '#DC2626' },
                { label: 'Leave Days', value: 4, color: '#F59E0B' },
                { label: 'OT Hours', value: 20, color: 'var(--brand-primary)' },
              ].map(s => (
                <div key={s.label} className="kpi-card">
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Monthly Attendance Summary</div>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th>Month</th><th>Present</th><th>Absent</th><th>Leave</th><th>Attendance %</th></tr>
                </thead>
                <tbody>
                  {ATTENDANCE.map(a => (
                    <tr key={a.month}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{a.month} 2026</td>
                      <td style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>{a.present} days</td>
                      <td style={{ fontSize: 13, color: a.absent > 0 ? '#DC2626' : 'var(--text-muted)', fontWeight: a.absent > 0 ? 600 : 400 }}>{a.absent} days</td>
                      <td style={{ fontSize: 13, color: '#F59E0B', fontWeight: a.leave > 0 ? 600 : 400 }}>{a.leave} days</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ width: 80 }}>
                            <div className="progress-bar-fill" style={{ width: `${Math.round(a.present / (a.present + a.absent + a.leave) * 100)}%`, background: '#16A34A' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#16A34A' }}>
                            {Math.round(a.present / (a.present + a.absent + a.leave) * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(activeTab === 'Timesheets' || activeTab === 'Performance') && (
          <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{activeTab}</div>
            <div style={{ fontSize: 13 }}>This section is available in the full system build.</div>
          </div>
        )}
      </div>
    </div>
  );
}
