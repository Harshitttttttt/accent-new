export const EMPLOYEES = [
  { id: 'E001', employeeCode: 'EMP-001', firstName: 'Ahmed', lastName: 'Al-Rashidi', name: 'Ahmed Al-Rashidi', role: 'Senior Process Engineer', designation: 'Senior Process Engineer', dept: 'Engineering', department: 'Process Engineering', avatar: 'AA', color: '#64126D', utilization: 87, location: 'Abu Dhabi', status: 'active', employmentType: 'full_time', email: 'ahmed.r@accentts.com', phone: '+91 98765 43210', joined: '2019-03-15', joiningDate: '2019-03-15', skills: ['Process Design', 'P&ID', 'HAZOP', 'AutoCAD', 'SmartPlant'] },
  { id: 'E002', employeeCode: 'EMP-002', firstName: 'Sara', lastName: 'Mohammed', name: 'Sara Mohammed', role: 'Project Manager', designation: 'Project Manager', dept: 'PMO', department: 'Project Management Office', avatar: 'SM', color: '#86288F', utilization: 92, location: 'Mumbai', status: 'active', employmentType: 'full_time', email: 'sara.m@accentts.com', phone: '+91 98765 43211', joined: '2020-07-01', joiningDate: '2020-07-01', skills: ['PMP', 'MS Project', 'Risk Management', 'Stakeholder Management'] },
  { id: 'E003', employeeCode: 'EMP-003', firstName: 'Khalid', lastName: 'Al-Mansouri', name: 'Khalid Al-Mansouri', role: 'Instrumentation Engineer', designation: 'Instrumentation Engineer', dept: 'Engineering', department: 'Instrumentation & Control', avatar: 'KM', color: '#475569', utilization: 74, location: 'Bangalore', status: 'active', employmentType: 'full_time', email: 'khalid.m@accentts.com', phone: '+91 98765 43212', joined: '2021-01-10', joiningDate: '2021-01-10', skills: ['SCADA', 'DCS', 'PLC', 'Instrumentation Design'] },
  { id: 'E004', employeeCode: 'EMP-004', firstName: 'Fatima', lastName: 'Al-Zahra', name: 'Fatima Al-Zahra', role: 'Civil Engineer', designation: 'Civil Engineer', dept: 'Engineering', department: 'Civil & Structural', avatar: 'FZ', color: '#06B6D4', utilization: 65, location: 'Chennai', status: 'active', employmentType: 'full_time', email: 'fatima.z@accentts.com', phone: '+91 98765 43213', joined: '2022-04-20', joiningDate: '2022-04-20', skills: ['Structural Analysis', 'AutoCAD Civil 3D', 'STAAD Pro'] },
  { id: 'E005', employeeCode: 'EMP-005', firstName: 'Omar', lastName: 'Hassan', name: 'Omar Hassan', role: 'Mechanical Engineer', designation: 'Mechanical Engineer', dept: 'Engineering', department: 'Mechanical & Piping', avatar: 'OH', color: '#16A34A', utilization: 81, location: 'Hyderabad', status: 'active', employmentType: 'full_time', email: 'omar.h@accentts.com', phone: '+91 98765 43214', joined: '2018-09-05', joiningDate: '2018-09-05', skills: ['Piping Design', 'Stress Analysis', 'CAESAR II', 'PDMS'] },
  { id: 'E006', employeeCode: 'EMP-006', firstName: 'Noor', lastName: 'Al-Sabah', name: 'Noor Al-Sabah', role: 'Electrical Engineer', designation: 'Electrical Engineer', dept: 'Engineering', department: 'Electrical Engineering', avatar: 'NS', color: '#F59E0B', utilization: 78, location: 'Pune', status: 'active', employmentType: 'contract', email: 'noor.s@accentts.com', phone: '+91 98765 43215', joined: '2020-11-15', joiningDate: '2020-11-15', skills: ['Electrical Design', 'ETAP', 'HV/LV Systems', 'Load Calculations'] },
  { id: 'E007', employeeCode: 'EMP-007', firstName: 'Tariq', lastName: 'Malik', name: 'Tariq Malik', role: 'HSE Manager', designation: 'HSE Manager', dept: 'HSE', department: 'Health, Safety & Environment', avatar: 'TM', color: '#DC2626', utilization: 55, location: 'Mumbai', status: 'active', employmentType: 'full_time', email: 'tariq.m@accentts.com', phone: '+91 98765 43216', joined: '2017-02-28', joiningDate: '2017-02-28', skills: ['ISO 14001', 'OHSAS 18001', 'Risk Assessment', 'Incident Investigation'] },
  { id: 'E008', employeeCode: 'EMP-008', firstName: 'Layla', lastName: 'Ibrahim', name: 'Layla Ibrahim', role: 'Document Controller', designation: 'Document Controller', dept: 'Admin', department: 'Administration & Operations', avatar: 'LI', color: '#2563EB', utilization: 60, location: 'Bangalore', status: 'active', employmentType: 'consultant', email: 'layla.i@accentts.com', phone: '+91 98765 43217', joined: '2021-08-01', joiningDate: '2021-08-01', skills: ['Aconex', 'SharePoint', 'Document Management', 'ISO 9001'] },
];

