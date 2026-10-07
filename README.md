# DevTinder — Backend

**Developer networking and real-time collaboration API**

DevTinder backend is a production-grade REST API and real-time Socket.IO server built with Express, MongoDB, and JWT authentication. It powers developer discovery through skill-based matching, one-on-one messaging, WebRTC signaling for video calls, connection requests, and collaborative features.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      DevTinder Backend                            │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Express.js  │  │   MongoDB    │  │  Socket.IO   │           │
│  │   v4.21.2    │  │   Mongoose   │  │   v4.8.1     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Authentication Layer                     │   │
│  │  • JWT (httpOnly cookies, 7-day expiry)                  │   │
│  │  • bcrypt password hashing (10 rounds)                   │   │
│  │  • validator.js (email, password, phone validation)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    REST API Routes                        │   │
│  │  • /auth          • /request                              │   │
│  │  • /profile       • /chat                                 │   │
│  │  • /feed          • /projects (planned)                   │   │
│  │                   • /challenges (planned)                 │   │
│  │                   • /activity (planned)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Real-Time Socket.IO Events                   │   │
│  │  • sendMessage        • startCall                         │   │
│  │  • typing             • answerCall                        │   │
│  │  • messageRead        • endCall                           │   │
│  │  • notification       • callRejected                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Middleware & Security                     │   │
│  │  • CORS (credentials: true, origin allowlist)            │   │
│  │  • cookie-parser (JWT extraction)                        │   │
│  │  • express.json (request body parsing)                   │   │
│  │  • Custom auth middleware (userAuth)                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                             ↓ ↑
┌──────────────────────────────────────────────────────────────────┐
│                      MongoDB Atlas / Local                        │
│       Collections: users, connectionRequests, messages            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 18.x+ | JavaScript runtime |
| **Framework** | Express | 4.21.2 | REST API server, routing |
| **Database** | MongoDB | 6.x+ | NoSQL document database |
| **ODM** | Mongoose | 8.8.4 | Schema modeling, validation |
| **Authentication** | JWT (jsonwebtoken) | 9.0.2 | Token-based auth |
| **Password Hashing** | bcrypt | 5.1.1 | Secure password storage |
| **Validation** | validator | 13.12.0 | Email, password, phone validation |
| **Real-Time** | Socket.IO | 4.8.1 | WebSocket messaging, typing, calls |
| **CORS** | cors | 2.8.5 | Cross-origin resource sharing |
| **Cookie Parsing** | cookie-parser | 1.4.7 | JWT extraction from cookies |

---

## REST API Reference

All API endpoints are prefixed with the backend base URL (e.g., `http://localhost:3000`).

### Authentication Routes (`/auth`)

| Method | Endpoint | Auth Required | Request Body | Response | Description |
|--------|----------|---------------|--------------|----------|-------------|
| **POST** | `/auth/signUp` | No | `{ firstName, lastName, email, password, phone?, skills?, bio?, experience?, location?, github?, portfolio? }` | `{ user, token }` | Register new user account |
| **POST** | `/auth/login` | No | `{ email, password }` | `{ user, token }` | Authenticate user and set JWT cookie |
| **POST** | `/auth/logout` | Yes | — | `{ message }` | Clear JWT cookie and log out |

**Notes:**
- JWT token is set as an httpOnly cookie (`token`) with 7-day expiry, `SameSite=Lax`, `secure=true` in production.
- Password must be 8+ characters with at least one uppercase, one lowercase, one digit, and one special character.
- Email validation via `validator.isEmail()`.

---

### Profile Routes (`/profile`)

| Method | Endpoint | Auth Required | Request Body | Response | Description |
|--------|----------|---------------|--------------|----------|-------------|
| **GET** | `/profile/view` | Yes | — | `{ user }` | Get logged-in user's profile |
| **PATCH** | `/profile/edit` | Yes | `{ firstName?, lastName?, skills?, bio?, experience?, location?, github?, portfolio?, currentlyBuilding? }` | `{ user }` | Update logged-in user's profile |
| **PATCH** | `/profile/photo` | Yes | `{ photoUrl }` | `{ user }` | Update profile photo URL (Cloudinary) |
| **GET** | `/profile/view/:userId` | Yes | — | `{ user }` | Get another user's public profile by ID |

