# API Documentation

## Overview

This project has two API servers:
1. **Backend API** (Node.js/Express) - Port 3000 - Handles off-chain database operations
2. **Blockchain API** (sc_blockchain) - Port 5000 - Handles on-chain Polygon operations

---

## Backend API (http://localhost:3000)

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check if API is running |

---

## User APIs (ci_erp_users + user_chain_records)

### 1. Get All Users

```
GET /api/users?limit=50&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "total": 500,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 2. Get User by ID

```
GET /api/users/:userId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "user_id": "166", "first_name": "John", ... },
    "details": { ... },
    "chainRecords": [...]
  }
}
```

---

### 3. Create User (POST) - Stores in DB + Blockchain

```
POST /api/users
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "newuser",
  "first_name": "John",
  "last_name": "Doe",
  "contact_number": "1234567890",
  "gender": "1",
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India",
  "is_active": "1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "user_id": "501", ... },
    "chainRecord": {
      "id": "uuid",
      "user_id": "501",
      "hash_value": "0x...",
      "blockchain_tx_id": "0x...",
      "operation_type": "INSERT"
    },
    "onChainProof": {
      "hash": "0x...",
      "transactionId": "0x...",
      "timestamp": "2025-12-17T..."
    }
  }
}
```

---

### 4. Update User (PUT) - Updates DB + Creates new Blockchain record

```
PUT /api/users/:userId
Content-Type: application/json

{
  "first_name": "Updated Name",
  "email": "updated@example.com",
  "city": "Delhi"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "chainRecord": {
      "operation_type": "UPDATE",
      ...
    },
    "onChainProof": { ... }
  }
}
```

---

### 5. Delete User

```
DELETE /api/users/:userId
```

**Response:**
```json
{
  "success": true,
  "data": { "userId": "166" },
  "message": "User deleted successfully"
}
```

---

### 6. Get All Chain Records

```
GET /api/users/chain-records?limit=50&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "uuid",
        "user_id": "166",
        "data_json": { ... },
        "hash_value": "0x...",
        "blockchain_tx_id": "0x...",
        "operation_type": "INSERT",
        "created_at": "2025-12-17T..."
      }
    ],
    "total": 10
  }
}
```

---

### 7. Get Chain Records for Specific User

```
GET /api/users/:userId/chain-records
```

---

### 8. Verify User Data Integrity

```
GET /api/users/:userId/verify
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "reason": "Data integrity verified - hash matches blockchain record",
    "currentHash": "0x...",
    "storedHash": "0x...",
    "blockchainTxId": "0x...",
    "lastRecordedAt": "2025-12-17T..."
  }
}
```

---

### 9. Manually Submit User to Blockchain

```
POST /api/users/:userId/submit-to-blockchain
```

---

## Blockchain API (http://localhost:5000)

### 1. Submit Change (Store Hash)

```
POST /api/submit-change
Content-Type: application/json

{
  "userId": "139051037483306",
  "hash": "0x1d4058c310fc2315c1..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Change request submitted",
  "txHash": "0x23d023bb06bdd869e5..."
}
```

---

### 2. Approve Change

```
POST /api/approve
Content-Type: application/json

{
  "id": 0,
  "reason": "Verified and approved by admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Approved successfully",
  "txHash": "0x..."
}
```

---

### 3. Reject Change

```
POST /api/reject
Content-Type: application/json

{
  "id": 0,
  "reason": "Data mismatch found"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rejected successfully",
  "txHash": "0x..."
}
```

---

### 4. Get Single Change by ID

```
GET /api/get-change/:id
```

**Response:**
```json
{
  "success": true,
  "change": {
    "id": 0,
    "userId": "139051037483306",
    "hash": "0x...",
    "status": 0,
    "reason": ""
  }
}
```

**Status Values:**
- `0` = Pending
- `1` = Approved
- `2` = Rejected

---

### 5. Get All Changes (Paginated)

```
GET /api/get-all-changes?start=0&limit=10
```

**Response:**
```json
{
  "success": true,
  "changes": [
    {
      "id": 0,
      "userId": "139051037483306",
      "hash": "0x...",
      "status": 0,
      "statusText": "Pending",
      "reason": ""
    }
  ],
  "count": 10
}
```

---

### 6. Get Pending Changes Only

```
GET /api/get-pending-changes?limit=20
```

**Response:**
```json
{
  "success": true,
  "pendingChanges": [...],
  "count": 5
}
```

---

### 7. Get Wallet/Contract Info

```
GET /api/info
```

**Response:**
```json
{
  "success": true,
  "info": {
    "walletAddress": "0x80c6be49...",
    "balance": "1000000000000000000",
    "balanceInPOL": "1.000000",
    "contractAddress": "0x8638b93c...",
    "network": {
      "name": "matic-amoy",
      "chainId": 80002
    }
  }
}
```

---

### 8. Get Transaction Stats

```
GET /api/stats?maxId=100
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalChanges": 25,
    "pending": 10,
    "approved": 12,
    "rejected": 3
  }
}
```

---

## API Summary Table

### Backend APIs (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users |
| GET | `/api/users/:userId` | Get user by ID |
| POST | `/api/users` | Create user + blockchain |
| PUT | `/api/users/:userId` | Update user + blockchain |
| DELETE | `/api/users/:userId` | Delete user |
| GET | `/api/users/chain-records` | Get all chain records |
| GET | `/api/users/:userId/chain-records` | Get user's chain records |
| GET | `/api/users/:userId/verify` | Verify data integrity |
| POST | `/api/users/:userId/submit-to-blockchain` | Manual blockchain submit |

### Blockchain APIs (Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submit-change` | Submit hash to blockchain |
| POST | `/api/approve` | Approve a pending change |
| POST | `/api/reject` | Reject a pending change |
| GET | `/api/get-change/:id` | Get single change |
| GET | `/api/get-all-changes` | Get all changes (paginated) |
| GET | `/api/get-pending-changes` | Get pending changes |
| GET | `/api/info` | Get wallet/contract info |
| GET | `/api/stats` | Get transaction statistics |

---

## Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│             │     │  (Port 3000)│     │  (Off-chain)│
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                   ┌─────────────┐     ┌─────────────┐
                   │ sc_blockchain│────▶│   Polygon   │
                   │  (Port 5000)│     │  (On-chain) │
                   └─────────────┘     └─────────────┘
```

## Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error info"
}
```
