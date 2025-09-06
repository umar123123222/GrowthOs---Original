# Growth OS Architecture

## System Overview

Growth OS follows a modern web application architecture with a React frontend, Supabase backend, and microservices pattern using Edge Functions for business logic.

```mermaid
graph TB
    subgraph "Client Layer"
        A[React Frontend]
        B[Mobile Responsive UI]
        C[Real-time Subscriptions]
    end
    
    subgraph "Authentication"
        D[Supabase Auth]
        E[Row Level Security]
        F[Role-based Access]
    end
    
    subgraph "API Layer"
        G[Supabase Client]
        H[Edge Functions]
        I[PostgreSQL Functions]
    end
    
    subgraph "Data Layer"
        J[(PostgreSQL Database)]
        K[(Supabase Storage)]
        L[Real-time Engine]
    end
    
    subgraph "External Services"
        M[SMTP Email]
        N[Shopify API]
        O[Zapier Webhooks]
    end
    
    A --> G
    B --> G
    C --> L
    D --> E
    E --> F
    G --> H
    G --> I
    H --> J
    I --> J
    K --> A
    H --> M
    H --> N
    H --> O
    
    style A fill:#e1f5fe
    style J fill:#f3e5f5
    style H fill:#e8f5e8
```

## Core Components

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Tailwind CSS for styling
- shadcn/ui component library
- React Router for navigation
- TanStack Query for data fetching

**Key Patterns:**
- Component-based architecture
- Custom hooks for business logic
- Context providers for global state
- Error boundaries for fault tolerance
- Responsive design with mobile-first approach

### Backend Architecture

**Supabase Services:**
- PostgreSQL database with Row Level Security (RLS)
- Authentication with JWT tokens
- Storage for file uploads
- Edge Functions for serverless logic
- Real-time subscriptions

**Database Design:**
```mermaid
erDiagram
    USERS ||--o{ USER_ACTIVITY_LOGS : creates
    USERS ||--o{ ASSIGNMENTS : assigned_to
    USERS ||--o{ SUBMISSIONS : submits
    USERS ||--o{ INSTALLMENT_PAYMENTS : pays
    USERS ||--o{ SUPPORT_TICKETS : creates
    USERS ||--o{ NOTIFICATIONS : receives
    
    MODULES ||--o{ AVAILABLE_LESSONS : contains
    AVAILABLE_LESSONS ||--o{ ASSIGNMENTS : linked_to
    ASSIGNMENTS ||--o{ SUBMISSIONS : receives
    
    USERS {
        uuid id PK
        string email
        string role
        string status
        string lms_status
        uuid mentor_id FK
    }
    
    MODULES {
        uuid id PK
        string title
        integer order
        jsonb quiz_questions
    }
    
    ASSIGNMENTS {
        uuid id PK
        string name
        uuid mentor_id FK
        uuid recording_id FK
    }
```

### Edge Functions Architecture

**Function Categories:**

1. **User Management**
   - `create-student` - Student onboarding with email automation
   - `create-team-member` - Admin/mentor account creation
   - `delete-user-with-role` - Secure user deletion with audit trails

2. **Business Logic**
   - `cleanup-inactive-students` - Automated data cleanup
   - `mark-invoice-paid` - Payment processing
   - `motivational-notifications` - Automated engagement

3. **Integrations**
   - `shopify-metrics` - E-commerce data sync
   - `encrypt-token` - Security utilities
   - `notification-scheduler` - Email automation

### Security Architecture

**Authentication Flow:**
```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant A as Supabase Auth
    participant D as Database
    
    U->>C: Login Request
    C->>A: Authenticate
    A->>A: Verify Credentials
    A->>C: JWT Token
    C->>D: Query with Token
    D->>D: Check RLS Policies
    D->>C: Authorized Data
    C->>U: Display UI
```

**Row Level Security (RLS) Policies:**
- Table-level access control
- Role-based data filtering
- User-specific data isolation
- Administrative override capabilities

## Data Flow Patterns

### Student Learning Journey

```mermaid
graph LR
    A[Student Registration] --> B[Email Verification]
    B --> C[Onboarding Questionnaire]
    C --> D[Module Access]
    D --> E[Watch Video]
    E --> F[Complete Assignment]
    F --> G[Mentor Review]
    G --> H[Unlock Next Module]
    H --> D
    
    style A fill:#ffeb3b
    style H fill:#4caf50
```

### Assignment Workflow

```mermaid
graph TB
    A[Student Submits] --> B[Mentor Notification]
    B --> C[Mentor Reviews]
    C --> D{Decision}
    D -->|Approve| E[Unlock Next Content]
    D -->|Decline| F[Request Revision]
    F --> A
    E --> G[Student Notification]
    
    style E fill:#4caf50
    style F fill:#ff9800
```

## Scalability Considerations

### Performance Optimizations

- **Database**: Indexed queries, materialized views for reports
- **Frontend**: Code splitting, lazy loading, React Query caching
- **Storage**: CDN delivery for static assets
- **Real-time**: Selective subscriptions, connection pooling

### Monitoring & Observability

- **Logging**: Structured logging with log levels
- **Error Tracking**: Error boundaries with detailed error reporting
- **Performance**: Database query monitoring
- **User Activity**: Comprehensive audit trails

## Deployment Architecture

### Environment Separation

```mermaid
graph LR
    A[Development] --> B[Staging]
    B --> C[Production]
    
    subgraph "Development"
        D[Local Supabase]
        E[Local Database]
    end
    
    subgraph "Staging"
        F[Staging Supabase]
        G[Test Database]
    end
    
    subgraph "Production"
        H[Production Supabase]
        I[Live Database]
    end
```

### CI/CD Pipeline

1. **Code Push** → GitHub repository
2. **Automatic Deploy** → Platform deployment
3. **Database Migrations** → Supabase CLI
4. **Edge Functions** → Automatic deployment
5. **Static Assets** → CDN distribution

## Integration Points

### External Service Connections

- **Email Service**: SMTP configuration for transactional emails
- **E-commerce**: Shopify API for sales data
- **Automation**: Zapier webhooks for workflow integration
- **File Storage**: Supabase Storage for uploads

### API Design Patterns

- **RESTful**: Standard CRUD operations via Supabase
- **GraphQL-like**: Supabase PostgREST for complex queries
- **Real-time**: WebSocket connections for live updates
- **Edge Functions**: Serverless functions for business logic

## Error Handling Strategy

### Client-Side Error Handling

- React Error Boundaries for component failures
- Toast notifications for user feedback
- Retry mechanisms for network failures
- Fallback UI components for graceful degradation

### Server-Side Error Handling

- Database transaction rollbacks
- Edge Function error responses
- Audit logging for debugging
- Automatic retry for transient failures

## Next Steps

Review the [Environment Reference](./env-reference.md) for configuration details, then explore specific [Feature Documentation](./features/) to understand individual system components.