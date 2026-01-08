// YouTube Video App with Metadata & AI Title Generation

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface YouTubeURLResult {
  isValid: boolean;
  videoId?: string;
  error?: string;
}

interface VideoMetadata {
  title: string;
  channelTitle: string;
  duration: string;
  thumbnailUrl: string;
  description?: string;
}

interface TitleVariation {
  tone: string;
  title: string;
}

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

class ApiKeyManager {
  static getYouTubeKey(): string | null {
    return import.meta.env.VITE_YOUTUBE_API_KEY || null;
  }

  static getGroqKey(): string | null {
    return import.meta.env.VITE_GROQ_API_KEY || null;
  }

  static hasYouTubeKey(): boolean {
    const key = this.getYouTubeKey();
    return key !== null && key.trim() !== '';
  }

  static hasGroqKey(): boolean {
    const key = this.getGroqKey();
    return key !== null && key.trim() !== '';
  }
}

// ============================================================================
// YOUTUBE API SERVICE
// ============================================================================

class YouTubeAPIService {
  private static readonly API_BASE = 'https://www.googleapis.com/youtube/v3';

  static async fetchVideoMetadata(videoId: string, apiKey: string): Promise<VideoMetadata> {
    const url = `${this.API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Invalid YouTube API key or quota exceeded. Check your Google Cloud Console.');
        }
        if (response.status === 404) {
          throw new Error('Video not found or is private.');
        }
        throw new Error(data.error?.message || 'Failed to fetch video metadata');
      }

      if (!data.items || data.items.length === 0) {
        throw new Error('Video not found or is private.');
      }

      const video = data.items[0];
      const snippet = video.snippet;
      const contentDetails = video.contentDetails;

      return {
        title: snippet.title,
        channelTitle: snippet.channelTitle,
        duration: this.parseDuration(contentDetails.duration),
        thumbnailUrl: snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url,
        description: snippet.description
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error while fetching video metadata');
    }
  }

  private static parseDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// GROQ AI SERVICE
// ============================================================================

class GroqAPIService {
  private static readonly API_BASE = 'https://api.groq.com/openai/v1';
  private static readonly MODEL = 'llama-3.3-70b-versatile';

  static async generateTitleVariations(originalTitle: string, apiKey: string): Promise<TitleVariation[]> {
    const url = `${this.API_BASE}/chat/completions`;

    const systemPrompt = `You are a creative content strategist. Given a YouTube video title, generate 4 alternative title variations with different tones:
1. Casual: friendly, conversational tone
2. Professional: formal, business-appropriate
3. Clickbait: engaging, curiosity-driven (but not misleading)
4. Academic: scholarly, informative tone

Return ONLY a valid JSON array with 4 objects, each containing "tone" and "title" fields. Do not include any other text, explanations, or markdown formatting.`;

    const requestBody = {
      model: this.MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Original YouTube title: "${originalTitle}"\n\nGenerate 4 alternative title variations with different tones.`
        }
      ],
      temperature: 0.8,
      max_tokens: 1024,
      response_format: { type: 'json_object' }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid Groq API key. Get yours at console.groq.com');
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        throw new Error(data.error?.message || 'Failed to generate title variations');
      }

      const content = data.choices[0].message.content;

      // Parse JSON from response
      let variations: TitleVariation[];
      try {
        const parsed = JSON.parse(content);

        // Handle different response formats
        if (Array.isArray(parsed)) {
          variations = parsed;
        } else if (parsed.alternatives && Array.isArray(parsed.alternatives)) {
          variations = parsed.alternatives;
        } else if (parsed.variations && Array.isArray(parsed.variations)) {
          variations = parsed.variations;
        } else if (parsed.titles && Array.isArray(parsed.titles)) {
          variations = parsed.titles;
        } else {
          // If it's an object with keys, convert to array
          variations = Object.keys(parsed).map(key => ({
            tone: key,
            title: typeof parsed[key] === 'string' ? parsed[key] : parsed[key].title || ''
          })).filter(v => v.title);
        }
      } catch (e) {
        // Try to extract JSON if there's extra text
        const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            variations = Array.isArray(parsed) ? parsed : Object.values(parsed);
          } catch {
            throw new Error('Failed to parse AI response: ' + content.substring(0, 100));
          }
        } else {
          throw new Error('No valid JSON found in AI response: ' + content.substring(0, 100));
        }
      }

      // Validate we have variations
      if (!Array.isArray(variations) || variations.length === 0) {
        throw new Error('No title variations generated. Response: ' + content.substring(0, 100));
      }

      // Ensure all variations have tone and title
      variations = variations.filter(v => v.tone && v.title);

      if (variations.length === 0) {
        throw new Error('Generated titles missing tone or title fields');
      }

      return variations;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error while generating title variations');
    }
  }
}

