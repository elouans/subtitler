import { useState, ChangeEvent, FormEvent } from "react";
import { Upload } from "lucide-react";

// Language options with natural names and codes
const languageOptions = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese" },
  { code: "hi", name: "Hindi" },
];

export default function SubtitleProcessor() {
  const [translateFile, setTranslateFile] = useState<File | null>(null);
  const [fromLang, setFromLang] = useState("en");
  const [toLang, setToLang] = useState("ru");
  const [translateProgress, setTranslateProgress] = useState("");
  const [adjustFile, setAdjustFile] = useState<File | null>(null);
  const [timeStep, setTimeStep] = useState("");
  const [adjustProgress, setAdjustProgress] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>,
    setFile: (file: File | null) => void
  ) => {
    const files = e.target.files;
    if (!files || !files[0].name.endsWith(".srt")) {
      setError("Please select a valid .srt file");
      setFile(null);
      return;
    }
    setFile(files[0]);
    setError("");
  };

  const handleTranslate = async (e: FormEvent) => {
    e.preventDefault();
    if (!translateFile || !fromLang || !toLang) {
      setError("Please provide a subtitle file and select languages");
      return;
    }
    setIsProcessing(true);
    setTranslateProgress("Starting translation...");
    setError("");

    const formData = new FormData();
    formData.append("file", translateFile);
    formData.append("fromLang", fromLang);
    formData.append("toLang", toLang);

    try {
      const response = await fetch("/api/translate_subtitles", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(response.statusText);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (reader) {
        let progressChunk = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          progressChunk += decoder.decode(value, { stream: true });
          setTranslateProgress(progressChunk);
        }
      }

      setTranslateProgress("Translation completed.");
    } catch (err) {
      setError("Failed to process translation. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdjust = async (e: FormEvent) => {
    e.preventDefault();
    if (!adjustFile || !timeStep) {
      setError("Please provide both a subtitle file and time step value");
      return;
    }
    setIsProcessing(true);
    setAdjustProgress("Starting time adjustment...");
    setError("");

    const formData = new FormData();
    formData.append("file", adjustFile);
    formData.append("timeStep", timeStep);

    try {
      const response = await fetch("/api/process-subtitles", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(response.statusText);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `adjusted_${adjustFile.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setAdjustProgress("Time adjustment completed.");
    } catch (err) {
      setError("Failed to process subtitle adjustment. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-2 gap-6 bg-white rounded-lg shadow-md p-6">
        {/* Translation Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 text-center">
            Translate Subtitles
          </h2>
          <form onSubmit={handleTranslate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Upload your .srt file
              </label>
              <label className="flex items-center justify-center w-full px-4 py-6 bg-gray-100 border border-gray-300 rounded-md cursor-pointer">
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">
                  {translateFile ? translateFile.name : "Select .srt file"}
                </span>
                <input
                  type="file"
                  accept=".srt"
                  onChange={(e) => handleFileChange(e, setTranslateFile)}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Source Language
              </label>
              <select
                value={fromLang}
                onChange={(e) => setFromLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {languageOptions.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Target Language
              </label>
              <select
                value={toLang}
                onChange={(e) => setToLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {languageOptions.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            {translateProgress && (
              <div className="text-sm text-blue-600">{translateProgress}</div>
            )}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2 bg-blue-600 text-white rounded-md"
            >
              {isProcessing ? "Processing..." : "Translate"}
            </button>
          </form>
        </div>

        {/* Time Adjustment Section */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 text-center">
            Adjust Subtitles Timing
          </h2>
          <form onSubmit={handleAdjust} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Upload your .srt file
              </label>
              <label className="flex items-center justify-center w-full px-4 py-6 bg-gray-100 border border-gray-300 rounded-md cursor-pointer">
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">
                  {adjustFile ? adjustFile.name : "Select .srt file"}
                </span>
                <input
                  type="file"
                  accept=".srt"
                  onChange={(e) => handleFileChange(e, setAdjustFile)}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <input
                type="number"
                step="0.1"
                value={timeStep}
                onChange={(e) => setTimeStep(e.target.value)}
                placeholder="Time Step (in seconds)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            {adjustProgress && (
              <div className="text-sm text-blue-600">{adjustProgress}</div>
            )}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2 bg-blue-600 text-white rounded-md"
            >
              {isProcessing ? "Processing..." : "Adjust Timing"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
