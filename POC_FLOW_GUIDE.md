# POC Flow Guide - Blockchain Audit Trail System

## 🎯 Overview

This system creates an **immutable audit trail** for user data by storing cryptographic hashes on the **Polygon blockchain**. Every create, update, and delete operation is recorded on-chain for tamper-proof verification.

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│  Backend API    │────▶│   PostgreSQL    │
│    (React)      │     │   (Port 3000)   │     │   (Off-chain)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ Blockchain API  │────▶│ Polygon Amoy    │
                        │   (Port 5000)   │     │   (On-chain)    │
                        └─────────────────┘     └─────────────────┘
```

---

## 📊 Database Tables

| Table | Purpose |
|-------|---------|
| `ci_erp_users` | Main user data (name, email, etc.) |
| `ci_erp_users_details` | Additional user details |
| `user_chain_records` | Audit trail with blockchain proof |

### user_chain_records Structure

| Column | Description |
|--------|-------------|
| `id` | UUID primary key |
| `user_id` | Reference to ci_erp_users |
| `data_json` | Snapshot of user data at that point |
| `hash_value` | SHA-256 hash of the data |
| `blockchain_tx_id` | Polygon transaction hash |
| `operation_type` | INSERT, UPDATE, DELETE |
| `blockchain_status` | P (Pending), A (Approved), R (Rejected) |
| `created_at` | Timestamp |

---

## 🔄 Complete Flow

### Flow 1: Creating a New User

```
Frontend                    Backend (3000)              Blockchain API (5000)        Polygon
   │                             │                              │                       │
   │  POST /api/users            │                              │                       │
   │  {name, email, ...}         │                              │                       │
   │────────────────────────────▶│                              │                       │
   │                             │                              │                       │
   │                             │  1. Insert into ci_erp_users │                       │
   │                             │  2. Compute SHA-256 hash     │                       │
   │                             │                              │                       │
   │                             │  POST /api/submit-change     │                       │
   │                             │  {userId, hash}              │                       │
   │                             │─────────────────────────────▶│                       │
   │                             │                              │                       │
   │                             │                              │  Store hash on-chain  │
   │                             │                              │──────────────────────▶│
   │                             │                              │                       │
   │                             │                              │  Return txHash        │
   │                             │                              │◀──────────────────────│
   │                             │                              │                       │
   │                             │  Return txHash               │                       │
   │                             │◀─────────────────────────────│                       │
   │                             │                              │                       │
   │                             │  3. Save to user_chain_records                       │
   │                             │     (status = 'P')           │                       │
   │                             │                              │                       │
   │  Return user + txHash       │                              │                       │
   │◀────────────────────────────│                              │                       │
```

### Flow 2: Approving a Change

```
Frontend (Admin)            Blockchain API (5000)        Polygon           PostgreSQL
   │                              │                        │                    │
   │  POST /api/approve           │                        │                    │
   │  {id: 0, reason: "OK"}       │                        │                    │
   │─────────────────────────────▶│                        │                    │
   │                              │                        │                    │
   │                              │  1. Get hash from chain│                    │
   │                              │─────────────────────────▶                   │
   │                              │◀─────────────────────────                   │
   │                              │                        │                    │
   │                              │  2. Approve on-chain   │                    │
   │                              │─────────────────────────▶                   │
   │                              │◀─────────────────────────                   │
   │                              │                        │                    │
   │                              │  3. Update blockchain_status = 'A'          │
   │                              │────────────────────────────────────────────▶│
   │                              │                        │                    │
   │  Return success              │                        │                    │
   │◀─────────────────────────────│                        │                    │
```

---

## 📝 Step-by-Step API Usage

### Step 1: Create a User

**Frontend calls:**
```http
POST http://localhost:3000/api/users
Content-Type: application/json

{
  "email": "john@example.com",
  "username": "johndoe",
  "first_name": "John",
  "last_name": "Doe",
  "contact_number": "9876543210",
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
    "user": {
      "user_id": "501",
      "email": "john@example.com",
      "first_name": "John"
    },
    "chainRecord": {
      "id": "abc-123-uuid",
      "hash_value": "0x7f83b1657ff1fc53b92dc18148a1d65d...",
      "blockchain_tx_id": "0x23d023bb06bdd869e5...",
      "operation_type": "INSERT",
      "blockchain_status": "P"
    }
  }
}
```

✅ **What happened:**
- User saved to database
- Hash stored on Polygon blockchain
- Audit record created with status **Pending**

---

### Step 2: View Pending Changes (Admin Dashboard)

**Frontend calls:**
```http
GET http://localhost:5000/api/get-pending-changes
```

**Response:**
```json
{
  "success": true,
  "pendingChanges": [
    {
      "id": 0,
      "userId": "139051037483306",
      "hash": "0x7f83b1657ff1fc53b92dc18148a1d65d...",
      "reason": ""
    }
  ],
  "count": 1
}
```

---

### Step 3: Approve the Change (Admin Action)

**Frontend calls:**
```http
POST http://localhost:5000/api/approve
Content-Type: application/json

{
  "id": 0,
  "reason": "Verified user documents - Approved by Admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Approved successfully",
  "txHash": "0x456def...",
  "offChainUpdated": true,
  "offChainRecord": {
    "id": "abc-123-uuid",
    "user_id": "501",
    "blockchain_status": "A"
  }
}
```

✅ **What happened:**
- Blockchain status changed to **Approved** on-chain
- Database `blockchain_status` updated to **'A'**

---

### Step 4: Update a User

**Frontend calls:**
```http
PUT http://localhost:3000/api/users/501
Content-Type: application/json