**Notes:**
- `skills` array: strings like `["React", "Node.js", "Python"]`.
- `experience` enum: `"Student"`, `"Junior"`, `"Mid-level"`, `"Senior"`, `"Staff"`, `"Principal"`.
- Profile photo upload is client-side (Cloudinary unsigned preset), then URL is saved via `/profile/photo`.

---

### Feed Routes (`/feed`)

| Method | Endpoint | Auth Required | Query Params | Response | Description |
|--------|----------|---------------|--------------|----------|-------------|
| **GET** | `/feed` | Yes | `?page=1&limit=10&skills=React,Node.js&experience=Mid-level` | `{ users: [], hasMore, totalPages }` | Get swipeable developer feed (excludes self, existing connections, pending requests) |

**Notes:**
- Pagination via `page` and `limit` (default: 10 per page).
- Filters: `skills` (comma-separated), `experience`, `location`.
- Returns users who are not already connected or have pending requests with the logged-in user.

---

### Connection Request Routes (`/request`)

| Method | Endpoint | Auth Required | Request Body | Response | Description |
|--------|----------|---------------|--------------|----------|-------------|
| **POST** | `/request/send/:targetUserId` | Yes | `{ message? }` | `{ connectionRequest }` | Send connection request (interested/superlike) |
| **POST** | `/request/review/:requestId/:status` | Yes | — | `{ connectionRequest, match? }` | Accept or reject connection request (`status`: `"accepted"` or `"rejected"`) |
| **GET** | `/request/received` | Yes | `?page=1&limit=10` | `{ requests: [] }` | Get received connection requests (pending) |
| **GET** | `/request/status/:userId` | Yes | — | `{ status, request? }` | Check connection status with another user (`"none"`, `"pending"`, `"accepted"`, `"rejected"`) |

**Notes:**
- `/request/send` creates a `connectionRequest` document with status `"interested"`.
- `/request/review` with `"accepted"` creates mutual connection and triggers Socket.IO `notification` event for both users if a match occurs.
- Requests are one-directional: A → B. Mutual acceptance creates a match.

---

### Chat Routes (`/chat`)

| Method | Endpoint | Auth Required | Response | Description |
|--------|----------|---------------|----------|-------------|
| **GET** | `/chat/:userId` | Yes | `{ messages: [], user: { firstName, lastName, photoUrl } }` | Get conversation history with a user (returns messages sorted by `createdAt` ASC) |

**Notes:**
- Chat messages are stored in `messages` collection with `senderId`, `receiverId`, `content`, `createdAt`, `readAt`.
- Real-time messaging happens via Socket.IO (`sendMessage` event). This endpoint is for loading history only.
- Only returns messages between the logged-in user and the specified `userId`.

---

### Projects, Challenges, Activity (Planned)

| Method | Endpoint | Auth Required | Response | Description |
|--------|----------|---------------|----------|-------------|
| **GET** | `/projects` | Yes | `{ projects: [] }` | List collaborative project postings |
| **POST** | `/projects` | Yes | `{ title, description, techStack, lookingFor }` | Create new project post |
| **GET** | `/challenges` | Yes | `{ currentChallenge, pastChallenges: [] }` | Get weekly coding challenges |
| **POST** | `/challenges/:challengeId/submit` | Yes | `{ code, language }` | Submit challenge solution |
| **GET** | `/activity` | Yes | `{ stories: [] }` | Get developer activity feed/status posts |
| **POST** | `/activity` | Yes | `{ content }` | Post developer status update |

**Status:** Backend endpoints for these features are placeholders or return mock data. Frontend components are ready; backend implementation is pending.

---

## Socket.IO Event Reference

Socket.IO server runs on the same port as the Express server with CORS configured for the frontend origin.

### Connection

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `connection` | Server → Client | `{ socket }` | Socket connected; user should emit `authenticate` to associate socket with userId |
| `authenticate` | Client → Server | `{ userId }` | Associate socket connection with user ID |
| `disconnect` | Server → Client | — | Socket disconnected |

---

### Chat Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `sendMessage` | Client → Server | `{ receiverId, content, tempId? }` | Send a chat message |
| `newMessage` | Server → Client | `{ message: { _id, senderId, receiverId, content, createdAt } }` | New message received |
| `typing` | Client → Server | `{ receiverId }` | User is typing |
| `userTyping` | Server → Client | `{ userId }` | Another user is typing |
| `messageRead` | Client → Server | `{ messageId }` | Mark message as read |
| `messageReadConfirm` | Server → Client | `{ messageId, readAt }` | Message read receipt |

