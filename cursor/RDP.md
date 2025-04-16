---
description: 
globs: 
alwaysApply: false
---
Here’s a comprehensive plan for your app that uses OpenAI to process audio files (MP3 and MP4), transcribe the conversation, and generate a deep summary. The app will allow users to upload audio files via a web interface, and it will return two outputs: a full transcript of the conversation and a detailed summary. Below, I’ll outline the objectives, features, technical implementation, user flow, and additional considerations to ensure the app meets your needs.

App Objective
Create a web-based application that:
    • Accepts audio file uploads in MP3 and MP4 formats.
    • Transcribes the audio into text using OpenAI’s Whisper model.
    • Generates a deep summary of the conversation using a GPT model.
    • Provides users with both the transcript and summary in an accessible format.

Features
    • File Upload Support: Users can upload MP3 and MP4 audio files.
    • Audio Extraction: For MP4 files, extract the audio track to process it.
    • Transcription: Generate a full transcript of the conversation with timestamps for each segment.
    • Deep Summary: Produce a concise yet detailed summary (approximately 200-300 words) of the conversation.
    • User-Friendly Interface: A simple web interface for uploading files and viewing results.
    • Background Processing: Process files asynchronously to handle long audio files efficiently, providing users with a status link.
    • Output Delivery: Display the transcript and summary on the web page with options to download them.

Technical Implementation
Here’s how the app will be built, broken down into key components:
Frontend
    • Technology: Use React (or a similar framework) to create an intuitive interface.
    • Components:
        ◦ Upload form for selecting and submitting audio files.
        ◦ Status page to display processing progress and final results.
    • Functionality: Allow users to drag-and-drop or browse for MP3/MP4 files and check the status of their upload via a unique link.
Backend
    • Technology: Node.js with Express for handling requests and file processing.
    • File Handling: Use a library like multer to manage file uploads, storing them temporarily on the server.
    • Job Queue: Implement Bull with Redis to manage background processing tasks, ensuring the app can handle multiple users and long files efficiently.
    • Database: Use MongoDB to track job status and store results:
        ◦ Schema:
            ▪ job_id: Unique identifier (e.g., UUID).
            ▪ status: Current state (pending, processing, completed, failed).
            ▪ audio_file_path: Path to the temporary audio file.
            ▪ transcript: Full text of the transcription.
            ▪ summary: Summary text.
            ▪ error_message: Details if processing fails.
            ▪ created_at and updated_at: Timestamps for tracking.
Audio Processing
    • Tool: Use FFmpeg to extract audio from MP4 files (MP3 files can be processed directly).
    • Command Example: ffmpeg -i input.mp4 -vn -acodec mp3 output.mp3 (extracts audio, skips video).
Transcription
    • Tool: OpenAI’s Whisper API for speech-to-text conversion.
    • Features: Generates transcripts with timestamps for each spoken segment.
    • Large File Handling: If files exceed Whisper’s size limit (e.g., 25MB), split them into chunks, transcribe each separately, and combine the results with adjusted timestamps.
Summarization
    • Tool: OpenAI’s GPT API for text summarization.
    • Prompt: “Provide a detailed summary of the following conversation in approximately 200-300 words, capturing the main topics, key points, and conclusions: [transcript]”
    • Long Transcripts: If the transcript exceeds GPT’s token limit, summarize in sections and combine the results into a cohesive summary.
File Storage
    • Temporary Storage: Store uploaded audio files temporarily, deleting them after processing to save space and ensure privacy.
    • Results Storage: Save transcripts and summaries in the MongoDB database for easy retrieval.

User Flow
Here’s how users will interact with the app:
    1. Upload Audio File:
        ◦ User visits the web app and uploads an MP3 or MP4 file via the upload form.
    2. Job Creation:
        ◦ The app generates a unique job_id (e.g., a long random string) and returns a status link (e.g., /results/job_id).
        ◦ The file is saved temporarily, and a job is added to the queue.
    3. Background Processing:
        ◦ A worker picks up the job and:
            ▪ Extracts audio from MP4 files using FFmpeg (if needed).
            ▪ Sends the audio to the Whisper API for transcription.
            ▪ Sends the transcript to the GPT API for summarization.
            ▪ Updates the database with the transcript, summary, and status (“completed”).
    4. Status Check:
        ◦ User visits the status link to see if processing is ongoing (“pending” or “processing”) or complete.
    5. View Results:
        ◦ Once processing is done, the status page displays the full transcript (with timestamps) and the summary.
        ◦ Options are provided to download both as text files.

Additional Considerations
    • Large File Handling:
        ◦ Split audio files exceeding API limits into manageable chunks, ensuring seamless transcription and summarization.
    • User Feedback:
        ◦ Show progress messages like “Uploading…”, “Processing…”, or “Completed” on the status page.
    • Error Handling:
        ◦ Gracefully manage issues like poor audio quality, file format errors, or API failures, updating the job status to “failed” with an error message.
    • Security:
        ◦ Use HTTPS for secure data transfer.
        ◦ Ensure job_id is long and random to prevent unauthorized access.
        ◦ Delete temporary files after processing.
    • Cost Management:
        ◦ Monitor OpenAI API usage (Whisper costs per minute, GPT costs per token) to estimate per-job costs.
        ◦ Consider setting upload size or duration limits for free usage.
    • Scalability:
        ◦ Use a job queue to handle multiple simultaneous requests efficiently.
    • Audio Quality:
        ◦ Note to users that transcription accuracy depends on audio clarity (e.g., minimal background noise).