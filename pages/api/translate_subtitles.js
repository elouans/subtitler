import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle file uploads manually
  },
};

const runPythonTranslation = (inputPath, outputPath, fromLang, toLang, onProgress) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'scripts', 'translate_srt.py'), // Path to the Python script
      inputPath,
      outputPath,
      fromLang,
      toLang,
    ]);

    pythonProcess.stdout.on('data', (data) => {
      const progress = data.toString();
      onProgress(progress);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python script error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python script exited with code ${code}`));
      }
    });
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create temporary storage directory
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Collect multipart form data
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const boundary = req.headers['content-type'].split('boundary=')[1];
    const body = Buffer.concat(chunks).toString();
    const parts = body.split(`--${boundary}`);

    // Extract file
    const filePart = parts.find((part) => part.includes('name="file"'));
    const fileContentStart = filePart.indexOf('\r\n\r\n') + 4;
    const fileContentEnd = filePart.lastIndexOf('\r\n');
    const fileContent = filePart.slice(fileContentStart, fileContentEnd);
    const fileNameMatch = filePart.match(/filename="(.+?)"/);
    const originalFilename = fileNameMatch ? fileNameMatch[1] : 'file.srt';
    const inputPath = path.join(tempDir, `temp_${originalFilename}`);

    fs.writeFileSync(inputPath, fileContent);

    // Extract language codes
    const fromLang = parts.find((part) => part.includes('name="fromLang"')).split('\r\n\r\n')[1].trim();
    const toLang = parts.find((part) => part.includes('name="toLang"')).split('\r\n\r\n')[1].trim();

    // Output path for the translated file
    const outputPath = path.join(tempDir, `translated_${originalFilename}`);

    // SSE to send progress updates
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Start the translation process
    await runPythonTranslation(inputPath, outputPath, fromLang, toLang, (progress) => {
      res.write(`data: ${progress}\n\n`); // Send progress updates to the client
    });

    // Send the translated file as a download link
    const translatedContent = fs.readFileSync(outputPath);
    res.write(`data: Translation completed. Downloading file...\n\n`);
    res.write(`data: ${Buffer.from(translatedContent).toString('base64')}\n\n`); // Send file content as Base64 for client-side handling
    res.end();

    // Clean up temporary files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process translation' });
  }
}