export const PROJECTS = [
  { id: 'PRJ-001', name: 'ADNOC Gas Plant Expansion', client: 'ADNOC Gas', status: 'active', phase: 'FEED', budget: 4200000, spent: 2100000, progress: 68, manager: 'Sara Mohammed', team: ['E001', 'E003', 'E005'], startDate: '2025-01-15', endDate: '2026-06-30', priority: 'high', contract: 'Lump Sum', location: 'Abu Dhabi', discipline: 'Process' },
  { id: 'PRJ-002', name: 'Ruwais Refinery Upgrade', client: 'ADNOC Refining', status: 'active', phase: 'Detailed Design', budget: 8500000, spent: 3900000, progress: 45, manager: 'Ahmed Al-Rashidi', team: ['E002', 'E004', 'E006'], startDate: '2024-09-01', endDate: '2026-12-31', priority: 'high', contract: 'Reimbursable', location: 'Ruwais', discipline: 'Multi' },
  { id: 'PRJ-003', name: 'Takreer Sulfur Recovery Unit', client: 'Takreer', status: 'active', phase: 'Basic Engineering', budget: 1800000, spent: 720000, progress: 32, manager: 'Sara Mohammed', team: ['E001', 'E002'], startDate: '2025-04-01', endDate: '2025-12-31', priority: 'medium', contract: 'Lump Sum', location: 'Abu Dhabi', discipline: 'Process' },
  { id: 'PRJ-004', name: 'DEWA Solar Integration Study', client: 'DEWA', status: 'review', phase: 'Concept', budget: 450000, spent: 380000, progress: 90, manager: 'Khalid Al-Mansouri', team: ['E006', 'E003'], startDate: '2025-02-01', endDate: '2025-07-31', priority: 'medium', contract: 'Time & Material', location: 'Dubai', discipline: 'Electrical' },
  { id: 'PRJ-005', name: 'Emirates Steel Structural Assessment', client: 'Emirates Steel', status: 'completed', phase: 'Completed', budget: 320000, spent: 315000, progress: 100, manager: 'Fatima Al-Zahra', team: ['E004', 'E007'], startDate: '2024-11-01', endDate: '2025-05-31', priority: 'low', contract: 'Lump Sum', location: 'Abu Dhabi', discipline: 'Civil' },
  { id: 'PRJ-006', name: 'GASCO Pipeline Integrity Study', client: 'GASCO', status: 'active', phase: 'FEED', budget: 2100000, spent: 630000, progress: 28, manager: 'Omar Hassan', team: ['E005', 'E001'], startDate: '2025-05-01', endDate: '2026-03-31', priority: 'high', contract: 'Lump Sum', location: 'Al Ain', discipline: 'Mechanical' },
  { id: 'PRJ-007', name: 'Borouge Utilities Optimization', client: 'Borouge', status: 'on-hold', phase: 'Detailed Design', budget: 1200000, spent: 540000, progress: 41, manager: 'Sara Mohammed', team: ['E002', 'E006', 'E003'], startDate: '2025-03-01', endDate: '2026-01-31', priority: 'medium', contract: 'Reimbursable', location: 'Ruwais', discipline: 'Process' },
];