// ============================================================================
// URL PARSING
// ============================================================================

function parseYouTubeURL(url: string): YouTubeURLResult {
  try {
    const urlObj = new URL(url);

    // Handle youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return { isValid: true, videoId };
      }
    }

    // Handle youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1);
      if (videoId) {
        return { isValid: true, videoId };
      }
    }

    // Handle youtube.com/embed/VIDEO_ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/embed/')) {
      const videoId = urlObj.pathname.split('/')[2];
      if (videoId) {
        return { isValid: true, videoId };
      }
    }

    return { isValid: false, error: 'Invalid YouTube URL format' };
  } catch (e) {
    return { isValid: false, error: 'Invalid URL' };
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showError(message: string): void {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }
}

function hideError(): void {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.classList.add('hidden');
  }
}

function showLoading(message: string = 'Loading...'): void {
  const loadingIndicator = document.getElementById('loading-indicator');
  const loadingText = document.getElementById('loading-text');
  if (loadingIndicator && loadingText) {
    loadingText.textContent = message;
    loadingIndicator.classList.remove('hidden');
  }
}

function hideLoading(): void {
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.classList.add('hidden');
  }
}

function setSubmitButtonState(disabled: boolean): void {
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  if (submitBtn) {
    submitBtn.disabled = disabled;
    submitBtn.style.opacity = disabled ? '0.6' : '1';
    submitBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
  }
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ============================================================================
// METADATA DISPLAY
// ============================================================================

function displayMetadata(metadata: VideoMetadata): void {
  const metadataSection = document.getElementById('metadata-section');
  const thumbnail = document.getElementById('thumbnail') as HTMLImageElement;
  const videoTitle = document.getElementById('video-title');
  const videoChannel = document.getElementById('video-channel');
  const videoDuration = document.getElementById('video-duration');

  if (metadataSection && thumbnail && videoTitle && videoChannel && videoDuration) {
    thumbnail.src = metadata.thumbnailUrl;
    videoTitle.textContent = metadata.title;
    videoChannel.textContent = `Channel: ${metadata.channelTitle}`;
    videoDuration.textContent = `Duration: ${metadata.duration}`;
    metadataSection.classList.remove('hidden');
  }
}

function hideMetadata(): void {
  const metadataSection = document.getElementById('metadata-section');
  if (metadataSection) {
    metadataSection.classList.add('hidden');
  }
}

// ============================================================================
// TITLE VARIATIONS DISPLAY
// ============================================================================

let currentVideoTitle = '';

function displayTitleVariations(originalTitle: string, variations: TitleVariation[]): void {
  currentVideoTitle = originalTitle;
  const titleVariationsSection = document.getElementById('title-variations-section');
  const titleList = document.getElementById('title-list');

  if (!titleList || !titleVariationsSection) return;

  titleList.innerHTML = '';

  // Add AI-generated variations only (no original title)
  variations.forEach(variation => {
    const card = createTitleCard(variation.tone.toLowerCase(), variation.title);
    titleList.appendChild(card);
  });

  titleVariationsSection.classList.remove('hidden');
}

function createTitleCard(tone: string, title: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'title-card';

  const badge = document.createElement('span');
  badge.className = `tone-badge ${tone}`;
  badge.textContent = tone;

  const titleText = document.createElement('p');
  titleText.className = 'title-text';
  titleText.textContent = title;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = '📋 Copy';
  copyBtn.addEventListener('click', () => copyToClipboard(title, copyBtn));

  card.appendChild(badge);
  card.appendChild(titleText);
  card.appendChild(copyBtn);

  return card;
}

function hideTitleVariations(): void {
  const titleVariationsSection = document.getElementById('title-variations-section');
  if (titleVariationsSection) {
    titleVariationsSection.classList.add('hidden');
  }
}

async function copyToClipboard(text: string, button: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = button.textContent;
    button.textContent = '✓ Copied!';
    button.classList.add('copied');
    showToast('Title copied to clipboard!');

    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  } catch (error) {
    showToast('Failed to copy to clipboard');
  }
}

