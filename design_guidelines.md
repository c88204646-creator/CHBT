# CRM SaaS Dashboard Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from LeadSales.io and Kommo.com CRM interfaces - professional SaaS dashboards with modular organization, clean layouts, and efficient information architecture.

## Core Design Principles
- **Modular Organization**: Clear separation of functional areas with consistent module patterns
- **Professional Clarity**: Clean, business-focused interface prioritizing usability over decoration
- **Real-time Focus**: Design supporting live updates and instant feedback for WhatsApp connections
- **Efficient Workflows**: Quick access to frequently used actions and clear navigation hierarchy

## Typography System
**Fonts**: Inter (primary), Roboto (secondary) via Google Fonts CDN

**Hierarchy**:
- Dashboard Headers: Inter 24px/600 (font-semibold)
- Section Titles: Inter 18px/600
- Card Headers: Inter 16px/600
- Body Text: Inter 14px/400
- Labels/Meta: Inter 12px/500
- Buttons: Inter 14px/500

## Layout System
**Spacing Units**: Consistent use of Tailwind units 4, 6, 8, 12, and 24 (matching the specified 24px spacing)
- Component padding: p-6 to p-8
- Section spacing: gap-6 to gap-8
- Page margins: p-8 to p-12
- Card spacing: space-y-6

**Grid Structure**:
- Sidebar: Fixed 256px width (w-64) on desktop, collapsible on mobile
- Main content: flex-1 with max-w-7xl container
- Dashboard cards: 2-3 column grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Conversation panels: 2-column split (conversation list + message view)

## Color Application (User-Specified Palette)
- **Primary Actions**: #2563EB (buttons, links, active states)
- **Success States**: #10B981 (confirmations, connected status)
- **WhatsApp Elements**: #25D366 (QR connection, WhatsApp branding)
- **Accent Highlights**: #7C3AED (notifications, badges, special features)
- **Backgrounds**: #F8FAFC (main bg), white cards, #F1F5F9 (hover states)
- **Text**: #1E293B (primary), #64748B (secondary), #94A3B8 (muted)
- **Borders**: #E2E8F0 (dividers, card borders)

## Component Library

**Sidebar Navigation**:
- Fixed left sidebar with logo header (h-16)
- Navigation items with icons (w-5 h-5) + labels
- Active state: Primary color background with subtle rounded corners
- Collapsible sections for sub-navigation
- Bottom section for user profile and settings

**Dashboard Cards**:
- White background with subtle shadow (shadow-sm)
- Rounded corners (rounded-lg)
- Consistent padding (p-6)
- Header with title + action button/icon
- Clear content hierarchy within cards
- Hover state: subtle shadow increase (hover:shadow-md)

**Data Tables**:
- Alternating row backgrounds for readability
- Sticky header on scroll
- Action buttons right-aligned in rows
- Pagination controls at bottom
- Sort indicators in headers

**Forms & Inputs**:
- Full-width inputs with clear labels above
- Input height: h-10 to h-12
- Border: 1px solid #E2E8F0, focus: #2563EB ring
- Rounded corners: rounded-md
- Placeholder text in muted color
- Validation states with inline error messages

**Buttons**:
- Primary: bg-#2563EB, white text, h-10, px-6, rounded-md
- Secondary: border with primary color, primary text
- WhatsApp: bg-#25D366, white text (for QR/connection actions)
- Icon buttons: Square (w-10 h-10) with centered icon
- Consistent hover: slight opacity/brightness change

**Status Badges**:
- Small, rounded-full pills
- Connected: #10B981 background
- Disconnected: #EF4444 background
- Pending: #F59E0B background
- Text: white, 12px, px-3 py-1

**QR Code Display**:
- Centered modal/card with white background
- QR code centered with padding (p-8)
- Connection status indicator below
- Clear instructions text
- Auto-refresh capability indicator

**Conversation Interface**:
- Two-column layout: List (w-80) + Messages (flex-1)
- Message bubbles: rounded-2xl, different alignment for sent/received
- Timestamp below each message (text-xs, muted)
- Avatar circles for contacts (w-10 h-10)
- Unread count badges on conversation items

**Chatbot Builder**:
- Keyword-response pairs in organized list
- Add/Edit forms in modal or side panel
- Test interface for chatbot responses
- Visual indicators for active/inactive bots

## Icons
**Library**: Heroicons via CDN (consistent with modern SaaS aesthetic)
- Navigation: outline style, w-5 h-5
- Actions: outline style, w-4 h-4
- Status indicators: solid style, w-3 h-3

## Responsive Behavior
- **Mobile** (<768px): Collapsed sidebar with hamburger menu, single-column cards, stacked conversation view
- **Tablet** (768px-1024px): Collapsible sidebar, 2-column card grid
- **Desktop** (>1024px): Full sidebar, 3-column card grid where appropriate

## Key Screens Structure

**Login/Register**: Centered card (max-w-md) on neutral background, logo above form, clean input fields, primary CTA button

**Dashboard Home**: Metrics cards in 3-column grid, recent activity feed, quick actions panel, connection status widget

**WhatsApp Connections**: QR code connection card, list of connected accounts with status, manage/disconnect actions

**Conversations Panel**: Search/filter at top, scrollable conversation list, message view with input field, contact info sidebar

**Chatbot Builder**: Keyword-response table, add/edit interface, test panel, activation toggle

**User Settings**: Tabbed sections (Profile, Security, Notifications), form-based editing, save actions

## Animation Guidelines
Minimal, purposeful animations:
- Sidebar collapse/expand: 200ms ease
- Modal fade-in: 150ms ease
- Loading states: subtle pulse on skeleton screens
- No decorative animations - focus on functional feedback

This design creates a professional, efficient CRM interface that prioritizes clarity and usability for managing WhatsApp chatbot operations.