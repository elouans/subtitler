const formidable = require('formidable');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// Promise wrapper for formidable
const parseForm = async (req) => {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm({
      uploadDir: path.join(process.cwd(), 'temp'),
      keepExtensions: true
    });

    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};


const processSubtitles = async (inputPath, outputPath, timeStep) => {
  return new Promise((resolve, reject) => {
    const process = spawn('python', [
      '-c',
      `
import re
from datetime import timedelta

def parse_timecode(timecode):
    hours, minutes, seconds, milliseconds = map(int, re.split('[:,]', timecode))
    return timedelta(hours=hours, minutes=minutes, seconds=seconds, milliseconds=milliseconds)

def format_timecode(time_delta):
    total_seconds = int(time_delta.total_seconds())
    milliseconds = int(time_delta.microseconds / 1000)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f'{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}'

def shift_srt_timing(input_file, output_file, shift_seconds):
    with open(input_file, 'r', encoding='utf-8') as file:
        content = file.readlines()

    shift_timedelta = timedelta(seconds=float(shift_seconds))
    timecode_pattern = re.compile(r'(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})')

    with open(output_file, 'w', encoding='utf-8') as file:
        for line in content:
            match = timecode_pattern.match(line)
            if match:
                start_time = parse_timecode(match.group(1))
                end_time = parse_timecode(match.group(2))

                new_start_time = start_time + shift_timedelta
                new_end_time = end_time + shift_timedelta

                if new_start_time < timedelta(0):
                    new_start_time = timedelta(0)
                if new_end_time < timedelta(0):
                    new_end_time = timedelta(0)

                new_line = f"{format_timecode(new_start_time)} --> {format_timecode(new_end_time)}\\n"
                file.write(new_line)
            else:
                file.write(line)

shift_srt_timing('${inputPath}', '${outputPath}', ${timeStep})
      `,
    ]);

    process.stderr.on('data', (data) => {
      console.error(`Error: ${data}`);
      reject(new Error(`Python script error: ${data}`));
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ensure temp directory exists
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.ensureDir(tempDir);

    // Parse the form data
    const { fields, files } = await parseForm(req);
    
    // Get the file and timeStep
    const file = files.file;
    const timeStep = fields.timeStep;
    
    // Create paths for input and output files
    const inputPath = file.filepath;
    const outputPath = path.join(tempDir, `adjusted_${path.basename(file.originalFilename)}`);

    // Process the subtitles
    await processSubtitles(inputPath, outputPath, timeStep);

    // Read the processed file
    const processedContent = await fs.readFile(outputPath);

    // Clean up temporary files
    await fs.remove(inputPath);
    await fs.remove(outputPath);

    // Send the processed file
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="adjusted_${file.originalFilename}"`);
    res.send(processedContent);

  } catch (error) {
    console.error('Error processing subtitles:', error);
    res.status(500).json({ error: 'Error processing subtitles' });
  }
}