import express from 'express';
import cors from 'cors';
import { personRouter } from './routes/person.route';
import { webhooksRouter } from './routes/webhooks.route';
import { adminRouter } from './routes/admin.route';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/persons', personRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/admin', adminRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
