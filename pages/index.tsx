import { useState, ChangeEvent, FormEvent } from 'react';
import { Upload } from 'lucide-react';

export default function SubtitleAdjuster() {
  const [file, setFile] = useState<File | null>(null);
  const [timeStep, setTimeStep] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) {
      setError('Please select a valid .srt file');
      setFile(null);
      return;
    }
    const selectedFile = files[0];
    if (selectedFile && selectedFile.name.endsWith('.srt')) {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a valid .srt file');
      setFile(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!file || !timeStep) {
      setError('Please provide both a subtitle file and time step value');
      return;
    }

    setIsProcessing(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('timeStep', timeStep);

    try {
      const response = await fetch('/api/process-subtitles', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(response.statusText);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adjusted_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      if (err instanceof Error) {
        setError('thing' + err.message);
      } else {
        setError('An unknown error occurred');
      }
      //setError('Failed to process subtitle file. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-center text-gray-800">
            Remove/subtract time from subtitles
          </h1>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Upload your .srt file
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="w-full flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="mt-2 text-sm text-gray-500">
                    {file ? file.name : 'Select .srt file'}
                  </span>
                  <input
                    type="file"
                    accept=".srt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Time Step (in seconds)
              </label>
              <input
                type="number"
                step="0.1"
                value={timeStep}
                onChange={(e) => setTimeStep(e.target.value)}
                placeholder="Enter time adjustment"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing || !file || !timeStep}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : 'Adjust Subtitles'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}