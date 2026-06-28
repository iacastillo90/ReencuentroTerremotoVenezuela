import express from 'express';
import cors from 'cors';
import { personRouter } from './routes/person.route';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/persons', personRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
