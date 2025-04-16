import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

export async function transcribeWithAssemblyAI(filePath: string): Promise<string> {
  if (!ASSEMBLYAI_API_KEY) throw new Error('AssemblyAI API key not set');

  // 1. Upload file to AssemblyAI
  const fileData = fs.readFileSync(filePath);
  const uploadRes = await axios.post(
    'https://api.assemblyai.com/v2/upload',
    fileData,
    {
      headers: { authorization: ASSEMBLYAI_API_KEY, 'content-type': 'application/octet-stream' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );
  const uploadUrl = uploadRes.data.upload_url;

  // 2. Start transcription with speaker labels enabled
  const transcriptRes = await axios.post(
    'https://api.assemblyai.com/v2/transcript',
    { audio_url: uploadUrl, speaker_labels: true },
    { headers: { authorization: ASSEMBLYAI_API_KEY } }
  );
  const transcriptId = transcriptRes.data.id;

  // 3. Poll for completion
  let status = transcriptRes.data.status;
  let transcriptText = '';
  let utterances: { speaker: number; text: string }[] = [];
  while (status !== 'completed' && status !== 'error') {
    await new Promise(res => setTimeout(res, 3000));
    const pollRes = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { authorization: ASSEMBLYAI_API_KEY } }
    );
    status = pollRes.data.status;
    if (status === 'completed') {
      transcriptText = pollRes.data.text;
      utterances = pollRes.data.utterances || [];
    }
    if (status === 'error') {
      throw new Error('AssemblyAI transcription failed: ' + pollRes.data.error);
    }
  }

  // If utterances are present, format with speaker labels
  if (utterances.length > 0) {
    return utterances.map(u => `Speaker ${u.speaker}: ${u.text}`).join('\n');
  }
  return transcriptText;
}