export const LEADS = [
  { id: 'L001', company: 'Abu Dhabi Ports', contact: 'Mohammed Al-Dhaheri', email: 'mo.dhaheri@adports.ae', value: 2500000, stage: 'Prospecting', score: 72, source: 'Referral', assignee: 'Sara Mohammed', lastActivity: '2026-08-15', probability: 25 },
  { id: 'L002', company: 'Emirates Global Aluminium', contact: 'Robert Chen', email: 'r.chen@ega.ae', value: 4800000, stage: 'Qualified', score: 85, source: 'Direct', assignee: 'Ahmed Al-Rashidi', lastActivity: '2026-08-14', probability: 45 },
  { id: 'L003', company: 'Etihad Airways MRO', contact: 'Priya Nair', email: 'p.nair@etihad.ae', value: 680000, stage: 'Proposal Sent', score: 68, source: 'LinkedIn', assignee: 'Sara Mohammed', lastActivity: '2026-08-12', probability: 60 },
  { id: 'L004', company: 'National Marine Dredging', contact: 'Jassim Al-Rumaihi', email: 'j.rumaihi@nmdc.ae', value: 1200000, stage: 'Negotiation', score: 91, source: 'Tender', assignee: 'Khalid Al-Mansouri', lastActivity: '2026-08-16', probability: 75 },
  { id: 'L005', company: 'ENOC Refineries', contact: 'David Williams', email: 'd.williams@enoc.com', value: 3200000, stage: 'Qualified', score: 78, source: 'Conference', assignee: 'Omar Hassan', lastActivity: '2026-08-10', probability: 50 },
  { id: 'L006', company: 'Sharjah Electricity', contact: 'Hessa Al-Qassimi', email: 'h.qassimi@sewa.gov.ae', value: 950000, stage: 'Prospecting', score: 55, source: 'Cold Outreach', assignee: 'Noor Al-Sabah', lastActivity: '2026-08-08', probability: 20 },
  { id: 'L007', company: 'Taqa Energy', contact: 'Chris Johnson', email: 'c.johnson@taqa.com', value: 6100000, stage: 'Negotiation', score: 88, source: 'Referral', assignee: 'Sara Mohammed', lastActivity: '2026-08-17', probability: 80 },
  { id: 'L008', company: 'Aldar Properties', contact: 'Fatima Bint Hamdan', email: 'f.hamdan@aldar.com', value: 420000, stage: 'Closed Won', score: 95, source: 'Repeat', assignee: 'Sara Mohammed', lastActivity: '2026-08-05', probability: 100 },
  { id: 'L009', company: 'Dubai Electricity & Water', contact: 'Michael Torres', email: 'm.torres@dewa.gov.ae', value: 2900000, stage: 'Proposal Sent', score: 74, source: 'Tender', assignee: 'Ahmed Al-Rashidi', lastActivity: '2026-08-13', probability: 55 },
];

