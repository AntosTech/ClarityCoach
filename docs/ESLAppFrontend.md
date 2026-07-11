# ESLApp Frontend Documentation

## Overview
Clarity Coach frontend is built with React and Vite.

## Features Implemented
- Text message input
- React state management
- API integration with Express backend
- Loading indicator
- Before/After comparison
- Copy message button
- Reset button
- Color-coded communication scores
- Results card

## React State
```jsx
const [message, setMessage] = useState("");
const [result, setResult] = useState(null);
const [loading, setLoading] = useState(false);
const [copied, setCopied] = useState(false);
```

## API Flow
```text
React UI
 ↓
Fetch API
 ↓
POST /improve
 ↓
Express Backend
 ↓
Azure OpenAI
 ↓
JSON Response
```

## Key Concepts Learned
- useState
- Event handling
- Controlled components
- Async/await
- Fetch API
- Conditional rendering
- UI composition
