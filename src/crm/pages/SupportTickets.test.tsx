import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SupportTickets from './SupportTickets'
import { computeSupportTicketStats, type SupportTicketsPagePayload } from '~/lib/support-tickets'

vi.mock('~/lib/support-tickets.functions', () => ({
  getSupportTicketsPageData: vi.fn(),
  getSupportTicketDetailData: vi.fn().mockResolvedValue({
    authorized: true,
    detail: {
      ticket: {
        id: '11111111-1111-1111-1111-111111111111',
        ticketNumber: 'TKT-2026-001',
        title: 'AutoCAD civil workstation license expired',
        description: 'Workstation WS-04 failed to renew license.',
        category: 'software_license',
        priority: 'high',
        status: 'open',
        requesterId: 'u2',
        requesterName: 'Ahmed Al-Rashidi',
        requesterEmail: 'ahmed.r@accentts.com',
        assignedTo: 'e1',
        assigneeName: 'Sara Mohammed',
        assigneeRole: 'Project Manager',
        relatedProjectId: 'p1',
        relatedProjectName: 'ADNOC Gas Plant Expansion',
        dueDate: '2026-09-01',
        resolvedAt: null,
        resolvedBy: null,
        resolvedByName: null,
        resolutionNotes: null,
        tags: ['autocad', 'license'],
        commentCount: 1,
        createdAt: '2026-08-25T10:00:00Z',
        updatedAt: '2026-08-25T10:00:00Z',
      },
      comments: [
        {
          id: 'c1',
          ticketId: '11111111-1111-1111-1111-111111111111',
          authorUserId: 'u1',
          authorName: 'Sara Mohammed',
          authorRole: 'Manager',
          message: 'Contacting Autodesk representative.',
          isInternal: false,
          createdAt: '2026-08-25T11:00:00Z',
        },
      ],
      activities: [
        {
          id: 'a1',
          ticketId: '11111111-1111-1111-1111-111111111111',
          actorUserId: 'u1',
          actorName: 'System',
          action: 'Ticket Created',
          oldValue: null,
          newValue: 'Priority set to high',
          createdAt: '2026-08-25T10:00:00Z',
        },
      ],
    },
  }),
  createSupportTicketAction: vi.fn(),
  updateSupportTicketAction: vi.fn(),
  updateTicketStatusAction: vi.fn(),
  assignTicketAction: vi.fn(),
  addTicketCommentAction: vi.fn(),
  deleteSupportTicketAction: vi.fn(),
}))

const mockInitialData: SupportTicketsPagePayload = {
  authorized: true,
  currentUser: {
    id: 'u1',
    fullName: 'System Admin',
    email: 'admin@accentts.com',
    username: 'admin',
    isAdmin: true,
    isStaff: true,
    employeeId: null,
  },
  tickets: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      ticketNumber: 'TKT-2026-001',
      title: 'AutoCAD civil workstation license expired',
      description: 'Workstation WS-04 failed to renew license.',
      category: 'software_license',
      priority: 'high',
      status: 'open',
      requesterId: 'u2',
      requesterName: 'Ahmed Al-Rashidi',
      requesterEmail: 'ahmed.r@accentts.com',
      assignedTo: 'e1',
      assigneeName: 'Sara Mohammed',
      assigneeRole: 'Project Manager',
      relatedProjectId: 'p1',
      relatedProjectName: 'ADNOC Gas Plant Expansion',
      dueDate: '2026-09-01',
      resolvedAt: null,
      resolvedBy: null,
      resolvedByName: null,
      resolutionNotes: null,
      tags: ['autocad', 'license'],
      commentCount: 1,
      createdAt: '2026-08-25T10:00:00Z',
      updatedAt: '2026-08-25T10:00:00Z',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      ticketNumber: 'TKT-2026-002',
      title: 'VPN Connection drops intermittently',
      description: 'WireGuard remote connection disconnects every 10 minutes.',
      category: 'it_support',
      priority: 'medium',
      status: 'in_progress',
      requesterId: 'u1',
      requesterName: 'System Admin',
      requesterEmail: 'admin@accentts.com',
      assignedTo: null,
      assigneeName: null,
      assigneeRole: null,
      relatedProjectId: null,
      relatedProjectName: null,
      dueDate: '2026-08-28',
      resolvedAt: null,
      resolvedBy: null,
      resolvedByName: null,
      resolutionNotes: null,
      tags: ['network', 'vpn'],
      commentCount: 0,
      createdAt: '2026-08-26T10:00:00Z',
      updatedAt: '2026-08-26T10:00:00Z',
    },
  ],
  stats: computeSupportTicketStats([]),
  options: {
    employees: [
      { id: 'e1', name: 'Sara Mohammed', designation: 'Project Manager' },
      { id: 'e2', name: 'Ahmed Al-Rashidi', designation: 'Senior Process Engineer' },
    ],
    projects: [{ id: 'p1', name: 'ADNOC Gas Plant Expansion' }],
    users: [{ id: 'u1', name: 'Sara Mohammed', email: 'sara.m@accentts.com' }],
  },
}

