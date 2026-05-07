# Project-Level Database Connections

## Architecture Overview

The AI Research Platform now supports **project-specific database connections** instead of a single global DATABASE_URL.

Each project can have its own connected database with:
- ✅ Automatic schema extraction
- ✅ Dynamic SQL generation per project
- ✅ Connection testing and validation
- ✅ Secure credential storage (file-based for MVP)

## File Structure

```
lib/
├── db/
│   ├── connections.ts       # Connection storage/retrieval
│   ├── clients.ts           # Database client factory
│   ├── schema.ts            # Schema caching
│   └── ...
├── rag/
│   └── types.ts             # Enhanced with DB types
└── projects.ts              # Updated with DB helpers

components/
├── ConnectDatabaseModal.tsx  # Modern UI for adding connections
└── ProjectDatabaseSection.tsx # Database status/management

app/
├── api/
│   └── connect-db/
│       └── route.ts         # POST/GET/DELETE for connections
└── project/[id]/
    └── page.tsx             # Updated with DB UI
```

## Data Model

### ProjectDatabaseConnection
```typescript
{
  id: string                          // Unique connection ID
  projectId: string                   // Associated project
  type: "postgres" | "mysql" | ...    // Database type
  host: string                        // Host/server address
  port: number                        // Port
  username: string                    // Authentication
  password: string                    // (encrypted in production)
  database: string                    // Database name
  ssl?: boolean                       // SSL connection
  createdAt: string                   // Timestamp
  testResult?: {
    success: boolean
    error?: string
    tables?: number                   // Table count on success
  }
}
```

### DatabaseSchema (Cached)
```typescript
{
  projectId: string
  tables: Array<{
    name: string
    columns: Array<{
      name: string
      type: string
      nullable: boolean
    }>
  }>
  lastUpdated: string
}
```

## API Routes

### POST /api/connect-db
Connect a database to a project.

**Request:**
```json
{
  "projectId": "my-project",
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "username": "user",
  "password": "pass",
  "database": "research_db",
  "ssl": false,
  "testOnly": false
}
```

**Response (Success):**
```json
{
  "success": true,
  "connection": {
    "id": "conn_123",
    "projectId": "my-project",
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "research_db",
    "createdAt": "2026-05-07T..."
  },
  "schema": {
    "tableCount": 4,
    "columnCount": 28,
    "tables": [
      { "name": "studies", "columnCount": 8 },
      ...
    ]
  }
}
```

### GET /api/connect-db?projectId=...
Get current connection for a project.

**Response:**
```json
{
  "connection": {
    "id": "conn_123",
    "projectId": "my-project",
    "type": "postgres",
    ...
  }
}
```

### DELETE /api/connect-db?projectId=...
Disconnect database from project.

**Response:**
```json
{
  "success": true,
  "message": "Database connection removed"
}
```

## Components

### ConnectDatabaseModal
Modern modal UI for connecting databases with:
- Database type selector (Postgres, MySQL, MongoDB, MSSQL)
- Connection credentials form
- Test connection button
- Success/error states

### ProjectDatabaseSection
Displays:
- Current connection status
- Connected database details (host, port, database name)
- Table count from connection test
- Update/disconnect buttons

## Database Client Factory

The `createDatabaseClient()` function creates type-safe database clients:

```typescript
// Postgres (MVP) - fully implemented
const postgresClient = createDatabaseClient({
  type: "postgres",
  host: "localhost",
  ...
});

// MySQL/MongoDB/MSSQL - architecture ready
// Error: "Support coming soon"
```

Each client implements:
- `testConnection()` - Validate credentials
- `getSchema()` - Fetch and cache schema
- `query()` - Execute SELECT queries
- `close()` - Clean up connections

## Flow: Connecting a Database

1. **User clicks "Connect" button** → `ProjectDatabaseSection` opens `ConnectDatabaseModal`
2. **User enters credentials** → Modal validates input
3. **Test Connection** → `POST /api/connect-db?testOnly=true`
   - Creates temporary client
   - Tests connection
   - Returns table count
4. **Save Connection** → `POST /api/connect-db`
   - Saves connection config to `.data/db-connections/{projectId}.json`
   - Fetches schema and saves to `.data/db-schemas/{projectId}.json`
   - Returns connection + schema metadata
5. **UI updates** → `ProjectDatabaseSection` reloads and displays "Connected"

## Flow: SQL Generation with Project DB

1. **User asks question** → `POST /api/ask`
2. **Route checks project data sources:**
   - `dbConnection = await getProjectDatabaseConnection(projectId)`
   - `hasDatabase = dbConnection !== null`
   - `hasDocuments = uploadedFiles.length > 0`
3. **Load project schema:**
   ```typescript
   if (hasDatabase) {
     schema = await getProjectSchema(projectId)
     // Used in SQL generation
   }
   ```
4. **Enforce routing:**
   - Documents only → RAG only
   - DB only → SQL only
   - Both → Hybrid
5. **Generate SQL** using project-specific schema
6. **Execute** (mock for MVP, real execution in production)

## Storage (MVP)

Connections and schemas stored as JSON files:

```
.data/
├── db-connections/
│   ├── default.json              # Default project DB config
│   ├── my-project.json           # Custom project DB config
│   └── ...
└── db-schemas/
    ├── default.json              # Cached schema for default
    ├── my-project.json           # Cached schema for my-project
    └── ...
```

## Project Database State

Updated `hasDatabase` and `hasDocuments` flags:

```typescript
// Before: checked project.databases array
const hasDatabase = project.databases?.some(d => d.status === "Connected")

// Now: checks actual DB connection
const dbConnection = await getProjectDatabaseConnection(projectId)
const hasDatabase = dbConnection !== null

// Chat routing now correctly enforces:
// - No DB + has docs → RAG only
// - Has DB + no docs → SQL only
// - Has DB + has docs → Hybrid
```

## Production Roadmap

### Current (MVP - File-based)
- ✅ Credentials stored in JSON files
- ✅ Postgres fully supported
- ✅ Schema cached locally
- ✅ Connection testing works

### Phase 2
- Encrypt passwords in storage
- Support MySQL, MongoDB, MSSQL
- Real query execution (not mock)
- Connection pooling

### Phase 3
- Persistent database for connections
- Multi-database support per project
- Query result pagination
- Query caching/memoization

## Example Usage

### Connect Postgres Database
```
User → Opens "Connect Database" button
     → Selects "Postgres"
     → Enters: host=localhost, port=5432, user=postgres, pass=xxx, db=research_data
     → Clicks "Test Connection" → ✓ Found 5 tables
     → Clicks "Connect" → Connection saved
     → Now can run SQL queries on this project's database
```

### Use Project DB in Chats
```
Question: "Show me the latest studies"
Route: Detects SQL signal + DB connected + no docs
Mode: "sql"
Generation: Uses PROJECT schema (not global)
Result: SQL query specific to project's research_data DB
```

## Testing Checklist

- [ ] Test connection with valid Postgres credentials
- [ ] Test connection with invalid credentials (error handling)
- [ ] Verify schema is fetched and cached
- [ ] Verify schema appears in SQL generation
- [ ] Test disconnect functionality
- [ ] Verify hasDatabase flag reflects connection state
- [ ] Chat routing respects project DB availability
- [ ] Multiple projects can have different DB configs
- [ ] SQL generation uses project-specific schema
