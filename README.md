<div align="center">

```
        ╦ ╦╦ ╦╔═╗╔╦╗╔═╗╔═╗╔═╗╔═╗  ╔═╗╦  ╔═╗╦ ╦  ╔╗ ╦ ╦╦╦  ╔╦╗╔═╗╦═╗
        ║║║╠═╣╠═╣ ║ ╚═╗╠═╣╠═╝╠═╝  ╠╣ ║  ║ ║║║║  ╠╩╗║ ║║║   ║║║╣ ╠╦╝
        ╚╩╝╩ ╩╩ ╩ ╩ ╚═╝╩ ╩╩  ╩    ╚  ╩═╝╚═╝╚╩╝  ╚═╝╚═╝╩╩═╝═╩╝╚═╝╩╚═
```

### ⚡ Created by

```
  ╔╦╗  ┬ ┬  ┌─┐    ╔═╗  ┌┐   ┬ ┬  ┬    ╔═╗  ┌─┐  ┌┬┐  ┌─┐  ┬  
   ║   ├─┤  ├┤     ╠═╣  ├┴┐  ├─┤  │    ╠═╝  ├─┤   │   ├┤   │  
   ╩   ┴ ┴  └─┘    ╩ ╩  └─┘  ┴ ┴  ┴    ╩    ┴ ┴   ┴   └─┘  ┴─┘
```

