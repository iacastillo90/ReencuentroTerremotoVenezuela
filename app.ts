import express from 'express';
import cors from 'cors';
import { personRouter } from './routes/person.route';
import { webhooksRouter } from './routes/webhooks.route';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/persons', personRouter);
app.use('/api/webhooks', webhooksRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
