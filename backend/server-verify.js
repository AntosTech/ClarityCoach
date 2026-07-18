import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

function getSupabaseForRequest(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

app.get("/", (req, res) => {
  res.json({
    status: "running"
  });
});

app.post("/improve", async (req, res) => {
  try {
    const { message } = req.body;

    let userId = null;
    let supabaseForUser = null;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (accessToken) {
      supabaseForUser = getSupabaseForRequest(accessToken);
      const {
        data: { user },
        error: userError
      } = await supabaseForUser.auth.getUser(accessToken);
      if (!userError && user) {
        userId = user.id;
      }
    }

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      messages: [
        {
          role: "system",
          content: `system prompt placeholder`
        },
        {
          role: "user",
          content: `user prompt placeholder ${message}`
        }
      ]
    });

    const aiText = response.choices[0].message.content;

    const parsedResponse = JSON.parse(aiText);

    if (userId && supabaseForUser) {
      const { error: insertError } = await supabaseForUser
        .from("submissions")
        .insert({
          user_id: userId,
          original_message: message,
          rewrite_professional: parsedResponse.rewrites?.professional,
          rewrite_friendly: parsedResponse.rewrites?.friendly,
          rewrite_concise: parsedResponse.rewrites?.concise,
          rewrite_executive: parsedResponse.rewrites?.executive,
          explanation: parsedResponse.explanation,
          clarity_score: parsedResponse.scores?.clarity,
          politeness_score: parsedResponse.scores?.politeness,
          professionalism_score: parsedResponse.scores?.professionalism,
          tip: parsedResponse.tip
        });

      if (insertError) {
        console.error("Failed to save submission:", insertError.message);
      }
    }

    res.json(parsedResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message
    });
  }
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
