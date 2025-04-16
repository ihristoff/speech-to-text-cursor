import Bull, { Job } from 'bull';
import mongoose from 'mongoose';
import AudioJob from './job.model';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { transcribeWithAssemblyAI } from './whisper';
import axios from 'axios';
import { summarizeWithGemini } from './summarize';

dotenv.config();

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/audiojobs';
mongoose.connect(MONGO_URI, { dbName: 'audiojobs' })
  .then(() => console.log('Worker: MongoDB connected'))
  .catch((err) => console.error('Worker: MongoDB connection error:', err));

// Set up Bull queue
const audioJobQueue = new Bull('audio-processing', {
  redis: { host: '127.0.0.1', port: 6379 },
});

audioJobQueue.process(processAudioJob);

console.log('Worker is running and listening for jobs...');

// Mock FFmpeg extraction
async function mockExtractAudio(filePath: string, mimetype: string): Promise<string> {
  if (mimetype === 'video/mp4') {
    console.log(`[MOCK] Extracting audio from MP4: ${filePath}`);
    // Simulate extraction delay
    await new Promise((res) => setTimeout(res, 500));
    // Return a fake MP3 path
    return filePath.replace(/\.mp4$/, '.mp3');
  }
  return filePath;
}

// Mock Whisper transcription
async function mocktranscribeWithAssemblyAI(audioPath: string): Promise<string> {
  console.log(`[MOCK] Transcribing audio: ${audioPath}`);
  await new Promise((res) => setTimeout(res, 500));
  return 'This is a mock transcript.';
}

// Mock GPT summarization
async function mockSummarizeWithGPT(transcript: string): Promise<string> {
  console.log(`[MOCK] Summarizing transcript: ${transcript}`);
  await new Promise((res) => setTimeout(res, 500));
  return 'This is a mock summary.';
}

// Helper: get file size in MB
function getFileSizeMB(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.size / (1024 * 1024);
}

// Helper: get audio duration in seconds using ffmpeg
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

// Helper: chunk audio file into parts <= 20MB using ffmpeg
async function chunkAudioFile(filePath: string, chunkSizeMB = 20): Promise<string[]> {
  const fileSizeMB = getFileSizeMB(filePath);
  if (fileSizeMB <= chunkSizeMB) return [filePath];
  const duration = await getAudioDuration(filePath);
  // Estimate chunk duration (seconds) so each chunk is <= chunkSizeMB
  const numChunks = Math.ceil(fileSizeMB / chunkSizeMB);
  const chunkDuration = duration / numChunks;
  const chunkPaths: string[] = [];
  const ext = path.extname(filePath);
  const base = filePath.replace(ext, '');
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkDuration;
    const chunkPath = `${base}_chunk${i + 1}${ext}`;
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .setStartTime(start)
        .setDuration(chunkDuration)
        .output(chunkPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    chunkPaths.push(chunkPath);
  }
  return chunkPaths;
}

// Worker process
async function processAudioJob(job: Job) {
  const { job_id, path: filePath, mimetype } = job.data;
  let chunkFilesToCleanup: string[] = [];
  try {
    await AudioJob.updateOne({ job_id }, { status: 'processing', updated_at: new Date() });
    // Mock FFmpeg extraction
    const audioPath = await mockExtractAudio(filePath, mimetype);
    // Chunk audio if over 20MB
    const audioChunks = await chunkAudioFile(audioPath, 20);
    if (audioChunks.length > 1) chunkFilesToCleanup = audioChunks;
    // For each chunk, send to AssemblyAI (real API)
    let transcript = '';
    for (const chunk of audioChunks) {
      try {
        console.log(`[AssemblyAI] Transcribing chunk: ${chunk}`);
        transcript += await transcribeWithAssemblyAI(chunk) + '\n';
      } catch (err: any) {
        console.error(`[AssemblyAI] Error transcribing chunk: ${chunk}`, err.message);
        throw err;
      }
    }
    // Summarize with Gemini via Requesty
    let summary = '';
    try {
      console.log(`[Gemini] Summarizing transcript for job: ${job_id}`);
      summary = await summarizeWithGemini(transcript);
    } catch (err: any) {
      console.error(`[Gemini] Error summarizing transcript for job: ${job_id}`, err.message);
      throw err;
    }
    await AudioJob.updateOne(
      { job_id },
      {
        status: 'completed',
        transcript,
        summary,
        updated_at: new Date(),
      }
    );
    // Clean up chunk files if any
    for (const f of chunkFilesToCleanup) {
      if (f !== filePath && fs.existsSync(f)) fs.unlinkSync(f);
    }
    return { transcript, summary };
  } catch (err: any) {
    // Clean up chunk files if any
    for (const f of chunkFilesToCleanup) {
      if (f !== filePath && fs.existsSync(f)) fs.unlinkSync(f);
    }
    await AudioJob.updateOne(
      { job_id },
      {
        status: 'failed',
        error_message: err.message || 'Processing error',
        updated_at: new Date(),
      }
    );
    throw err;
  }
} 