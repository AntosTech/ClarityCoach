# ESLApp Setup Journey

## Overview

This document captures the complete setup journey for the ESLApp (Clarity Coach) project, including architecture decisions, implementation steps, challenges encountered, and lessons learned.

---

# Phase 1: Define the Product

## Goal

Build an AI-powered communication coach called **Clarity Coach** for ESL professionals.

### User Input

```text
I want update fast. Please send me.
```

### Desired Output

```json
{
  "improved": "...",
  "explanation": "...",
  "scores": {},
  "tip": "..."
}
```

## Key Insight

The product evolved from an AI writing assistant into an AI communication coach focused on coaching, learning, and workplace communication.

---

# Phase 2: Azure OpenAI Setup

## Tasks Completed

1. Created an Azure OpenAI resource.
2. Opened Azure AI Foundry.
3. Created an AI project.
4. Deployed a model.
5. Retrieved:
   - API Key
   - Endpoint
   - Deployment Name

## Challenge: Model Selection

### Issue

Several models displayed deprecation warnings.

### Lesson Learned

For MVP development:

```text
Progress > Perfection
```

Focus on building and learning before optimizing infrastructure.

---

# Phase 3: Create the Backend Project

## Folder Structure

```text
ESLApp/
└── backend/
```

## Initialize Project

```bash
npm init -y
```

## Challenge: npm Not Recognized

### Error

```text
'npm' is not recognized as an internal or external command
```

### Root Cause

PATH variables had not refreshed after Node.js installation.

### Resolution

Verified installation:

```cmd
node -v
where npm
```

Opened a new command prompt.

### Lesson Learned

Many development issues originate from the environment rather than the code.

---

# Phase 4: Install Dependencies

## Installed Packages

```bash
npm install express cors dotenv openai
```

### Purpose

- Express: Build APIs
- CORS: Enable browser communication
- dotenv: Load environment variables
- OpenAI SDK: Connect to Azure OpenAI

---

# Phase 5: Create the .env File

## Configuration

```env
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT_NAME=...
```

## Challenge

Understanding where the `.env` file belongs and that it must be created manually.

### Lesson Learned

The `.env` file is not generated automatically.

---

# Phase 6: Create the Initial Server

## Goal

Build a basic Express application.

```javascript
app.get("/", (req, res) => {
  res.json({ status: "running" });
});
```

## Challenge: ES Modules Error

### Error

```text
Cannot use import statement outside a module
```

### Root Cause

`package.json` contained conflicting module definitions.

### Resolution

Kept:

```json
"type": "module"
```

Removed:

```json
"type": "commonjs"
```

### Lesson Learned

Project configuration is just as important as application code.

---

# Phase 7: Connect Azure OpenAI

## Goal

Create an Azure OpenAI client.

```javascript
const client = new OpenAI({...});
```

## Components Required

- API Key
- Endpoint
- Deployment Name
- API Version

---

# Phase 8: First AI Response

## Success

Received the first successful response from Azure OpenAI.

## Challenge: JSON Returned as Text

### Problem

The AI returned JSON as a string.

### Resolution

```javascript
const parsedResponse = JSON.parse(aiText);
```

### Lesson Learned

AI output often requires transformation before it can be used programmatically.

---

# Phase 9: Prompt Engineering

## Goal

Define the Clarity Coach persona and output schema.

### Added Features

- Communication scoring
- Explanations
- Tips
- Structured JSON output

## Challenge: Flat Scores

### Problem

Scores were always returning similar values.

### Resolution

Added detailed scoring criteria.

```text
1 = Poor
10 = Excellent
```

### Lesson Learned

The quality of AI output depends heavily on the quality of instructions.

---

# Phase 10: Biggest Debugging Issue

## Problem

The AI repeatedly responded:

```text
Please provide the message you would like analyzed.
```

Even though a message was being sent.

## Root Cause

The messages array only contained a system message.

```javascript
messages: [
  {
    role: "system"
  }
]
```

No user message was being sent.

## Resolution

Added:

```javascript
{
  role: "user",
  content: `...${message}...`
}
```

### Lesson Learned

Every chat completion requires:

```text
System Message + User Message
```

Without a user message, the model has nothing to analyze.

---

# Phase 11: Successful End-to-End Response

## Final Output Example

```json
{
  "improved": "Could you please send me an update as soon as possible?",
  "explanation": "The original message was abrupt and lacked context.",
  "scores": {
    "clarity": 4,
    "politeness": 3,
    "professionalism": 2
  },
  "tip": "Be specific about the update you need and include a timeframe."
}
```

---

# Technical Skills Learned

## Node.js

- Package management
- Runtime environment
- Module systems

## Express

- API routes
- Request handling
- Response handling

## Azure OpenAI

- Deployments
- Authentication
- Endpoints

## Environment Variables

- Secure configuration
- Secrets management

## Prompt Engineering

- System messages
- User messages
- Structured output design

## Debugging

- Using console.log()
- Tracking request flow
- Diagnosing integration issues

---

# Biggest Takeaway

The hardest part of AI application development was not the AI itself.

The biggest challenges were:

```text
Environment setup
Configuration
Request flow
Integration
Debugging
```

By the end of the exercise, ESLApp evolved from an idea into a functioning Azure OpenAI application with a production-style architecture.

---

# Current Architecture

```text
Azure OpenAI
      ↑
Node.js
      ↑
Express API
      ↑
POST /improve
```

This architecture provides the foundation for the future React frontend, Teams integration, and Microsoft Marketplace deployment.
