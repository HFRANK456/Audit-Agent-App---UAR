import { Connector, User, AccessReview, AuditLog } from '../types';

export const mockConnectors: Connector[] = [
  {
    id: 'c1',
    name: 'Okta Identity',
    type: 'identity',
    status: 'active',
    lastSync: '2026-04-06T10:00:00Z',
    description: 'Primary identity provider for employee SSO.'
  },
  {
    id: 'c2',
    name: 'AWS S3 Data',
    type: 'data',
    status: 'active',
    lastSync: '2026-04-06T09:30:00Z',
    description: 'Cloud storage buckets for engineering and marketing.'
  },
  {
    id: 'c3',
    name: 'Azure AD',
    type: 'identity',
    status: 'error',
    lastSync: '2026-04-05T15:00:00Z',
    description: 'Secondary IDP for external contractors.'
  },
  {
    id: 'c4',
    name: 'Snowflake Warehouse',
    type: 'data',
    status: 'active',
    lastSync: '2026-04-06T11:00:00Z',
    description: 'Enterprise data warehouse for analytics.'
  }
];

export const mockUsers: User[] = [
  { id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', department: 'Engineering', role: 'Senior Developer' },
  { id: 'u2', name: 'Bob Smith', email: 'bob@example.com', department: 'Marketing', role: 'Manager' },
  { id: 'u3', name: 'Charlie Brown', email: 'charlie@example.com', department: 'Finance', role: 'Analyst' }
];

export const mockReviews: AccessReview[] = [
  {
    id: 'r1',
    userId: 'u1',
    userName: 'Alice Johnson',
    userEmail: 'alice@example.com',
    connectorId: 'c2',
    connectorName: 'AWS S3 Data',
    resource: 'prod-backups',
    permission: 'Full Access',
    status: 'pending',
    aiRecommendation: 'Flag: User has not accessed this bucket in 90 days.',
    aiConfidence: 0.92
  },
  {
    id: 'r2',
    userId: 'u2',
    userName: 'Bob Smith',
    userEmail: 'bob@example.com',
    connectorId: 'c1',
    connectorName: 'Okta Identity',
    resource: 'Admin Console',
    permission: 'Super Admin',
    status: 'flagged',
    aiRecommendation: 'Critical: Marketing managers typically do not require Super Admin access.',
    aiConfidence: 0.98
  },
  {
    id: 'r3',
    userId: 'u3',
    userName: 'Charlie Brown',
    userEmail: 'charlie@example.com',
    connectorId: 'c4',
    connectorName: 'Snowflake Warehouse',
    resource: 'financial_reports',
    permission: 'Read Only',
    status: 'approved',
    aiRecommendation: 'Safe: Access aligns with Finance Analyst role.',
    aiConfidence: 0.95
  }
];

export const mockAuditLogs: AuditLog[] = [
  { id: 'l1', timestamp: '2026-04-06T12:00:00Z', action: 'Sync Completed', user: 'System', details: 'Okta Identity sync successful.', severity: 'info' },
  { id: 'l2', timestamp: '2026-04-06T11:45:00Z', action: 'Access Flagged', user: 'AI Agent', details: 'Bob Smith flagged for excessive permissions.', severity: 'warning' },
  { id: 'l3', timestamp: '2026-04-06T11:30:00Z', action: 'Connector Error', user: 'System', details: 'Azure AD connection failed: Timeout.', severity: 'critical' }
];
