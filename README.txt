
CSPRNG SSE Server
-----------------
- Start: npm install && npm start
- Server serves a UI at / which connects via Server-Sent Events (/events).
- The server generates a cryptographically secure random digit (0-9) for each minute.
- The digit is revealed 35 seconds before the minute boundary and pushed to connected clients.
- History is stored in history.json on the instance.