describe('SupportTickets Page Component', () => {
  it('renders heading, Admin Console badge, and ticket rows in table view', () => {
    render(<SupportTickets initialData={mockInitialData} />)

    expect(screen.getByRole('heading', { level: 2, name: /Support Tickets/i })).toBeInTheDocument()
    expect(screen.getByText(/Admin Console/i)).toBeInTheDocument()
    expect(screen.getByText('TKT-2026-001')).toBeInTheDocument()
    expect(screen.getByText('AutoCAD civil workstation license expired')).toBeInTheDocument()
    expect(screen.getByText('TKT-2026-002')).toBeInTheDocument()
    expect(screen.getByText('VPN Connection drops intermittently')).toBeInTheDocument()
  })

  it('switches between Table and Board views', async () => {
    const user = userEvent.setup()
    render(<SupportTickets initialData={mockInitialData} />)

    const boardBtn = screen.getByTitle(/Kanban Board View/i)
    await user.click(boardBtn)

    expect(screen.getAllByText(/Open/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/In Progress/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Waiting on User/i).length).toBeGreaterThan(0)
  })

  it('opens and closes the new ticket modal in admin mode', async () => {
    const user = userEvent.setup()
    render(<SupportTickets initialData={mockInitialData} />)

    const newBtn = screen.getByRole('button', { name: /New Ticket/i })
    await user.click(newBtn)

    expect(screen.getByRole('heading', { level: 3, name: /New Support Ticket/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Subject \/ Title \*/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Assign To/i)).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    await user.click(cancelBtn)

    expect(screen.queryByRole('heading', { level: 3, name: /New Support Ticket/i })).not.toBeInTheDocument()
  })

  it('renders My Helpdesk mode and hides internal note toggle for regular users', async () => {
    const user = userEvent.setup()
    const regularUserData: SupportTicketsPagePayload = {
      ...mockInitialData,
      currentUser: {
        id: 'u2',
        fullName: 'Ahmed Al-Rashidi',
        email: 'ahmed.r@accentts.com',
        username: 'ahmed',
        isAdmin: false,
        isStaff: false,
        employeeId: 'e2',
      },
    }

    render(<SupportTickets initialData={regularUserData} />)

    expect(screen.getByText(/My Helpdesk/i)).toBeInTheDocument()

    const newBtn = screen.getByRole('button', { name: /New Ticket/i })
    await user.click(newBtn)

    expect(screen.getByRole('heading', { level: 3, name: /Submit Support Request/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Requester Name/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Assign To/i)).not.toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    await user.click(cancelBtn)

    // Open detail drawer and verify internal note checkbox is NOT present for regular user
    const ticketRow = screen.getByText('TKT-2026-001')
    await user.click(ticketRow)

    expect(await screen.findByText('Contacting Autodesk representative.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Internal Note/i)).not.toBeInTheDocument()
  })
})
