import mongoose, { Document, Schema } from 'mongoose';

export interface IAudioJob extends Document {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  audio_file_path: string;
  transcript?: string;
  summary?: string;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

const AudioJobSchema: Schema = new Schema({
  job_id: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], required: true },
  audio_file_path: { type: String, required: true },
  transcript: { type: String },
  summary: { type: String },
  error_message: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

AudioJobSchema.pre<IAudioJob>('save', function (next) {
  this.updated_at = new Date();
  next();
});

export default mongoose.model<IAudioJob>('AudioJob', AudioJobSchema); 