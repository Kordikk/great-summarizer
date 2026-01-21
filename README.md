# Is YT Worth It?

A Chrome extension that uses AI to summarize YouTube videos, helping you decide if a video is worth your time before watching.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![Gemini API](https://img.shields.io/badge/Gemini-1.5_Flash-blue)

## Features

- **AI-Powered Summaries** — Get structured summaries with overview, key points, and quick verdict using Google's Gemini 1.5 Flash
- **Chapter Timestamps** — Clickable timestamps that jump to specific sections of the video
- **Summary Caching** — Previously summarized videos load instantly from cache
- **History** — Browse all your past summaries with thumbnails and timestamps
- **Multi-Language** — Generate summaries in 14 different languages
- **Export Options** — Copy to clipboard, download as Markdown or plain text
- **Quick Actions** — Add to Watch Later, skip to next video, share to Twitter/LinkedIn
- **Clean UI** — Draggable, resizable overlay that matches YouTube's design with dark mode support

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/Kordikk/great-summarizer.git
   ```

2. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the cloned directory

3. Get a Gemini API key:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key
   - Click the extension icon and configure your API key

## Usage

1. Navigate to any YouTube video
2. Click the **Summarize** button that appears below the video player
3. Wait for the AI to analyze the transcript and generate a summary
4. Use the summary to decide if the video is worth watching

### Summary Features

- **Overview** — Brief description of what the video covers
- **Key Points** — Main takeaways in bullet form
- **Verdict** — Quick recommendation on whether to watch
- **Chapters** — Click any timestamp to jump to that section

### Quick Actions

- **Copy** — Copy the summary to your clipboard
- **Export** — Download as Markdown or plain text
- **Watch Later** — Add the video to your Watch Later playlist
- **Skip** — Close the overlay and play the next video
- **Share** — Share to Twitter or LinkedIn with a summary excerpt

## Configuration

Click the extension icon and select **Configure API Key** to access settings:

- **API Key** — Your Gemini API key (required)
- **Summary Language** — Choose from 14 languages for summary output

## Privacy

- **Your API key stays local** — Stored only in `chrome.storage`, never transmitted except to Google's API
- **No external servers** — All processing happens between your browser and Google's Gemini API
- **No tracking** — The extension collects no analytics or user data

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Save API key, cached summaries, and preferences |
| `activeTab` | Access YouTube page content |
| `scripting` | Inject summary UI into YouTube |
| `youtube.com` | Fetch video transcripts |
| `generativelanguage.googleapis.com` | Call Gemini API |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

https://ko-fi.com/swiftway
