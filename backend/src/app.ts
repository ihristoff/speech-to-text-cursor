import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { Queue, Job } from 'bull';
import Bull from 'bull';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import mongoose from 'mongoose';
import AudioJob, { IAudioJob } from './job.model';
import cors from 'cors';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware for JSON parsing
app.use(express.json());
app.use(cors());

console.log(process.env.MONGO_URI)

// Set up Multer for file uploads (temporary storage)
const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mp3', 'audio/mpeg', 'video/mp4'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 and MP4 files are allowed'));
    }
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up Bull queue (will connect to Redis at default localhost:6379)
const audioJobQueue: Queue = new Bull('audio-processing', {
  redis: { host: '127.0.0.1', port: 6379 },
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/audiojobs';
mongoose.connect(MONGO_URI, { dbName: 'audiojobs' })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'API is healthy' });
});

// File upload and job creation endpoint
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Generate a unique job ID
    const jobId = uuidv4();
    // Create job in MongoDB
    await AudioJob.create({
      job_id: jobId,
      status: 'pending',
      audio_file_path: req.file.path,
      created_at: new Date(),
      updated_at: new Date(),
    });
    // Enqueue the job with file info
    const job: Job = await audioJobQueue.add({
      job_id: jobId,
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      status: 'pending',
      created_at: new Date(),
    });
    // Return job_id and status link
    res.status(200).json({
      job_id: jobId,
      status_url: `/api/status/${jobId}`,
      message: 'File uploaded and job created',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Status endpoint to check job progress
app.get('/api/status/:job_id', async (req: Request, res: Response) => {
  try {
    const { job_id } = req.params;
    // First, check MongoDB for completed/failed jobs
    const dbJob = await AudioJob.findOne({ job_id });
    if (dbJob && (dbJob.status === 'completed' || dbJob.status === 'failed')) {
      return res.status(200).json({
        job_id: dbJob.job_id,
        status: dbJob.status,
        transcript: dbJob.transcript || null,
        summary: dbJob.summary || null,
        error_message: dbJob.error_message || null,
        created_at: dbJob.created_at,
        updated_at: dbJob.updated_at,
      });
    }
    // Otherwise, check Bull for in-progress jobs
    const job = await audioJobQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed'])
      .then(jobs => jobs.find(j => j.data.job_id === job_id));
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    // Prepare response based on job state
    const state = await job.getState();
    const response: any = {
      job_id: job.data.job_id,
      status: state,
      data: job.data,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null,
    };
    res.status(200).json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Download transcript as .txt
app.get('/api/download/:job_id/transcript', async (req: Request, res: Response) => {
  try {
    const { job_id } = req.params;
    const job = await AudioJob.findOne({ job_id });
    if (!job || job.status !== 'completed' || !job.transcript) {
      return res.status(404).send('Transcript not found or job not completed');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${job_id}_transcript.txt"`);
    res.setHeader('Content-Type', 'text/plain');
    res.send(job.transcript);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Download summary as .txt
app.get('/api/download/:job_id/summary', async (req: Request, res: Response) => {
  try {
    const { job_id } = req.params;
    const job = await AudioJob.findOne({ job_id });
    if (!job || job.status !== 'completed' || !job.summary) {
      return res.status(404).send('Summary not found or job not completed');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${job_id}_summary.txt"`);
    res.setHeader('Content-Type', 'text/plain');
    res.send(job.summary);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app; 