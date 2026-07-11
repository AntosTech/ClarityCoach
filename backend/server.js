import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: {
    "api-version": "2024-02-15-preview"
  },
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY
  }
});

app.get("/", (req, res) => {
  res.json({
    status: "running"
  });
});

app.post("/improve", async (req, res) => {
  try {
    const { message, tone } = req.body;
    //const { message } = req.body;
    //console.log("REQUEST BODY:", req.body);
    //console.log("MESSAGE:", message);

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      messages: [

        {
          role: "system",
          content: `
You are Clarity Coach, an AI workplace communication coach for ESL professionals.

Analyze workplace communication quality.

Return ONLY valid JSON.

{
  "rewrites": {
    "professional": "",
    "friendly": "",
    "concise": "",
    "executive": ""
  },
  "explanation": "",
  "scores": {
    "clarity": 0,
    "politeness": 0,
    "professionalism": 0
  },
  "tip": ""
}

Scoring Guidelines:

Clarity:
1 = extremely unclear
10 = extremely clear

Politeness:
1 = rude or abrupt
10 = highly courteous and respectful

Professionalism:
1 = inappropriate for workplace use
10 = executive-level business communication

Requirements:
- Rewrite the message using the requested tone while preserving the original meaning.
- If the original message lacks context, improve only the wording and tone.
- Use only information provided by the user.
- Do not add recipients, signatures, dates, times, topics, deadlines, departments, projects, names, or any other new information.
- Provide a simple explanation suitable for ESL learners.
- Give realistic scores based on the ORIGINAL message.
- Provide one practical communication tip.
- Return valid JSON only.
- Do not invent information that the user did not provide.
- Do not add placeholders such as [date], [time], [name], or [department].
- Never insert placeholder text.
- Never invent dates, names, deadlines, times, departments, projects, or other information not explicitly supplied by the user.

Example:

Original:
"I need a response."

Good Rewrite:
"Could you please respond?"

Bad Rewrite:
"Hi [Name], could you please respond regarding [Topic] by [Date]?"

The bad rewrite is invalid because it invents information.
`

        },

        {
  role: "user",
  content: `
Analyze the ORIGINAL message below.

ORIGINAL MESSAGE:
"${message}"

Generate four versions:

1. Professional
2. Friendly
3. Concise
4. Executive

Tasks:
1. Generate four rewritten versions:
   - Professional
   - Friendly
   - Concise
   - Executive
2. Explain what was improved.
3. Score the ORIGINAL message.
4. Provide one workplace communication tip.

Return JSON only.
`
}

      ]
    });

    const aiText = response.choices[0].message.content;

    const parsedResponse = JSON.parse(aiText);

    res.json(parsedResponse);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: error.message
    });

  }
});

app.listen(3001, () => {
  console.log("✅ Server running on port 3001");
});