---

### Call Signaling Events (WebRTC)

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `startCall` | Client → Server | `{ targetUserId, peerId, callType: "audio" \| "video" }` | Initiate call |
| `incomingCall` | Server → Client | `{ from: { userId, firstName, lastName, photoUrl }, peerId, callType }` | Incoming call notification |
| `answerCall` | Client → Server | `{ callerId, peerId }` | Accept incoming call |
| `callAnswered` | Server → Client | `{ peerId }` | Call was answered by other party |
| `endCall` | Client → Server | `{ targetUserId }` | End call |
| `callEnded` | Server → Client | `{ userId }` | Call ended by other party |
| `callRejected` | Client → Server | `{ callerId }` | Reject incoming call |
| `callRejected` | Server → Client | `{ userId }` | Call was rejected |

**Notes:**
- WebRTC peer connection is established via PeerJS on the client side.
- Socket.IO only handles signaling (exchange of PeerJS peer IDs).
- Media streams (audio/video) flow directly peer-to-peer via WebRTC, not through the server.

---

### Notification Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `notification` | Server → Client | `{ type: "match" \| "request" \| "message", data: { ... }, message }` | Real-time notification (match, new request, message) |

**Example:**
```json
{
  "type": "match",
  "data": {
    "userId": "64abc123...",
    "firstName": "Alice",
    "lastName": "Smith",
    "photoUrl": "https://..."
  },
  "message": "You matched with Alice Smith!"
}
```

---

## MongoDB Schema Definitions

### User Schema

```javascript
{
  _id: ObjectId,                    // Auto-generated
  firstName: String,                // Required, min 2, max 50 chars
  lastName: String,                 // Required, min 2, max 50 chars
  email: String,                    // Required, unique, validated with validator.isEmail
  password: String,                 // Required, bcrypt hashed (10 rounds)
  phone: String,                    // Optional, validated with validator.isMobilePhone
  photoUrl: String,                 // Optional, Cloudinary URL
  skills: [String],                 // Array of strings (e.g., ["React", "Node.js"])
  bio: String,                      // Max 500 chars
  experience: String,               // Enum: "Student", "Junior", "Mid-level", "Senior", "Staff", "Principal"
  location: String,                 // Optional
  github: String,                   // Optional, GitHub username or URL
  portfolio: String,                // Optional, portfolio URL
  currentlyBuilding: String,        // Optional, short one-liner
  createdAt: Date,                  // Auto timestamp
  updatedAt: Date                   // Auto timestamp
}
```

**Indexes:**
- `email` (unique)
- `skills` (for filtering feed)

---

### ConnectionRequest Schema

```javascript
{
  _id: ObjectId,                    // Auto-generated
  fromUserId: ObjectId,             // User who sent the request (ref: User)
  toUserId: ObjectId,               // User who receives the request (ref: User)
  status: String,                   // Enum: "interested", "accepted", "rejected"
  message: String,                  // Optional message with request
  createdAt: Date,                  // Auto timestamp
  updatedAt: Date                   // Auto timestamp
}
```

**Indexes:**
- Compound index: `{ fromUserId: 1, toUserId: 1 }` (unique, prevents duplicate requests)
- `toUserId` (for querying received requests)
- `status` (for filtering pending/accepted/rejected)

**Business Logic:**
- A connection is mutual when both users have `"accepted"` status requests to each other.
- Frontend checks `/request/status/:userId` to determine relationship status.

---

### Message Schema

```javascript
{
  _id: ObjectId,                    // Auto-generated
  senderId: ObjectId,               // User who sent the message (ref: User)
  receiverId: ObjectId,             // User who receives the message (ref: User)
  content: String,                  // Required, message text
  createdAt: Date,                  // Auto timestamp
  readAt: Date                      // Null until message is read
}
```

**Indexes:**
- Compound index: `{ senderId: 1, receiverId: 1, createdAt: -1 }` (for conversation history)
- `receiverId` (for unread message queries)

---

## Environment Configuration

Create a `.env` file in the `dev-tinder-backend/` directory:

```bash
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/devtinder
# Or use MongoDB Atlas:
# MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/devtinder?retryWrites=true&w=majority

# JWT
JWT_SECRET=your_jwt_secret_key_min_32_chars_long_random_string
JWT_EXPIRY=7d

# CORS (Frontend URLs)
FRONTEND_URL=http://localhost:5173

# Cloudinary (Optional, for profile photo uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Important:**
- **JWT_SECRET**: Use a strong, random string (32+ characters). Generate with `openssl rand -base64 32`.
- **MONGO_URI**: Use MongoDB Atlas for production or local MongoDB for development.
- **FRONTEND_URL**: Must match the frontend origin for CORS. For production, set to your deployed frontend URL (e.g., `https://devtinder.com`).

---

## Security Practices

### Authentication
- **JWT in httpOnly Cookies**: Token is stored in an httpOnly cookie (`token`) to prevent XSS attacks. Frontend cannot access it via JavaScript.
- **Cookie Settings**: `SameSite=Lax`, `secure=true` in production (HTTPS only).
- **Token Expiry**: 7 days. Users must re-authenticate after expiry.

### Password Security
- **bcrypt Hashing**: All passwords are hashed with bcrypt (10 salt rounds) before storage.
- **Password Validation**: Minimum 8 characters, at least one uppercase, one lowercase, one digit, one special character (`@$!%*?&#`).
- **No Plain Text Storage**: Passwords are never stored or logged in plain text.

### Input Validation
- **validator.js**: Email validation (`validator.isEmail`), phone validation (`validator.isMobilePhone`).
- **Mongoose Schema Validation**: Required fields, min/max lengths, enums for constrained values.
- **Sanitization**: User inputs are validated before database operations to prevent NoSQL injection.

### CORS Configuration
- **Credentials**: `credentials: true` allows cookies to be sent cross-origin.
- **Origin Allowlist**: Only requests from `FRONTEND_URL` are allowed. Adjust for multiple origins in production.

### Middleware Security
- **userAuth Middleware**: Validates JWT on protected routes. Returns 401 if token is missing or invalid.
- **Error Handling**: Generic error messages to clients; detailed logs server-side only.

---

## Setup Instructions

### Prerequisites
- **Node.js** v18.x or higher
- **npm** v9.x or higher
- **MongoDB** v6.x+ (local or MongoDB Atlas)
- **Git**

### Installation

1. **Clone the repository** (if not already cloned):
   ```bash
   git clone <repository-url>
   cd DevTinder/dev-tinder-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI, JWT secret, and CORS origin
   ```

4. **Start MongoDB** (if running locally):
   ```bash
   # macOS/Linux
   mongod --dbpath /path/to/data/db

   # Windows
   "C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe" --dbpath C:\data\db
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```
   The server will run at `http://localhost:3000` by default.

6. **Verify server is running**:
   ```bash
   curl http://localhost:3000/
   ```
   Expected response: `DevTinder API is running` or similar.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with nodemon (auto-restart on file changes) |
| `npm start` | Start production server (no auto-restart) |
| `npm test` | Run unit tests (if configured) |
| `npm run seed` | Seed database with sample data (if seed script exists) |

---

## Project Structure

```
dev-tinder-backend/
├── config/
│   └── database.js           # MongoDB connection logic
├── controllers/
│   ├── authController.js     # /auth route handlers
│   ├── profileController.js  # /profile route handlers
│   ├── feedController.js     # /feed route handlers
│   ├── requestController.js  # /request route handlers
│   └── chatController.js     # /chat route handlers
├── middleware/
│   ├── auth.js               # JWT authentication middleware (userAuth)
│   └── errorHandler.js       # Global error handler (optional)
├── models/
│   ├── User.js               # User schema
│   ├── ConnectionRequest.js  # ConnectionRequest schema
│   └── Message.js            # Message schema
├── routes/
│   ├── authRoutes.js         # /auth routes
│   ├── profileRoutes.js      # /profile routes
│   ├── feedRoutes.js         # /feed routes
│   ├── requestRoutes.js      # /request routes
│   └── chatRoutes.js         # /chat routes
├── sockets/
│   └── socketHandlers.js     # Socket.IO event handlers
├── utils/
│   ├── validators.js         # Custom validation helpers
│   └── constants.js          # App-wide constants
├── .env.example              # Example environment variables
├── .gitignore
├── package.json
├── README.md                 # This file
└── server.js                 # Express app entry point
```

---

## API Testing

### Using curl

**Sign Up:**
```bash
curl -X POST http://localhost:3000/auth/signUp \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Alice",
    "lastName": "Smith",
    "email": "alice@example.com",
    "password": "SecurePass123!",
    "skills": ["React", "Node.js"]
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{ "email": "alice@example.com", "password": "SecurePass123!" }'
```

