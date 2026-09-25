// src/server.ts
import app from './app';
import { env } from './config/env';

const PORT = Number(env.port);

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
