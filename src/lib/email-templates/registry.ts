import type { ComponentType } from 'react'
import InviteEmail from './invite'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  invite: {
    component: InviteEmail,
    displayName: 'Workspace invite',
    subject: (data) =>
      data?.orgName
        ? `You're invited to join ${data.orgName}`
        : "You're invited",
    previewData: {
      orgName: 'Acme Marketing',
      inviterName: 'Sam Operator',
      confirmationUrl: 'https://example.com/invite/abc123',
    },
  },
}
