# SQL Injection Security Implementation Guide

## Trading Alerts SaaS V7 - Vulnerability Identification & Testing Plan

**Document Version:** 1.0  
**Target Audience:** Claude Code (Autonomous Security Audit)  
**Project:** Trading Alerts SaaS V7  
**Tech Stack:** Next.js 15, Flask, Prisma ORM, PostgreSQL, Railway

---

## Executive Summary

This guide provides systematic methodology for identifying, detecting, and remediating SQL injection vulnerabilities across the Trading Alerts SaaS V7 codebase. The project uses Prisma ORM (protective) but includes Flask MT5 service (high-risk area) and user input processing that requires comprehensive security audit.

---

## Part 1: Code Scanning Methodology

### 1.1 Scanning Approach

**Priority Levels:**

- **P0 - CRITICAL:** Direct database queries with user input
- **P1 - HIGH:** ORM queries with dynamic fields/conditions
- **P2 - MEDIUM:** Input validation and sanitization gaps
- **P3 - LOW:** Potential edge cases and indirect vectors

**Scanning Strategy:**

1. **Static Code Analysis** - Pattern matching for vulnerable constructs
2. **Data Flow Analysis** - Trace user input to database queries
3. **Dependency Audit** - Check for known vulnerable packages
4. **Configuration Review** - Database permissions and settings

### 1.2 File Patterns to Scan

**Backend Files:**

```
- /flask_mt5_service/**/*.py
- /backend/**/*.py
- /app/api/**/*.ts
- /app/actions/**/*.ts
- /lib/db/**/*.ts
- /lib/auth/**/*.ts
- /prisma/migrations/**/*.sql
```

**Frontend Files (indirect vectors):**

```
- /app/**/*page.tsx
- /components/**/*.tsx
- /hooks/**/*.ts
```

**Configuration Files:**

```
- /prisma/schema.prisma
- /.env.example
- /docker-compose.yml
- Railway configuration
```

---

## Part 2: Vulnerability Identification Areas

### 2.1 Flask MT5 Service (P0 - CRITICAL)

**WHERE TO LOOK:**

- `flask_mt5_service/` directory
- Any Python files containing database operations
- MT5 data processing endpoints
- Symbol validation logic
- Custom SQL query builders

**WHAT TO FIND:**

#### Pattern 1: Raw SQL String Formatting

```python
# VULNERABLE PATTERNS
cursor.execute("SELECT * FROM table WHERE column = '%s'" % user_input)
cursor.execute(f"SELECT * FROM table WHERE column = '{user_input}'")
cursor.execute("SELECT * FROM table WHERE column = '" + user_input + "'")
```

#### Pattern 2: Dynamic Query Construction

```python
# VULNERABLE PATTERNS
query = "SELECT * FROM " + table_name + " WHERE id = " + user_id
sql = f"INSERT INTO {table_name} VALUES ({values})"
```

#### Pattern 3: Unsafe ORM Usage (if using SQLAlchemy)

```python
# VULNERABLE PATTERNS
session.execute(text(f"SELECT * FROM users WHERE name = '{name}'"))
session.execute(f"SELECT * FROM users WHERE email = '{email}'")
```

**DETECTION CRITERIA:**

- [ ] String concatenation in SQL queries
- [ ] f-strings or % formatting with user input
- [ ] `.format()` method on SQL strings
- [ ] Dynamic table/column names from user input
- [ ] Missing parameterized query placeholders

### 2.2 Prisma ORM Queries (P1 - HIGH)

**WHERE TO LOOK:**

- `/app/api/**/*.ts` - API route handlers
- `/app/actions/**/*.ts` - Server actions
- `/lib/db/**/*.ts` - Database utilities

**WHAT TO FIND:**

#### Pattern 1: Raw Query Usage

```typescript
// VULNERABLE PATTERNS
await prisma.$queryRaw`SELECT * FROM users WHERE email = '${email}'`;
await prisma.$executeRaw`UPDATE users SET name = '${name}' WHERE id = ${id}`;

// String concatenation in raw queries
const query = `SELECT * FROM ${tableName} WHERE id = ${userId}`;
await prisma.$queryRawUnsafe(query);
```

