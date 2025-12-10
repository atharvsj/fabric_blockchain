# Hyperledger Fabric Backend API

A Node.js backend application for interacting with Hyperledger Fabric blockchain network. This project provides RESTful API endpoints for submitting and querying chaincode transactions, user authentication with JWT, and identity management.

## 📁 Project Structure

```
backend/
├── app.js                     # Main application entry point
├── package.json               # Dependencies and scripts
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── config/
│   ├── connection-profile.json  # Fabric network connection profile
│   └── fabric.config.js         # Fabric configuration settings
├── controllers/
│   ├── auth.controller.js       # Authentication controller
│   └── fabric.controller.js     # Fabric operations controller
├── middleware/
│   └── auth.middleware.js       # JWT authentication middleware
├── routes/
│   ├── index.js                 # Main routes aggregator
│   ├── auth.routes.js           # Authentication routes
│   └── fabric.routes.js         # Fabric operation routes
├── services/
│   ├── auth.service.js          # Authentication business logic
│   └── fabric.service.js        # Fabric network interactions
├── utils/
│   ├── error.handler.js         # Error handling utilities
│   ├── logger.js                # Logging utility
│   └── response.helper.js       # API response helpers
└── wallet/                      # Identity wallet storage (auto-created)
```

## 🚀 Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v14.x or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Hyperledger Fabric Network** (for production use)
   - Follow the Fabric documentation to set up a network
   - https://hyperledger-fabric.readthedocs.io/

## 📦 Installation

### Step 1: Navigate to the backend folder

```bash
cd backend
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Create environment file

Copy the example environment file and configure it:

```bash
# Windows (Command Prompt)
copy .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

### Step 4: Configure the environment

Edit the `.env` file with your settings:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secure-secret-key
CHANNEL_NAME=mychannel
CHAINCODE_NAME=basic
```

## 🔧 Configuration

### Connection Profile

Update `config/connection-profile.json` with your Fabric network details:

- Peer URLs and TLS certificates
- Orderer URLs and TLS certificates
- Certificate Authority (CA) configuration
- Organization MSP settings

### Fabric Configuration

Modify `config/fabric.config.js` to match your network:

- Channel name
- Chaincode name
- MSP ID
- CA settings

## 🏃 Running the Application

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## 📡 API Endpoints

### Health Check

```http
GET /api/health
```

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/profile` | Get user profile (protected) |
| POST | `/api/auth/refresh` | Refresh JWT token (protected) |

### Fabric Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fabric/enroll-admin` | Enroll admin user (admin only) |
| POST | `/api/fabric/register-user` | Register new Fabric user (admin only) |
| POST | `/api/fabric/submit` | Submit transaction to ledger |
| POST | `/api/fabric/query` | Query data from ledger |
| GET | `/api/fabric/identities` | List all identities (admin only) |
| GET | `/api/fabric/identity/:userId` | Check if identity exists |

## 📝 API Usage Examples

### Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123", "role": "user"}'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "password123"}'
```

### Submit Transaction (with JWT)

```bash
curl -X POST http://localhost:3000/api/fabric/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "user1",
    "functionName": "CreateAsset",
    "args": ["asset1", "blue", "10", "owner1", "100"]
  }'
```

### Query Transaction (with JWT)

```bash
curl -X POST http://localhost:3000/api/fabric/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "user1",
    "functionName": "ReadAsset",
    "args": ["asset1"]
  }'
```

## 🔐 JWT Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Roles

- **user**: Can query and submit transactions
- **admin**: Full access including user management

## 🛠️ Development

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Start | `npm start` | Run in production mode |
| Dev | `npm run dev` | Run with nodemon (auto-reload) |
| Test | `npm test` | Run tests |

### Adding New Chaincode Functions

1. Update your chaincode with new functions
2. Use the `/api/fabric/submit` or `/api/fabric/query` endpoints
3. Pass the function name and arguments in the request body

## 🐛 Troubleshooting

### Common Issues

1. **"User does not exist in the wallet"**
   - Ensure the admin is enrolled first
   - Register the user using `/api/fabric/register-user`

2. **"Failed to connect to Fabric network"**
   - Check if the Fabric network is running
   - Verify connection profile paths
   - Check TLS certificate paths

3. **"Invalid token"**
   - Token may have expired (default: 24h)
   - Use the `/api/auth/refresh` endpoint
   - Re-login to get a new token

### Debugging

Set `NODE_ENV=development` in `.env` for:
- Detailed error messages
- Debug logging
- Stack traces in responses

## 📚 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18.2 | Web framework |
| fabric-network | ^2.2.20 | Fabric SDK for transactions |
| fabric-ca-client | ^2.2.20 | Fabric CA for identity management |
| jsonwebtoken | ^9.0.2 | JWT authentication |
| bcryptjs | ^2.4.3 | Password hashing |
| dotenv | ^16.3.1 | Environment variables |
| cors | ^2.8.5 | Cross-origin resource sharing |
| nodemon | ^3.0.2 | Development auto-reload |

## 📄 License

ISC

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