[![GitHub](https://img.shields.io/badge/GitHub-@theabhipatel-181717?style=for-the-badge&logo=github)](https://github.com/theabhipatel)

</div>

# WA Flow Builder

A full-stack **WhatsApp chatbot builder** with a visual drag-and-drop flow editor. Design complex conversational flows, connect them to the WhatsApp Cloud API, and deploy — all from an intuitive web interface.

Built with **React + TypeScript** on the frontend and **Node.js + Express + MongoDB** on the backend.

---

## ✨ Features

### 🎨 Visual Flow Builder
- **Drag-and-drop canvas** powered by React Flow — design chatbot conversations visually
- **11 node types**: Message, Button, List, Input, Condition, Delay, API Call, AI Reply, Loop, Go to Subflow, End
- **Real-time simulator** — test your flows directly in the browser without sending real WhatsApp messages
- **Auto-arrange** — automatically lay out nodes for a clean, readable flow
- **Node duplication & deletion** with confirmation modals
- **Edge management** — clickable, deletable connections with glow effects
- **Draft & deploy workflow** — save drafts, validate, and deploy to production with a single click

### 🤖 Node Types

| Node | Description |
|------|-------------|
| **Message** | Send a text message to the user |
| **Button** | Send interactive button messages (up to 3 buttons) |
| **List** | Send list selection messages with multiple sections |
| **Input** | Collect user input with validation (text, number, email, phone, regex) |
| **Condition** | Branch logic based on keyword match, variable comparison, or logical expressions |
| **Delay** | Pause execution for a specified duration |
| **API Call** | Make HTTP requests with auth, headers, body, response mapping, and retry logic |
| **AI Reply** | Generate responses using AI providers (OpenAI, Gemini, Groq, Mistral, OpenRouter, etc.) |
| **Loop** | Iterate over arrays, count-based ranges, or condition-based loops |
| **Go to Subflow** | Jump to a reusable subflow and return after completion |
| **End** | Terminate the flow with an optional farewell message |

### 📱 WhatsApp Integration
- Direct integration with the **WhatsApp Cloud API** (Meta Graph API v24.0)
- Supports **text messages**, **interactive buttons**, and **list messages**
- Webhook endpoint for receiving incoming messages from WhatsApp
- Automatic message retry with exponential backoff
- Credential validation against Meta's API

### 🧠 AI Integration
- Multi-provider support: **OpenAI, Gemini, Groq, Mistral, OpenRouter**, and custom providers
- Configurable model parameters (temperature, max tokens, top-p, frequency/presence penalty, etc.)
- Conversation history inclusion for contextual AI responses
- Response variable mapping and token usage tracking
- AI API logs with detailed analytics (tokens, latency, errors)

### 🔄 Flow Versioning
- **Draft / Production** versioning system — edit drafts without affecting live flows
- **Version history** — keeps the last 3 deployed versions for rollback capability
- Automatic cleanup of old versions to prevent unbounded database growth
- Rollback to any previous version

### 💬 Conversations
- Real-time conversation viewer for all connected WhatsApp numbers
- Message history with sender identification (user, bot, manual)
- Per-bot conversation filtering

### 🔒 Security
- JWT-based authentication with token refresh
- Password hashing with bcryptjs
- AES encryption for sensitive data (API keys, access tokens)
- Helmet.js security headers
- Rate limiting (API: 100 req/min, Auth: 20 req/15min, Webhooks: 500 req/min)
- CORS protection

### 📊 Additional Features
- **Dashboard** with bot overview and analytics
- **Bot variables** — global variables shared across all flows and sessions
- **Session variables** — per-conversation state management
- **Profile management** — update name and password
- **Admin panel** for user management
- **Dark mode** support
- **Responsive UI** built with Tailwind CSS

---

## 🏗️ Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** — fast build tooling with HMR
- **React Flow** (`@xyflow/react`) — interactive node-based canvas
- **Redux Toolkit** — state management
- **React Router v7** — client-side routing
- **Axios** — HTTP client
- **Tailwind CSS** — utility-first styling
- **Lucide React** — icon library

### Backend
- **Node.js** with TypeScript
- **Express** — web framework
- **MongoDB** with **Mongoose** ODM
- **JWT** (`jsonwebtoken`) — authentication
- **bcryptjs** — password hashing
- **crypto-js** — AES encryption for secrets
- **node-cron** — scheduled tasks (delay node processing)
- **Helmet** — security headers
- **express-rate-limit** — API rate limiting
- **Morgan** — HTTP request logging (dev mode)

### Deployment
- **Ubuntu VPS** or **Docker** — recommended for full feature support
- **Vercel** — used for showcase only (limited serverless environment)

---

## 📁 Project Structure

```
wa-flow-builder/
├── api/
│   └── index.ts                 # Vercel serverless entry point
├── client/                      # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── FlowBuilder/     # Canvas, nodes, edges, simulator, settings panel
│   │   │   └── Layout/          # Sidebar, header, layout wrapper
│   │   ├── pages/               # Route pages (Dashboard, Bots, Flows, Builder, etc.)
│   │   ├── store/               # Redux slices (auth, builder)
│   │   ├── lib/                 # Axios API client
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/               # Auto-layout, helpers
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.js
├── server/                      # Express backend
│   ├── src/
│   │   ├── controllers/         # Route handlers
│   │   ├── middlewares/         # Auth, error handling, rate limiting
│   │   ├── models/              # Mongoose schemas
│   │   ├── routes/              # Express routers
│   │   ├── services/            # Business logic (execution, WhatsApp, AI, delay)
│   │   ├── types/               # TypeScript interfaces & type definitions
│   │   ├── utils/               # Flow validator, DB connection, encryption
│   │   ├── app.ts               # Express app setup
│   │   └── server.ts            # Server entry point (local development)
│   └── .env.example
├── vercel.json                  # Vercel deployment config
├── package.json                 # Root package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **MongoDB** (local or cloud — [MongoDB Atlas](https://www.mongodb.com/atlas) free tier works great)
- **npm** (comes with Node.js)

### 1. Clone the Repository

```bash
git clone https://github.com/theabhipatel/wa-flow-builder.git
cd wa-flow-builder
```

### 2. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `server/` directory:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your values:

```env
MONGODB_URI=mongodb://localhost:27017/whatsapp_flow_builder
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ENCRYPTION_KEY=your-32-char-encryption-key-here
PORT=5000
NODE_ENV=development
```

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT token signing (use a strong random string) |
| `ENCRYPTION_KEY` | 32-character key for AES encryption of sensitive data |
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | Environment (`development` or `production`) |

### 4. Seed the Database (Optional)

Create an initial admin user:

```bash
cd server
npm run seed
```

### 5. Start Development Servers

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

### 6. Open in Browser

```
http://localhost:5173
```

> The Vite dev server automatically proxies `/api/*` requests to `localhost:5000`, so everything works seamlessly.

---

## 🌐 Deployment

> **Note:** This application has been deployed to [Vercel](https://vercel.com) for showcase purposes, but not all features work properly in Vercel's serverless environment (e.g., delay node cron jobs, long-running flow executions, and WebSocket-like features require a persistent server process).

**Recommended deployment:** Deploy the backend on an **Ubuntu VPS** or inside **Docker containers** where the Node.js application can run as a long-lived process with full access to features like `node-cron`, in-memory timers, and persistent connections.

For the frontend, you can either serve the built static files from the same server or host them on any static hosting provider (Vercel, Netlify, etc.).

---

## 📱 Connecting WhatsApp

### Prerequisites
- A [Meta Developer Account](https://developers.facebook.com/)
- A Meta App with WhatsApp Business API enabled
- A test phone number from Meta's dashboard

### Steps

1. **Create a bot** in the WA Flow Builder dashboard
2. Go to **Bot Settings → WhatsApp Connection**
3. Enter your **Phone Number ID**, **Access Token**, **Phone Number**, and a **Verify Token**
4. Click **Save Settings**
5. Copy the **Webhook URL** shown in the settings
6. In Meta Developer Dashboard → WhatsApp → Configuration:
   - Paste the Webhook URL as the **Callback URL**
   - Enter the same **Verify Token**
   - Subscribe to the `messages` webhook field
7. Click **Check Connection** in the bot settings to verify

---

## 🧪 Testing Flows

The built-in **Simulator** lets you test flows without sending real WhatsApp messages:

1. Open the **Flow Builder** for any flow
2. Click the **Test** button in the toolbar
3. The simulator panel opens on the right
4. Type messages and interact with buttons/lists just like on WhatsApp
5. The simulator uses the same execution engine as production

---

## 📜 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and get JWT token |
| `GET` | `/api/auth/me` | Get current user profile |
| `PUT` | `/api/auth/profile` | Update profile |
| `PUT` | `/api/auth/change-password` | Change password |

### Bots
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bots` | List all bots |
| `POST` | `/api/bots` | Create a new bot |
| `GET` | `/api/bots/:id` | Get bot details |
| `PUT` | `/api/bots/:id` | Update bot |
| `DELETE` | `/api/bots/:id` | Delete bot |

### Flows
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bots/:botId/flows` | List flows for a bot |
| `POST` | `/api/bots/:botId/flows` | Create a new flow |
| `GET` | `/api/bots/:botId/flows/:flowId` | Get flow with versions |
| `PUT` | `/api/bots/:botId/flows/:flowId/draft` | Save draft |
| `POST` | `/api/bots/:botId/flows/:flowId/validate` | Validate flow |
| `POST` | `/api/bots/:botId/flows/:flowId/deploy` | Deploy to production |
| `POST` | `/api/bots/:botId/flows/:flowId/rollback` | Rollback to a version |
| `GET` | `/api/bots/:botId/flows/:flowId/versions` | List all versions |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/webhook/whatsapp/:botId` | WhatsApp webhook verification |
| `POST` | `/api/webhook/whatsapp/:botId` | Receive WhatsApp messages |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |

---

## 🛠️ Available Scripts

### Server (`/server`)
| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start dev server with hot reload (tsx watch) |
| `build` | `npm run build` | Compile TypeScript to JavaScript |
| `start` | `npm run start` | Run compiled production server |
| `seed` | `npm run seed` | Seed database with initial admin user |

### Client (`/client`)
| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Vite dev server with HMR |
| `build` | `npm run build` | Build for production |
| `preview` | `npm run preview` | Preview production build locally |

---

## 🤝 Contributing

Contributions are welcome! Whether it's a bug fix, new feature, or documentation improvement — feel free to get involved.

### Guidelines

- **All pull requests should target the `dev` branch** — do not open PRs against `main`.
- For **large features or architectural changes**, please open an issue first to discuss the approach before writing code.
- Make sure your changes don't break existing functionality.
- Follow the existing code style and project structure.

### Steps

1. Fork the repository
2. Create your branch from `dev` (`git checkout -b feature/amazing-feature dev`)
3. Commit your changes using [conventional commits](https://www.conventionalcommits.org/)
   - `feat: add amazing feature`
   - `fix: resolve button click issue`
   - `docs: update API documentation`
   - `chore: clean up unused imports`
4. Push to your branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request **against the `dev` branch**

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
