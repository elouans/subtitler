import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';

export const config = {
  api: {
    bodyParser: false,
  },
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
    timecode_pattern = re.compile(r'(\\d{2}:\\d{2}:\\d{2},\\d{3}) --> (\\d{2}:\\d{2}:\\d{2},\\d{3})')

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

shift_srt_timing(r'${inputPath}', r'${outputPath}', ${timeStep})
      `,
    ]);

    process.stderr.on('data', (data) => {
      console.error(`Python script error: ${data.toString()}`);
      reject(new Error(`Python script error: ${data}`));
    });

    process.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });
  });
};

export default async function handler(req, res) {

  console.log('Request received:', {
    method: req.method,
    headers: req.headers,
  });
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    console.log('Here1');
    const boundary = req.headers['content-type'].split('boundary=')[1];
    const body = Buffer.concat(chunks).toString();
    const parts = body.split(`--${boundary}`);
    const timeStep = parts
      .find((part) => part.includes('name="timeStep"'))
      .split('\r\n\r\n')[1]
      .trim();
    const filePart = parts.find((part) => part.includes('name="file"'));
    const fileContentStart = filePart.indexOf('\r\n\r\n') + 4;
    const fileContentEnd = filePart.lastIndexOf('\r\n');
    const fileContent = filePart.slice(fileContentStart, fileContentEnd);
    const fileNameMatch = filePart.match(/filename="(.+?)"/);
    const originalFilename = fileNameMatch ? fileNameMatch[1] : 'file.srt';
    console.log('Here2');
    const inputPath = path.join(tempDir, `temp_${originalFilename}`);
    const outputPath = path.join(tempDir, `adjusted_${originalFilename}`);

    await fs.promises.writeFile(inputPath, fileContent);
    console.log(inputPath);
    console.log(outputPath);
    console.log(timeStep);
    await processSubtitles(inputPath, outputPath, timeStep);
    console.log('Here4');
    const processedContent = await fs.promises.readFile(outputPath);

    await fs.promises.unlink(inputPath);
    await fs.promises.unlink(outputPath);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="adjusted_${originalFilename}"`);
    res.send(processedContent);
  } catch (error) {
    res.status(500).json({ error: 'Something' });
  }
}
