# ChatChit Server

A Node.js server for the ChatChit application with PostgreSQL vector storage and Google AI integration.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database with pgvector extension
- Google AI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your actual values:
   ```env
   DB_URL=postgresql://username:password@host:port/database
   GOOGLE_API_KEY=your_actual_google_api_key
   NODE_ENV=development
   PORT=3000
   ```

4. **Test database connection** (development only)
   ```bash
   npm run test-db
   ```

5. **Start the server**
   ```bash
   npm start
   ```

## 🔧 Development

- **Start with auto-restart**: `npm run dev`
- **Test database connection**: `npm run test-db`

## 🚀 Deployment

### Environment Variables for Production
Make sure to set these environment variables in your production environment:

- `DB_URL`: Your PostgreSQL connection string
- `GOOGLE_API_KEY`: Your Google AI API key
- `NODE_ENV`: Set to `production`
- `PORT`: Your server port (optional, defaults to 3000)

### Database Setup
Ensure your PostgreSQL database has the `pgvector` extension installed:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Files to Exclude from Deployment
The following files should NOT be deployed:
- `.env` (contains sensitive data)
- `test-db-connection.js` (development only)
- `node_modules/` (will be installed on deployment)

## 📁 Project Structure

```
server/
├── index.js              # Main server file
├── agent.js              # LangChain agent configuration
├── embeddings.js         # Vector store and embeddings setup
├── scrapVideo.js         # YouTube video scraping
├── package.json          # Dependencies and scripts
├── .gitignore           # Git ignore rules
├── env.example          # Environment variables template
└── README.md            # This file
```

## 🔍 Troubleshooting

### Database Connection Issues
1. Verify your `DB_URL` is correct
2. Ensure PostgreSQL is running and accessible
3. Check if the `pgvector` extension is installed
4. Verify network connectivity and firewall settings

### Common Error Messages
- **"Connection terminated unexpectedly"**: Usually network or configuration issues
- **"pgvector extension not found"**: Install the pgvector extension in your database
- **"Authentication failed"**: Check username/password in DB_URL

## 📝 API Endpoints

- `GET /` - Health check
- `GET /health` - Server status
- `POST /generate` - Generate AI response