{
  "email": "john.updated@example.com",
  "city": "Delhi"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "user_id": "501", "email": "john.updated@example.com" },
    "chainRecord": {
      "operation_type": "UPDATE",
      "blockchain_status": "P",
      "blockchain_tx_id": "0x789abc..."
    }
  }
}
```

✅ **What happened:**
- User data updated in database
- **NEW** hash created and stored on blockchain
- **NEW** audit record created with status **Pending**

---

### Step 5: View User's Audit Trail

**Frontend calls:**
```http
GET http://localhost:3000/api/users/501/chain-records
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "501",
    "chainRecords": [
      {
        "id": "abc-123",
        "operation_type": "INSERT",
        "blockchain_status": "A",
        "blockchain_tx_id": "0x23d023bb...",
        "created_at": "2025-12-17T10:00:00Z"
      },
      {
        "id": "def-456",
        "operation_type": "UPDATE",
        "blockchain_status": "P",
        "blockchain_tx_id": "0x789abc...",
        "created_at": "2025-12-17T11:00:00Z"
      }
    ],
    "total": 2
  }
}
```

**With status filter:**
```http
GET http://localhost:3000/api/users/501/chain-records?status=P
```

---

### Step 6: Delete a User

**Frontend calls:**
```http
DELETE http://localhost:3000/api/users/501
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "501",
    "message": "User deleted successfully",
    "onChainProof": {
      "hash": "0xdel123...",
      "transactionId": "0xabc789...",
      "timestamp": "2025-12-17T12:00:00Z"
    }
  }
}
```

✅ **What happened:**
- Delete hash stored on blockchain **BEFORE** deletion
- Audit record created with `operation_type: DELETE`
- User deleted from `ci_erp_users`

---

## 🔐 Blockchain Status Values

| Status | Code | Meaning |
|--------|------|---------|
| Pending | `P` | Waiting for admin approval |
| Approved | `A` | Verified and approved |
| Rejected | `R` | Rejected (data issue found) |

---

## 👥 Role Responsibilities

### Frontend Developer

| Task | API to Use |
|------|------------|
| Create user form | `POST /api/users` |
| Edit user form | `PUT /api/users/:id` |
| Delete user | `DELETE /api/users/:id` |
| View user list | `GET /api/users` |
| View single user | `GET /api/users/:id` |
| View audit trail | `GET /api/users/:id/chain-records` |
| Admin: View pending | `GET /api/get-pending-changes` |
| Admin: Approve | `POST /api/approve` |
| Admin: Reject | `POST /api/reject` |

### Backend Developer

| Task | Details |
|------|---------|
| Run backend server | `cd backend && npm start` (Port 3000) |
| Run blockchain server | `cd sc_blockchain && npm start` (Port 5000) |
| Database setup | PostgreSQL with `fabric_test` schema |
| Blockchain wallet | Fund with POL tokens on Amoy testnet |

---

## 🚀 Quick Start for POC Demo

### 1. Start Servers

```bash
# Terminal 1 - Backend API
cd backend
npm start
# Running on http://localhost:3000

# Terminal 2 - Blockchain API
cd sc_blockchain
npm start
# Running on http://localhost:5000
```

### 2. Demo Sequence

1. **Create User** → Show transaction on [Polygon Explorer](https://amoy.polygonscan.com/)
2. **View Pending Changes** → Show admin dashboard
3. **Approve Change** → Show status change
4. **Update User** → Show new blockchain transaction
5. **View Audit Trail** → Show complete history
6. **Verify Hash** → Compare DB hash with blockchain hash

### 3. Verify on Blockchain Explorer

Use transaction hash to view on: `https://amoy.polygonscan.com/tx/{txHash}`

---

## 📋 API Quick Reference

### Backend APIs (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get single user |
| POST | `/api/users` | Create user + blockchain |
| PUT | `/api/users/:id` | Update user + blockchain |
| DELETE | `/api/users/:id` | Delete user + blockchain |
| GET | `/api/users/:id/chain-records` | View audit trail |

### Blockchain APIs (Port 5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submit-change` | Store hash on blockchain |
| POST | `/api/approve` | Approve pending change |
| POST | `/api/reject` | Reject pending change |
| GET | `/api/get-change/:id` | Get single change |
| GET | `/api/get-pending-changes` | List pending changes |
| GET | `/api/get-all-changes` | List all changes |
| GET | `/api/info` | Wallet/contract info |
| GET | `/api/stats` | Transaction statistics |

---

## ✅ POC Checklist

- [ ] Backend server running on port 3000
- [ ] Blockchain server running on port 5000
- [ ] PostgreSQL database with `fabric_test` schema
- [ ] Wallet funded with POL tokens
- [ ] Create a test user
- [ ] Verify transaction on Polygon Explorer
- [ ] Approve the change
- [ ] Update the user
- [ ] View complete audit trail
- [ ] Demonstrate tamper-proof verification

---

## 🔗 Useful Links

- **Polygon Explorer (Amoy Testnet):** https://amoy.polygonscan.com/
- **Smart Contract:** https://amoy.polygonscan.com/address/0x8638b93cad13f716f3f22abe5ec5432fd2f4aabf
- **Wallet:** https://amoy.polygonscan.com/address/0x80c6be4940c82bdeac275ab462387fbf54625fc5
- **Get Test POL:** https://faucet.polygon.technology/
