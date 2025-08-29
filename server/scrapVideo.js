import { fetchTranscript } from 'youtube-transcript-plus';
import { addYTVideoToVectorStore } from './embeddings.js';

class YouTubeScraper {
    constructor() {}

    /**
     * Extract video ID from various YouTube URL formats
     */
    extractVideoId(url) {
        if (url.includes('youtu.be')) {
            const match = url.match(/youtu\.be\/([^?&]+)/);
            return match ? match[1] : null;
        }

        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
            /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
            /(?:youtube\.com\/v\/)([^&\n?#]+)/,
            /(?:m\.youtube\.com\/watch\?v=)([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Get transcript using youtube-transcript-plus
     */
    async getTranscript(videoId) {
        try {
            const transcript = await fetchTranscript(videoId);
            
            if (!transcript || transcript.length === 0) {
                return {
                    success: false,
                    videoId,
                    error: 'No transcript segments found - video may not have captions enabled',
                    transcript: null
                };
            }

            const fullText = transcript
                .map(item => item.text || item.content)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (!fullText || fullText.length === 0) {
                return {
                    success: false,
                    videoId,
                    error: 'Transcript segments exist but contain no readable text',
                    transcript: null
                };
            }

            return {
                success: true,
                videoId,
                transcript: {
                    text: fullText,
                    segments: transcript,
                    duration: transcript[transcript.length - 1]?.offset || 0,
                    segmentCount: transcript.length
                },
                metadata: {
                    language: 'auto-detected',
                    source: 'youtube-transcript-plus'
                }
            };
        } catch (error) {
            let errorMessage = error.message;
            if (error.message.includes('Transcript is disabled')) {
                errorMessage = 'Transcripts/captions are disabled for this video';
            } else if (error.message.includes('No transcripts were found')) {
                errorMessage = 'No transcripts available for this video (no captions)';
            } else if (error.message.includes('Video unavailable')) {
                errorMessage = 'Video is unavailable (private, deleted, or restricted)';
            }
            
            return {
                success: false,
                videoId,
                error: errorMessage,
                transcript: null
            };
        }
    }

    /**
     * Main scraper function
     */
    async scrapeVideo(url) {
        const videoId = this.extractVideoId(url);
        
        if (!videoId) {
            return {
                success: false,
                error: 'Invalid YouTube URL or could not extract video ID',
                url
            };
        }

        const transcriptData = await this.getTranscript(videoId);
        console.log("transcripts are: ", transcriptData);

         if (transcriptData.success) {
            await addYTVideoToVectorStore({
            videoId: videoId,
            transcript: transcriptData.transcript.text,
            segments: transcriptData.transcript.segments,
            metadata: transcriptData.metadata
            });
        }
        
        return {
            success: transcriptData.success,
            url,
            videoId,
            transcript: transcriptData.transcript,
            metadata: transcriptData.metadata || { source: 'basic' },
            error: transcriptData.error || null
        };
    }
}
export { YouTubeScraper };

// Basic usage
// const scraper = new YouTubeScraper();
// const result = await scraper.scrapeVideo('https://youtu.be/2CEhKWuC6fM?si=nGisZyNsAvu6Fp2K');

// console.log('Video ID:', result.videoId);
// console.log('Transcript:', result.transcript.text);