export const PROPOSALS = [
  { id: 'PRP-001', title: 'Gas Plant Debottlenecking - Technical Study', client: 'ADNOC Gas', value: 380000, margin: 28, status: 'Submitted', assignee: 'Sara Mohammed', submittedDate: '2026-08-01', expectedClose: '2026-09-15' },
  { id: 'PRP-002', title: 'Structural Integrity Assessment - Phase 2', client: 'Emirates Steel', value: 250000, margin: 35, status: 'Draft', assignee: 'Fatima Al-Zahra', submittedDate: null, expectedClose: '2026-09-30' },
  { id: 'PRP-003', title: 'Pipeline Corrosion Monitoring System', client: 'GASCO', value: 1200000, margin: 22, status: 'Negotiation', assignee: 'Omar Hassan', submittedDate: '2026-07-20', expectedClose: '2026-08-31' },
  { id: 'PRP-004', title: 'Utilities Master Plan Study', client: 'Borouge', value: 850000, margin: 30, status: 'Won', assignee: 'Ahmed Al-Rashidi', submittedDate: '2026-06-15', expectedClose: '2026-07-31' },
  { id: 'PRP-005', title: 'Electrical Load Flow Analysis', client: 'DEWA', value: 180000, margin: 40, status: 'Lost', assignee: 'Noor Al-Sabah', submittedDate: '2026-07-10', expectedClose: '2026-08-15' },
  { id: 'PRP-006', title: 'Process Safety Management Audit', client: 'Takreer', value: 320000, margin: 45, status: 'Submitted', assignee: 'Tariq Malik', submittedDate: '2026-08-10', expectedClose: '2026-09-20' },
];

export const INVOICES = [
  { id: 'INV-2026-001', project: 'ADNOC Gas Plant Expansion', client: 'ADNOC Gas', amount: 420000, status: 'Paid', dueDate: '2026-07-30', issuedDate: '2026-07-01', aging: 0 },
  { id: 'INV-2026-002', project: 'Ruwais Refinery Upgrade', client: 'ADNOC Refining', amount: 780000, status: 'Overdue', dueDate: '2026-07-15', issuedDate: '2026-06-15', aging: 33 },
  { id: 'INV-2026-003', project: 'Takreer Sulfur Recovery Unit', client: 'Takreer', amount: 180000, status: 'Pending', dueDate: '2026-08-31', issuedDate: '2026-08-01', aging: 16 },
  { id: 'INV-2026-004', project: 'GASCO Pipeline Integrity', client: 'GASCO', amount: 315000, status: 'Pending', dueDate: '2026-09-15', issuedDate: '2026-08-15', aging: 2 },
  { id: 'INV-2026-005', project: 'Emirates Steel Assessment', client: 'Emirates Steel', amount: 315000, status: 'Paid', dueDate: '2026-06-30', issuedDate: '2026-06-01', aging: 0 },
  { id: 'INV-2026-006', project: 'DEWA Solar Study', client: 'DEWA', amount: 95000, status: 'Overdue', dueDate: '2026-08-01', issuedDate: '2026-07-01', aging: 16 },
];

export const REVENUE_DATA = [
  { month: 'Mar', revenue: 1820000, target: 2000000 },
  { month: 'Apr', revenue: 2340000, target: 2200000 },
  { month: 'May', revenue: 1980000, target: 2000000 },
  { month: 'Jun', revenue: 2750000, target: 2500000 },
  { month: 'Jul', revenue: 2100000, target: 2300000 },
  { month: 'Aug', revenue: 1650000, target: 2000000 },
];

export const PROJECT_STATUS_DATA = [
  { name: 'Active', value: 4, color: '#64126D' },
  { name: 'Review', value: 1, color: '#06B6D4' },
  { name: 'On Hold', value: 1, color: '#F59E0B' },
  { name: 'Completed', value: 1, color: '#16A34A' },
];

export const WORKLOAD_DATA = [
  { name: 'Ahmed', utilization: 87 },
  { name: 'Sara', utilization: 92 },
  { name: 'Khalid', utilization: 74 },
  { name: 'Fatima', utilization: 65 },
  { name: 'Omar', utilization: 81 },
  { name: 'Noor', utilization: 78 },
  { name: 'Tariq', utilization: 55 },
];