// ============================================================================
// VIDEO DISPLAY
// ============================================================================

function loadVideo(videoId: string): void {
  const videoContainer = document.getElementById('video-container');
  const videoPlayer = document.getElementById('video-player') as HTMLIFrameElement;

  if (videoContainer && videoPlayer) {
    videoPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    videoContainer.classList.remove('hidden');
  }
}

function hideVideo(): void {
  const videoContainer = document.getElementById('video-container');
  if (videoContainer) {
    videoContainer.classList.add('hidden');
  }
}

// ============================================================================
// MAIN SUBMISSION HANDLER
// ============================================================================

async function handleSubmit(): Promise<void> {
  const input = document.getElementById('youtube-url-input') as HTMLInputElement;
  const url = input.value.trim();

  if (!url) {
    showError('Please enter a YouTube URL');
    return;
  }

  // Validate API keys
  if (!ApiKeyManager.hasYouTubeKey()) {
    showError('YouTube API key not found. Please add VITE_YOUTUBE_API_KEY to your .env file.');
    return;
  }

  if (!ApiKeyManager.hasGroqKey()) {
    showError('Groq API key not found. Please add VITE_GROQ_API_KEY to your .env file.');
    return;
  }

  hideError();
  hideMetadata();
  hideTitleVariations();
  hideVideo();

  const result = parseYouTubeURL(url);

  if (!result.isValid || !result.videoId) {
    showError(result.error || 'Invalid YouTube URL');
    return;
  }

  setSubmitButtonState(true);

  try {
    // Step 1: Fetch video metadata
    showLoading('Fetching video metadata...');
    const metadata = await YouTubeAPIService.fetchVideoMetadata(
      result.videoId,
      ApiKeyManager.getYouTubeKey()!
    );
    displayMetadata(metadata);

    // Step 2: Load video embed
    loadVideo(result.videoId);

    // Step 3: Generate AI title variations
    showLoading('Generating AI title variations...');
    const variations = await GroqAPIService.generateTitleVariations(
      metadata.title,
      ApiKeyManager.getGroqKey()!
    );
    displayTitleVariations(metadata.title, variations);

    hideLoading();
  } catch (error) {
    hideLoading();
    if (error instanceof Error) {
      showError(error.message);
    } else {
      showError('An unexpected error occurred');
    }
  } finally {
    setSubmitButtonState(false);
  }
}

// ============================================================================
// REGENERATE TITLES HANDLER
// ============================================================================

async function handleRegenerateTitles(): Promise<void> {
  if (!currentVideoTitle) return;

  if (!ApiKeyManager.hasGroqKey()) {
    showError('Groq API key not found. Please add VITE_GROQ_API_KEY to your .env file.');
    return;
  }

  const regenerateBtn = document.getElementById('regenerate-btn') as HTMLButtonElement;
  if (regenerateBtn) {
    regenerateBtn.disabled = true;
  }

  try {
    showLoading('Regenerating title variations...');
    const variations = await GroqAPIService.generateTitleVariations(
      currentVideoTitle,
      ApiKeyManager.getGroqKey()!
    );
    displayTitleVariations(currentVideoTitle, variations);
    hideLoading();
    showToast('Titles regenerated successfully!');
  } catch (error) {
    hideLoading();
    if (error instanceof Error) {
      showError(error.message);
    } else {
      showError('Failed to regenerate titles');
    }
  } finally {
    if (regenerateBtn) {
      regenerateBtn.disabled = false;
    }
  }
}


// ============================================================================
// INITIALIZATION
// ============================================================================

function init(): void {
  const submitBtn = document.getElementById('submit-btn');
  const input = document.getElementById('youtube-url-input') as HTMLInputElement;
  const regenerateBtn = document.getElementById('regenerate-btn');

  // Handle submit button click
  submitBtn?.addEventListener('click', handleSubmit);

  // Handle Enter key press
  input?.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  });

  // Handle regenerate button click
  regenerateBtn?.addEventListener('click', handleRegenerateTitles);
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