#### Pattern 2: Dynamic Field Access

```typescript
// VULNERABLE PATTERNS
const field = req.query.sortBy; // User controlled
await prisma.user.findMany({
  orderBy: { [field]: 'asc' },
});

// Dynamic where conditions
const filterField = searchParams.get('filter');
await prisma.alert.findMany({
  where: { [filterField]: value },
});
```

#### Pattern 3: Unsafe Query Building

```typescript
// VULNERABLE PATTERNS
const whereClause = JSON.parse(req.body.filter); // User controlled
await prisma.symbol.findMany({ where: whereClause });
```

**DETECTION CRITERIA:**

- [ ] `$queryRaw` or `$executeRaw` usage
- [ ] Template literals with `${}` in SQL
- [ ] Dynamic object keys from user input
- [ ] JSON.parse of user-provided filters
- [ ] Missing input validation before queries

### 2.3 Authentication & Authorization (P0 - CRITICAL)

**WHERE TO LOOK:**

- `/app/api/auth/**/*.ts` - NextAuth.js configuration
- `/lib/auth/**/*.ts` - Auth utilities
- Google OAuth callback handlers
- Session management logic

**WHAT TO FIND:**

#### Pattern 1: Login Bypass Vectors

```typescript
// VULNERABLE PATTERNS
const user = await prisma.user.findFirst({
  where: {
    email: credentials.email,
    password: credentials.password, // Direct comparison without hashing
  },
});

// SQL injection in credential validation
const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
```

#### Pattern 2: Session Manipulation

```typescript
// VULNERABLE PATTERNS
const userId = req.query.userId; // Attacker controlled
const session = await getSession(userId);
```

**DETECTION CRITERIA:**

- [ ] Direct password comparison without hashing
- [ ] User ID from request without validation
- [ ] Session tokens from query parameters
- [ ] Missing CSRF protection
- [ ] Weak session validation

### 2.4 User Input Processing (P1 - HIGH)

**WHERE TO LOOK:**

- Form submission handlers
- API endpoint request parsing
- Search functionality
- Filter/sort implementations
- Symbol name validation
- Alert condition parsing

**WHAT TO FIND:**

#### Pattern 1: Unvalidated Search Input

```typescript
// VULNERABLE PATTERNS
const searchTerm = req.query.q;
await prisma.symbol.findMany({
  where: {
    name: { contains: searchTerm }, // Needs validation
  },
});
```

#### Pattern 2: Dynamic Filter Construction

```typescript
// VULNERABLE PATTERNS
const filters = req.body.filters; // User controlled object
await prisma.alert.findMany({
  where: filters, // Directly using user input
});
```

#### Pattern 3: Unsafe JSON Parsing

```typescript
// VULNERABLE PATTERNS
const conditions = JSON.parse(req.body.alertConditions);
// Using conditions in database query without validation
```

**DETECTION CRITERIA:**

- [ ] Direct use of req.query/req.body in queries
- [ ] Missing input type validation
- [ ] No length restrictions on user input
- [ ] Unescaped special characters
- [ ] Missing allowlist for field names

### 2.5 API Endpoints (P1 - HIGH)

**WHERE TO LOOK:**

- `/app/api/symbols/**/*.ts`
- `/app/api/alerts/**/*.ts`
- `/app/api/user/**/*.ts`
- `/app/api/subscription/**/*.ts`

**WHAT TO FIND:**

#### Pattern 1: URL Parameter Injection

```typescript
// VULNERABLE PATTERNS
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolId = searchParams.get('id');

  // Direct use without validation
  await prisma.symbol.findUnique({ where: { id: symbolId } });
}
```

#### Pattern 2: Request Body Injection

```typescript
// VULNERABLE PATTERNS
export async function POST(req: Request) {
  const body = await req.json();

  // Direct destructuring without validation
  const { userId, symbolName, condition } = body;
  await prisma.alert.create({ data: body });
}
```

**DETECTION CRITERIA:**