export const ACTIVITIES = [
  { id: 1, type: 'project', message: 'ADNOC Gas Plant Expansion reached 68% completion', user: 'Sara Mohammed', time: '10 min ago', avatar: 'SM', color: '#86288F' },
  { id: 2, type: 'lead', message: 'New lead: Taqa Energy — AED 6.1M opportunity', user: 'System', time: '1 hr ago', avatar: 'SY', color: '#475569' },
  { id: 3, type: 'invoice', message: 'Invoice INV-2026-002 is 33 days overdue (AED 780K)', user: 'Finance', time: '2 hr ago', avatar: 'FN', color: '#DC2626' },
  { id: 4, type: 'proposal', message: 'Proposal PRP-003 moved to Negotiation stage', user: 'Omar Hassan', time: '3 hr ago', avatar: 'OH', color: '#16A34A' },
  { id: 5, type: 'approval', message: 'Purchase Order PO-2026-041 approved by Tariq Malik', user: 'Tariq Malik', time: '5 hr ago', avatar: 'TM', color: '#DC2626' },
  { id: 6, type: 'project', message: 'GASCO Pipeline project kickoff meeting scheduled', user: 'Khalid Al-Mansouri', time: 'Yesterday', avatar: 'KM', color: '#475569' },
];

export const DELIVERABLES = [
  { id: 1, name: 'P&ID Revision B Issue', project: 'ADNOC Gas Plant Expansion', dueDate: '2026-08-22', status: 'In Progress', assignee: 'Ahmed Al-Rashidi' },
  { id: 2, name: 'Hazop Study Report', project: 'Ruwais Refinery Upgrade', dueDate: '2026-08-25', status: 'Pending Review', assignee: 'Sara Mohammed' },
  { id: 3, name: 'Electrical Load List', project: 'GASCO Pipeline Integrity', dueDate: '2026-08-28', status: 'Not Started', assignee: 'Noor Al-Sabah' },
  { id: 4, name: 'Structural Report', project: 'Takreer SRU', dueDate: '2026-09-01', status: 'Not Started', assignee: 'Fatima Al-Zahra' },
];

export const EXPENSES = [
  { id: 'EXP-001', description: 'Site Visit - Ruwais Refinery', category: 'Travel', amount: 4200, status: 'Approved', employee: 'Ahmed Al-Rashidi', date: '2026-08-10', project: 'Ruwais Refinery Upgrade' },
  { id: 'EXP-002', description: 'AutoCAD License Renewal', category: 'Software', amount: 12500, status: 'Pending', employee: 'Layla Ibrahim', date: '2026-08-12', project: 'General' },
  { id: 'EXP-003', description: 'Safety Training Course', category: 'Training', amount: 3800, status: 'Pending', employee: 'Tariq Malik', date: '2026-08-14', project: 'General' },
  { id: 'EXP-004', description: 'Client Lunch - ADNOC', category: 'Entertainment', amount: 1250, status: 'Approved', employee: 'Sara Mohammed', date: '2026-08-08', project: 'ADNOC Gas Plant Expansion' },
  { id: 'EXP-005', description: 'Printing - Proposal Documents', category: 'Office', amount: 680, status: 'Approved', employee: 'Layla Ibrahim', date: '2026-08-07', project: 'General' },
];

export const TASKS = [
  { id: 'T001', title: 'Review HAZOP Study Draft', priority: 'high', dueDate: '2026-08-20', project: 'ADNOC Gas Plant Expansion', status: 'in_progress', assignee: 'Ahmed Al-Rashidi' },
  { id: 'T002', title: 'Submit Monthly Timesheet', priority: 'medium', dueDate: '2026-08-25', project: 'Admin', status: 'pending', assignee: 'Sara Mohammed' },
  { id: 'T003', title: 'Update Project Schedule', priority: 'high', dueDate: '2026-08-18', project: 'GASCO Pipeline Integrity', status: 'overdue', assignee: 'Omar Hassan' },
  { id: 'T004', title: 'Finalize Vendor Quotations', priority: 'medium', dueDate: '2026-08-22', project: 'Takreer SRU', status: 'pending', assignee: 'Khalid Al-Mansouri' },
  { id: 'T005', title: 'Prepare Invoice INV-2026-007', priority: 'low', dueDate: '2026-09-01', project: 'Emirates Steel', status: 'pending', assignee: 'Layla Ibrahim' },
];
