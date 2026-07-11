# ESLApp Prompt Engineering

## Purpose
Prompt engineering defines the behavior of Clarity Coach.

## System Prompt Responsibilities
- Define AI role
- Define scoring rules
- Require JSON output
- Establish coaching behavior

## Output Schema
```json
{
  "improved":"",
  "explanation":"",
  "scores":{
    "clarity":0,
    "politeness":0,
    "professionalism":0
  },
  "tip":""
}
```

## Critical Lesson
A chat completion requires both:

```text
System Message
+
User Message
```

Without a user message the model has nothing to analyze.

## Prompt Design Goals
- Coaching instead of simple rewriting
- Workplace communication focus
- ESL learner explanations
- Structured output
