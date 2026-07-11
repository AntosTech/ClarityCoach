# ESLApp Infrastructure and `server.js` Walkthrough

## High-Level Flow

```text
User
 ↓
POST /improve
 ↓
Express Server
 ↓
Azure OpenAI
 ↓
JSON Response
 ↓
User
```

Your `server.js` acts as the middleman between the user and Azure OpenAI.

---

## 1. Import Required Libraries

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
```

### Express

Creates web APIs and routes.

### CORS

Allows your frontend application to call your backend.

### dotenv

Loads environment variables from `.env` into `process.env`.

### OpenAI SDK

Provides a simple way to communicate with Azure OpenAI.

---

## 2. Load Environment Variables

```javascript
dotenv.config();
```

Loads values from `.env`.

Example:

```env
AZURE_OPENAI_API_KEY=xxxxx
AZURE_OPENAI_ENDPOINT=https://eslapp.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=clarity-coach-model
```

---

## 3. Create the Express App

```javascript
const app = express();
```

Creates the web server.

---

## 4. Middleware

```javascript
app.use(cors());
```

Enables cross-origin requests.

```javascript
app.use(express.json());
```

Allows Express to parse JSON request bodies.

Without this, `req.body` would be empty.

---

## 5. Configure Azure OpenAI

```javascript
const client = new OpenAI({
```

Creates a client used to communicate with Azure OpenAI.

### API Key

```javascript
apiKey: process.env.AZURE_OPENAI_API_KEY,
```

Authenticates requests.

### Endpoint

```javascript
baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
```

Builds the target Azure OpenAI endpoint.

### API Version

```javascript
defaultQuery: {
  "api-version": "2024-02-15-preview"
}
```

Specifies the Azure OpenAI API version.

### Headers

```javascript
defaultHeaders: {
  "api-key": process.env.AZURE_OPENAI_API_KEY
}
```

Sends authentication information.

---

## 6. Root Endpoint

```javascript
app.get("/", (req, res) => {
```

Provides a simple health check.

```javascript
res.json({
  status: "running"
});
```

Returns:

```json
{
  "status": "running"
}
```

---

## 7. Main Clarity Coach Endpoint

```javascript
app.post("/improve", async (req, res) => {
```

The main API endpoint for the application.

### Extract User Message

```javascript
const { message } = req.body;
```

Reads the user's message from the incoming request.

Example:

```json
{
  "message": "I want update fast."
}
```

---

## 8. Call Azure OpenAI

```javascript
const response = await client.chat.completions.create({
```

Sends the request to Azure OpenAI.

### Model

```javascript
model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
```

Uses the deployed model.

---

## 9. Messages Array

### System Message

```javascript
{
 role: "system",
 content: `...`
}
```

Defines the AI's behavior, rules, JSON structure, scoring guidelines, and product logic.

### User Message

```javascript
{
 role: "user",
 content: `...${message}...`
}
```

Injects the user's message into the prompt.

---

## 10. Receive the Response

```javascript
const aiText = response.choices[0].message.content;
```

Retrieves the text returned by the model.

---

## 11. Convert Text to JSON

```javascript
const parsedResponse = JSON.parse(aiText);
```

Converts the returned JSON string into a JavaScript object.

---

## 12. Return the Result

```javascript
res.json(parsedResponse);
```

Returns the structured response to the caller.

Example:

```json
{
  "improved": "...",
  "explanation": "...",
  "scores": {
    "clarity": 4,
    "politeness": 3,
    "professionalism": 2
  },
  "tip": "..."
}
```

---

## 13. Error Handling

```javascript
catch (error)
```

Handles runtime failures.

```javascript
console.error(error);
```

Logs errors.

```javascript
res.status(500).json({
  error: error.message
});
```

Returns a standardized error response.

---

## 14. Start the Server

```javascript
app.listen(3001, () => {
```

Starts the server on port 3001.

```javascript
console.log("✅ Server running on port 3001");
```

Confirms successful startup.

---

## Most Important Concept

The intelligence of the application lives primarily in:

```javascript
messages: [
  {
    role: "system",
    content: "..."
  },
  {
    role: "user",
    content: "..."
  }
]
```

The system prompt defines the behavior of Clarity Coach and acts as the product's business logic.

---

## Current Architecture

```text
Azure OpenAI
      ↑
Node.js
      ↑
Express API
      ↑
/improve endpoint
```

Current output structure:

```json
{
  "improved": "...",
  "explanation": "...",
  "scores": {},
  "tip": "..."
}
```
