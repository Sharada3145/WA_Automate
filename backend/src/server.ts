// src/server.ts
import app from './app';
import { env } from './config/env';

const PORT = Number(env.port);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
