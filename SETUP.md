# Setup Guide

This guide will help you get your YouTube Video App running with API keys.

## Step 1: Get YouTube Data API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
   - Click "Select a project" → "New Project"
   - Enter project name → Click "Create"
3. Enable YouTube Data API v3
   - Go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click it and press "Enable"
4. Create API Key
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy your new API key
5. (Optional) Restrict the key
   - Click on your API key to edit it
   - Under "API restrictions" → Select "Restrict key"
   - Choose "YouTube Data API v3"
   - Save

**Cost**: FREE
- 10,000 quota units per day
- 1 video fetch = 3 units
- ~3,300 videos per day for free

## Step 2: Get Groq API Key

1. Go to [Groq Console](https://console.groq.com/)
2. Sign up with your email (no credit card required!)
3. Navigate to "API Keys" in the sidebar
4. Click "Create API Key"
5. Give it a name (e.g., "YouTube Title Generator")
6. Copy your new API key

**Cost**: 100% FREE
- 30 requests per minute
- 14,400 requests per day
- No credit card required ever

## Step 3: Add Keys to .env File

1. Open the `.env` file in your project root
2. Paste your keys:

```env
VITE_YOUTUBE_API_KEY=AIzaSyB...your-key-here
VITE_GROQ_API_KEY=gsk_...your-key-here
```

3. Save the file

## Step 4: Test the App

1. Make sure the dev server is running:
```bash
npm run dev
```

2. Open http://localhost:3000

3. Paste a YouTube URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)

4. Press Enter or click "Load Video"

5. You should see:
   - Video thumbnail and metadata
   - Embedded video player
   - 5 AI-generated title variations

## Troubleshooting

### "YouTube API key not found"
- Make sure `.env` file exists in project root
- Check that you have `VITE_YOUTUBE_API_KEY=your-key` (no quotes)
- Restart the dev server (`Ctrl+C` then `npm run dev`)

### "Groq API key not found"
- Make sure `.env` file has `VITE_GROQ_API_KEY=your-key`
- Restart the dev server

### "Invalid YouTube API key"
- Verify the key in Google Cloud Console
- Make sure YouTube Data API v3 is enabled
- Check for extra spaces in `.env` file

### "Invalid Groq API key"
- Verify the key in Groq Console
- Make sure you copied the entire key (starts with `gsk_`)

### "Video not found or is private"
- Try a different YouTube URL
- Make sure the video is public (not private/unlisted)

## Security Notes

- ⚠️ **NEVER commit `.env` to git** (it's already in `.gitignore`)
- ⚠️ **Don't share your API keys** publicly
- ✅ The `.env.example` file is safe to commit (no real keys)
- ✅ Keys are only used in your browser, never sent to any server

## Need Help?

- YouTube API Docs: https://developers.google.com/youtube/v3
- Groq API Docs: https://console.groq.com/docs
- Open an issue on GitHub if you're stuck
