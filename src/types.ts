export type ConnectorType = 'identity' | 'data';
export type ConnectorStatus = 'active' | 'inactive' | 'error';
export type ReviewStatus = 'pending' | 'approved' | 'flagged' | 'revoked';

export interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  lastSync: string;
  description: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

export interface AccessReview {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  connectorId: string;
  connectorName: string;
  resource: string;
  permission: string;
  status: ReviewStatus;
  aiRecommendation?: string;
  aiConfidence?: number;
  lastReviewedAt?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
}