**Get Feed (with JWT cookie):**
```bash
curl -X GET http://localhost:3000/feed \
  -b cookies.txt
```

**Send Connection Request:**
```bash
curl -X POST http://localhost:3000/request/send/64abc123... \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "message": "Let's collaborate!" }'
```

### Using Postman
1. Import the API routes as a Postman collection.
2. Set `{{baseUrl}}` to `http://localhost:3000`.
3. After login, Postman automatically stores cookies for subsequent requests.

---

## Production Deployment

### Environment Checklist
- ✅ Set `NODE_ENV=production`
- ✅ Use MongoDB Atlas or managed MongoDB instance
- ✅ Generate strong `JWT_SECRET` (32+ chars)
- ✅ Set `FRONTEND_URL` to production frontend domain
- ✅ Enable HTTPS (JWT cookie `secure: true` requires HTTPS)
- ✅ Configure firewall/security groups to allow only frontend origin
- ✅ Enable MongoDB connection string with authentication
- ✅ Set up logging (Winston, Pino) for production error tracking

### Deployment Targets
- **Heroku**: Add `Procfile` with `web: node server.js`
- **AWS EC2 / DigitalOcean**: Use PM2 for process management (`pm2 start server.js`)
- **Docker**: Create `Dockerfile` with Node.js base image
- **Vercel / Netlify Serverless**: Not recommended for Socket.IO (requires persistent connections)

---

## Known Limitations & Future Enhancements

### Current Limitations
- **Projects, Challenges, Activity**: Backend endpoints are placeholders or return mock data.
- **GitHub Integration**: OAuth flow not implemented; users manually enter GitHub username.
- **Profile Analytics**: No analytics tracking or aggregation implemented yet.
- **Email Verification**: No email verification on signup (planned).
- **Rate Limiting**: No rate limiting middleware on API routes (planned).

### Planned Enhancements
- [ ] Implement `/projects`, `/challenges`, `/activity` full CRUD operations
- [ ] GitHub OAuth flow for automatic profile linking
- [ ] Profile analytics aggregation (views, match rate, response rate)
- [ ] Email verification via SendGrid/Nodemailer
- [ ] Rate limiting (express-rate-limit) on auth and request routes
- [ ] Redis session store for horizontal scaling of Socket.IO
- [ ] Admin dashboard for user moderation
- [ ] Integration tests (Jest + Supertest)

---

## Troubleshooting

### Common Issues

**Problem**: Server fails to start with `MongooseServerSelectionError`.
- **Solution**: Verify `MONGO_URI` is correct. If using MongoDB Atlas, check IP allowlist. If local, ensure `mongod` is running.

**Problem**: JWT authentication fails with 401 Unauthorized.
- **Solution**: Ensure JWT cookie is being sent by frontend (`credentials: 'include'` in axios). Verify `JWT_SECRET` matches between signup and login.

**Problem**: CORS errors on frontend requests.
- **Solution**: Verify `FRONTEND_URL` in `.env` matches the frontend origin exactly (including protocol and port). Ensure `credentials: true` in CORS config.

**Problem**: Socket.IO connection fails.
- **Solution**: Check CORS configuration for Socket.IO. Verify frontend is connecting to correct backend URL. Ensure no reverse proxy is blocking WebSocket connections.

**Problem**: Password validation error on signup.
- **Solution**: Password must meet complexity requirements: 8+ chars, one uppercase, one lowercase, one digit, one special character.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository** and create a feature branch (`feature/your-feature-name`).
2. **Follow the existing code style**: Use ESLint/Prettier configurations if available.
3. **Write tests** for new features (unit tests with Jest, integration tests with Supertest).
4. **Test your changes**: Verify all endpoints work with Postman/curl before submitting.
5. **Write meaningful commit messages**: Use conventional commits (e.g., `feat:`, `fix:`, `docs:`).
6. **Submit a pull request** with a clear description of changes and motivation.

---

## License

This project is licensed under the **MIT License**. See `LICENSE` file for details.

---

## Support & Community

- **Issues**: Report bugs or request features via GitHub Issues
- **Discussions**: Join community discussions for Q&A and feature ideas
- **Email**: support@devtinder.dev (placeholder)

---

**Built with ❤️ by developers, for developers.**
