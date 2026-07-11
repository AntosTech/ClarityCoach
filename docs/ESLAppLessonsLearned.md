# ESLApp Lessons Learned

## npm Not Recognized
### Problem
npm command failed.

### Cause
PATH not refreshed.

### Solution
Open a new command prompt and verify Node installation.

---

## ES Module Error
### Problem
Cannot use import statement outside a module.

### Cause
package.json contained CommonJS configuration.

### Solution
Use:
```json
"type": "module"
```

---

## Missing User Message
### Problem
AI asked for text to analyze.

### Cause
Only a system message was sent.

### Solution
Add:
```javascript
role: "user"
```

---

## JSON Parsing
### Problem
AI JSON returned as text.

### Solution
```javascript
JSON.parse(aiText)
```

---

## Biggest Takeaway
Most challenges were related to:
- Configuration
- Integration
- Debugging
- Environment setup

rather than AI itself.