- [ ] Missing Zod/validation schemas
- [ ] Direct database operations with request data
- [ ] No type checking on inputs
- [ ] Missing authorization checks
- [ ] Unvalidated enum values

### 2.6 Database Migrations (P2 - MEDIUM)

**WHERE TO LOOK:**

- `/prisma/migrations/**/*.sql`
- Prisma schema file
- Database seed scripts

**WHAT TO FIND:**

#### Pattern 1: Weak Database Permissions

```sql
-- VULNERABLE PATTERNS
GRANT ALL PRIVILEGES ON DATABASE trading_alerts TO app_user;
GRANT SUPERUSER TO app_user;
```

#### Pattern 2: Insecure Defaults

```prisma
// VULNERABLE PATTERNS
model User {
  role String @default("ADMIN") // Should be "USER"
}
```

**DETECTION CRITERIA:**

- [ ] Over-privileged database users
- [ ] Missing row-level security
- [ ] Insecure default values
- [ ] Direct SQL in migrations without params

---

## Part 3: Specific Code Locations to Audit

### 3.1 High-Priority Files (Audit First)

```
P0 - CRITICAL AUDIT:
├── flask_mt5_service/
│   ├── app.py (main Flask application)
│   ├── routes/ (API endpoints)
│   ├── services/ (MT5 data processing)
│   └── database/ (direct DB operations)
│
├── app/api/auth/ (authentication logic)
│   ├── [...nextauth]/route.ts
│   └── signin/route.ts
│
└── lib/
    ├── auth.ts (auth utilities)
    └── db.ts (database connections)
```

### 3.2 Medium-Priority Files

```
P1 - HIGH PRIORITY:
├── app/api/
│   ├── symbols/ (symbol search/CRUD)
│   ├── alerts/ (alert management)
│   ├── user/ (user management)
│   └── subscription/ (tier management)
│
├── app/actions/ (server actions)
│   ├── symbol-actions.ts
│   └── alert-actions.ts
│
└── components/ (form handlers)
    └── forms/ (input processing)
```

### 3.3 Input Validation Points

**Identify ALL locations where user input enters the system:**

1. **Form Submissions:**
   - Login forms
   - Registration forms
   - Alert creation forms
   - Symbol search forms

2. **API Query Parameters:**
   - `/api/symbols?search={term}`
   - `/api/alerts?filter={json}`
   - `/api/user/{id}`

3. **Request Bodies:**
   - POST /api/alerts
   - PUT /api/user
   - PATCH /api/subscription

4. **Headers:**
   - Authorization tokens
   - Custom headers

5. **File Uploads (if any):**
   - MT5 data imports
   - Configuration files

---

## Part 4: Detection Automation

### 4.1 Regex Patterns for Code Scanning

Use these patterns to identify potential vulnerabilities:

```regex
# Python - Raw SQL String Formatting
(execute|executemany)\s*\(\s*[f"'].*%s.*[f"'].*%
(execute|executemany)\s*\(\s*f["'].*\{.*\}.*["']
(execute|executemany)\s*\(\s*["'].*["']\s*%\s*
(execute|executemany)\s*\(\s*["'].*["']\s*\+\s*

# TypeScript - Prisma Raw Queries
\$queryRaw`.*\$\{.*\}.*`
\$executeRaw`.*\$\{.*\}.*`
\$queryRawUnsafe\(
\$executeRawUnsafe\(

# Dynamic Object Keys
\[req\.(query|body|params)\..*\]
\[searchParams\.get\(.*\)\]

# String Concatenation in Queries
["']SELECT.*["']\s*\+
["']INSERT.*["']\s*\+
["']UPDATE.*["']\s*\+
["']DELETE.*["']\s*\+
```

### 4.2 Automated Scanning Checklist

For each file scanned:

