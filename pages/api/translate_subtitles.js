import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle file uploads manually
  },
};

const runPythonTranslation = (inputPath, outputPath, fromLang, toLang) => {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'scripts', 'translate_srt.py'), // Path to the Python script
      inputPath,
      outputPath,
      fromLang,
      toLang,
    ]);

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python script error: ${data}`);
      reject(new Error(data.toString()));
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
    const tempDir = '/tmp'; // Use /tmp as the temp directory

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
    const inputPath = path.join(tempDir, `tmp_${originalFilename}`);

    await fs.promises.writeFile(inputPath, fileContent);

    // Extract language codes
    const fromLang = parts.find((part) => part.includes('name="fromLang"')).split('\r\n\r\n')[1].trim();
    const toLang = parts.find((part) => part.includes('name="toLang"')).split('\r\n\r\n')[1].trim();

    // Output path for the translated file
    const outputPath = path.join(tempDir, `translated_${originalFilename}`);

    // Start the translation process
    await runPythonTranslation(inputPath, outputPath, fromLang, toLang);

    // Read and send the translated file
    const translatedContent = await fs.promises.readFile(outputPath);

    // Set response headers and send file
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="translated_${originalFilename}"`);
    res.send(translatedContent);

    // Clean up temporary files
    await fs.promises.unlink(inputPath);
    await fs.promises.unlink(outputPath);
  } catch (error) {
    console.error('Error translating subtitles:', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