- [ ] Search for string concatenation patterns
- [ ] Identify user input sources (req, params, query)
- [ ] Trace input flow to database queries
- [ ] Check for validation/sanitization
- [ ] Verify parameterized query usage
- [ ] Confirm type checking exists
- [ ] Review error handling (doesn't leak SQL)

### 4.3 Manual Review Triggers

Flag for manual review if:

- File contains both user input AND database queries
- Raw SQL queries present
- Dynamic object property access
- JSON parsing of request data
- Complex query building logic
- Authentication/authorization code

---

## Part 5: Security Testing Plan

### 5.1 Pre-Deployment Testing (Before Phase 4)

#### Test Environment Setup

```
1. Create isolated test database (Railway staging)
2. Deploy to test environment with debug logging
3. Enable SQL query logging
4. Set up security monitoring
```

#### Test Categories

**Category A: Authentication Testing**

```
Test Cases:
1. Login SQL Injection
   - Email: admin' OR '1'='1' --
   - Password: anything

2. Login Bypass Attempts
   - Email: ' OR '1'='1' -- -
   - Email: admin'--
   - Email: ' UNION SELECT NULL--

3. Session Manipulation
   - Modify userId in cookies/tokens
   - Tamper with session data

Expected Result: All attempts should fail with proper error handling
```

**Category B: Search/Filter Testing**

```
Test Cases:
1. Symbol Search
   - Search term: ' OR '1'='1' --
   - Search term: '; DROP TABLE symbols; --
   - Search term: ' UNION SELECT * FROM users --

2. Alert Filtering
   - filter param: {"id": {"gt": 0, "lt": 999999}}
   - filter param: {"role": "ADMIN"}
   - filter JSON with SQL keywords

Expected Result: Sanitized or rejected with validation errors
```

**Category C: CRUD Operations**

```
Test Cases:
1. Create Alert with Malicious Data
   - symbolName: "EURUSD' OR '1'='1"
   - condition: "price > 1.0 OR 1=1"

2. Update User with SQL
   - name: "John'; DROP TABLE users; --"
   - email: "test@example.com' --"

3. Delete with Injection
   - ID parameter: "1 OR 1=1"
   - ID parameter: "1; DELETE FROM alerts; --"

Expected Result: Properly escaped or rejected
```

**Category D: API Endpoint Testing**

```
For each API endpoint, test:
1. URL Parameters
   - /api/symbols?id=1' OR '1'='1
   - /api/alerts?userId=1 UNION SELECT

2. Request Body
   - JSON with SQL keywords
   - Nested objects with malicious data
   - Array inputs with SQL

3. HTTP Headers
   - Custom headers with SQL
   - User-Agent with injection attempts
```

### 5.2 Automated Security Scanning

#### Tools to Use

**1. SQLMap (Automated SQL Injection Detection)**

```bash
# Test authentication endpoint
sqlmap -u "http://localhost:3000/api/auth/signin" \
  --data="email=test&password=test" \
  --method=POST \
  --level=5 \
  --risk=3

# Test symbol search
sqlmap -u "http://localhost:3000/api/symbols?search=*" \
  --level=5 \
  --risk=3

# Test all API endpoints
sqlmap -u "http://localhost:3000/api/*" \
  --crawl=3 \
  --batch
```

**2. OWASP ZAP (Comprehensive Scanning)**

```bash
# Automated scan
docker run -t owasp/zap2docker-stable \
  zap-baseline.py \
  -t http://localhost:3000 \
  -r zap-report.html

# Full scan with authentication
zap-full-scan.py \
  -t http://localhost:3000 \
  -a \
  -j \
  -r zap-full-report.html
```

**3. Bandit (Python Security Linter)**

```bash
# Scan Flask MT5 service
bandit -r flask_mt5_service/ \
  -f json \
  -o bandit-report.json

# Focus on SQL injection patterns
bandit -r flask_mt5_service/ \
  -s B608,B201 \
  -ll
```

**4. ESLint Security Plugin (TypeScript/JavaScript)**

```bash
# Add to package.json
npm install --save-dev eslint-plugin-security

# Run security scan
npx eslint . --ext .ts,.tsx \
  --plugin security \
  --format json \
  > eslint-security.json
```

### 5.3 Manual Penetration Testing

#### Test Scenarios

**Scenario 1: Privilege Escalation**

```
Objective: FREE user tries to access PRO features
Steps:
1. Create FREE tier user account
2. Attempt to add 15 symbols (PRO limit)
3. Modify subscription tier in requests
4. Try SQL injection to change user role

Test: Verify proper authorization checks exist
```

**Scenario 2: Data Exfiltration**

```
Objective: Extract other users' trading data
Steps:
1. Create user account
2. Try UNION queries to extract user table
3. Attempt to access other users' alerts
4. Use time-based blind SQL injection

Test: Verify data isolation and query filtering
```

**Scenario 3: Authentication Bypass**

```
Objective: Access system without valid credentials
Steps:
1. Test login with SQL injection payloads
2. Attempt session token manipulation
3. Try OAuth callback manipulation
4. Test password reset with SQL injection

Test: Verify all auth paths are secure
```

### 5.4 Testing Schedule

```
Phase 3.6 (Current - Flask MT5 Service):
- [ ] Static code analysis on all Flask files
- [ ] Unit tests for database functions
- [ ] Input validation tests

Pre-Phase 4 (Before Deployment):
- [ ] Full automated scan (SQLMap + ZAP)
- [ ] Manual penetration testing
- [ ] Security code review
- [ ] Dependency vulnerability scan

Phase 4 (Deployment):
- [ ] Staging environment security test
- [ ] Production security hardening
- [ ] WAF configuration
- [ ] Monitoring setup

Post-Deployment:
- [ ] Continuous security monitoring
- [ ] Regular vulnerability scans
- [ ] Penetration testing (quarterly)
```

---

## Part 6: Remediation Guidelines

### 6.1 Fix Patterns

#### For Python/Flask

**BEFORE (Vulnerable):**

```python
def get_user(email):
    query = f"SELECT * FROM users WHERE email = '{email}'"
    cursor.execute(query)
    return cursor.fetchone()
```

**AFTER (Secure):**

```python
def get_user(email):
    query = "SELECT * FROM users WHERE email = %s"
    cursor.execute(query, (email,))
    return cursor.fetchone()
```

#### For TypeScript/Prisma

**BEFORE (Vulnerable):**

```typescript
const field = req.query.sortBy;
const users = await prisma.user.findMany({
  orderBy: { [field]: 'asc' },
});
```

**AFTER (Secure):**

```typescript
const allowedFields = ['name', 'email', 'createdAt'];
const field = req.query.sortBy;

if (!allowedFields.includes(field)) {
  throw new Error('Invalid sort field');
}

const users = await prisma.user.findMany({
  orderBy: { [field as keyof User]: 'asc' },
});
```

### 6.2 Input Validation Standards

#### Implement Zod Schemas

```typescript
import { z } from 'zod';

// Define validation schema
const SymbolSearchSchema = z.object({
  search: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Z]{1,10}$/),
  limit: z.number().int().min(1).max(100).optional(),
});

// Use in API route
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Validate input
  const validated = SymbolSearchSchema.parse({
    search: searchParams.get('search'),
    limit: Number(searchParams.get('limit')) || 10,
  });

  // Safe to use validated data
  const symbols = await prisma.symbol.findMany({
    where: { name: { contains: validated.search } },
    take: validated.limit,
  });
}
```

### 6.3 Security Checklist for Each Fix

When remediating a vulnerability:

- [ ] Replace string concatenation with parameterized queries
- [ ] Add input validation (Zod schemas)
- [ ] Implement allowlisting for dynamic fields
- [ ] Add type checking
- [ ] Implement proper error handling (don't leak SQL)
- [ ] Add logging for security events
- [ ] Write unit tests for the fix
- [ ] Document the security consideration

---

## Part 7: Reporting Format

### 7.1 Vulnerability Report Structure

For each vulnerability found, create a report with:

````markdown
## Vulnerability ID: SQLI-{NUMBER}

**Severity:** CRITICAL | HIGH | MEDIUM | LOW
**Category:** Authentication | Data Access | Input Validation
**Location:** /path/to/file.ts:line_number

### Description

Brief description of the vulnerability

### Vulnerable Code

```language
[code snippet]
```
````

### Attack Vector

How an attacker could exploit this

### Proof of Concept

Example malicious input that would succeed

### Impact

- [ ] Data breach
- [ ] Authentication bypass
- [ ] Privilege escalation
- [ ] Data modification
- [ ] Denial of service

### Remediation

```language
[secure code snippet]
```

### Testing Verification

Steps to verify the fix works

````

### 7.2 Summary Report Template

```markdown
# SQL Injection Security Audit Summary
## Trading Alerts SaaS V7

**Audit Date:** {date}
**Audited By:** Claude Code
**Scope:** Full codebase

### Executive Summary
- Total files scanned: {number}
- Vulnerabilities found: {number}
- Critical: {number}
- High: {number}
- Medium: {number}
- Low: {number}

### Vulnerability Breakdown by Component
- Flask MT5 Service: {number}
- Next.js API Routes: {number}
- Authentication: {number}
- Database Layer: {number}

### Remediation Status
- Fixed: {number}
- In Progress: {number}
- Needs Review: {number}

### Risk Assessment
Overall risk level: CRITICAL | HIGH | MEDIUM | LOW

### Recommendations
1. Priority actions
2. Long-term improvements
3. Security practices to implement

### Next Steps
- Immediate actions required
- Follow-up testing needed
````

---

## Part 8: Implementation Checklist

### For Claude Code Execution:

**Step 1: Initial Scan**

- [ ] Clone/access full codebase
- [ ] Identify all database-touching files
- [ ] Create file inventory with priority levels
- [ ] Run automated regex patterns

**Step 2: Detailed Analysis**

- [ ] Audit Flask MT5 service (P0)
- [ ] Review Prisma queries (P1)
- [ ] Check authentication flows (P0)
- [ ] Examine API endpoints (P1)
- [ ] Validate input handling (P1)

**Step 3: Vulnerability Documentation**

- [ ] Create vulnerability reports
- [ ] Categorize by severity
- [ ] Document attack vectors
- [ ] Provide remediation code

**Step 4: Fix Implementation**

- [ ] Apply fixes (if authorized)
- [ ] Write unit tests
- [ ] Update documentation
- [ ] Commit changes with security notes

**Step 5: Verification**

- [ ] Re-scan fixed code
- [ ] Run security tests
- [ ] Validate no new vulnerabilities introduced
- [ ] Generate final report

**Step 6: Testing Plan Execution**

- [ ] Set up test environment
- [ ] Run automated scans (SQLMap, ZAP)
- [ ] Execute manual test cases
- [ ] Document test results
- [ ] Create security certification report

---

## Part 9: Success Criteria

### Code Security Targets

**Must Achieve:**

- [ ] ZERO P0 (Critical) vulnerabilities
- [ ] ZERO P1 (High) vulnerabilities in production paths
- [ ] 100% of database queries use parameterized queries
- [ ] 100% of user inputs validated with Zod/similar
- [ ] All authentication flows secured

**Should Achieve:**

- [ ] <5 P2 (Medium) vulnerabilities
- [ ] Input validation on all API endpoints
- [ ] Comprehensive error handling
- [ ] Security logging implemented

**Nice to Have:**

- [ ] Security unit test coverage >80%
- [ ] Automated security CI/CD checks
- [ ] Comprehensive security documentation

### Testing Targets

- [ ] Pass SQLMap automated scan (0 findings)
- [ ] Pass OWASP ZAP baseline scan
- [ ] Pass manual penetration test scenarios
- [ ] No SQL injection in authentication flows
- [ ] No data leakage in error messages

---

## Part 10: Reference Materials

### SQL Injection Payloads for Testing

```sql
-- Authentication Bypass
' OR '1'='1' --
' OR '1'='1' /*
admin'--
admin' #
' OR 1=1--

-- UNION-based
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT username, password FROM users--

-- Boolean-based Blind
' AND 1=1--
' AND 1=2--

-- Time-based Blind
'; WAITFOR DELAY '00:00:05'--
' OR SLEEP(5)--

-- Stacked Queries
'; DROP TABLE users;--
'; INSERT INTO users VALUES ('hacker','pass');--

-- PostgreSQL Specific
'; SELECT pg_sleep(5)--
' OR 1=1; SELECT version();--
```

### Safe Coding Patterns

**Always Use:**

- Parameterized queries
- ORM query builders
- Input validation libraries
- Type checking
- Allowlisting for dynamic values

**Never Use:**

- String concatenation in SQL
- f-strings with user input in queries
- Direct use of req.body/req.query in queries
- Dynamic table/column names from users
- eval() or similar dynamic code execution

---

## Part 11: Continuous Security

### Post-Fix Monitoring

**Implement:**

1. **Query Logging**
   - Log all database queries in staging
   - Monitor for suspicious patterns
   - Alert on SQL keywords in user input

2. **Rate Limiting**
   - Limit login attempts
   - Rate limit API endpoints
   - Block after failed SQL injection attempts

3. **WAF Rules**
   - Block common SQL injection patterns
   - Detect and alert on attack attempts
   - Maintain blocklist of malicious IPs

4. **Regular Scanning**
   - Weekly automated security scans
   - Monthly manual penetration testing
   - Quarterly third-party security audit

### Security Maintenance Schedule

```
Daily:
- Review security logs
- Monitor rate limit violations
- Check WAF alerts

Weekly:
- Automated vulnerability scan
- Dependency security updates
- Review user feedback for security issues

Monthly:
- Manual security review of new code
- Penetration testing
- Update security documentation

Quarterly:
- Comprehensive security audit
- Third-party security assessment
- Security training review
```

---

## Appendix A: Project-Specific Context

### Tech Stack Security Considerations

**Next.js 15:**

- Server actions need CSRF protection
- API routes require authentication middleware
- Edge runtime limitations

**Prisma ORM:**

- Generally safe but watch for raw queries
- Type safety helps prevent injection
- Migration files need review

**Flask:**

- No built-in SQL protection
- Must use parameterized queries
- Requires manual input validation

**PostgreSQL on Railway:**

- Connection string security
- Database user permissions
- Row-level security policies

### Business Logic Security

**Two-Tier Model:**

- Prevent FREE users accessing PRO features via SQL injection
- Validate subscription tier on all queries
- Ensure symbol limits enforced at DB level

**MT5 Integration:**

- Validate symbol names before MT5 queries
- Sanitize MT5 data before database insertion
- Secure API keys and credentials

---

## Appendix B: Quick Reference

### Critical Files Priority List

```
AUDIT THESE FIRST:
1. flask_mt5_service/app.py
2. flask_mt5_service/routes/*.py
3. app/api/auth/[...nextauth]/route.ts
4. lib/auth.ts
5. lib/db.ts

THEN THESE:
6. app/api/symbols/**/*.ts
7. app/api/alerts/**/*.ts
8. app/actions/**/*.ts
9. components/forms/**/*.tsx

FINALLY:
10. Database migrations
11. Configuration files
12. Environment variables
```

### Common Vulnerability Patterns

| Pattern                  | Severity | Action          |
| ------------------------ | -------- | --------------- |
| f-string in SQL          | CRITICAL | Immediate fix   |
| String concat in SQL     | CRITICAL | Immediate fix   |
| Dynamic object keys      | HIGH     | Add validation  |
| Missing input validation | HIGH     | Add Zod schema  |
| Raw Prisma queries       | MEDIUM   | Review & secure |
| Unvalidated enum values  | MEDIUM   | Add allowlist   |

---

## Document Control

**Version History:**

- v1.0 - Initial creation for Trading Alerts SaaS V7 security audit

**Related Documents:**

- OpenAPI Specification (Phase 1)
- Build Orders (Phase 2)
- Security Policy (to be created)

**Approval Status:**

- Awaiting Claude Code implementation
- Security fixes require developer review before merge

---

**END OF IMPLEMENTATION GUIDE**

_This document is to be used by Claude Code (web) for autonomous security scanning and vulnerability remediation of the Trading Alerts SaaS V7 codebase._
