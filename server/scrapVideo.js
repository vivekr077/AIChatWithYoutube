import { fetchTranscript } from 'youtube-transcript-plus';
import { addYTVideoToVectorStore } from './embeddings.js';
import axios from 'axios';

class YouTubeScraper {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 2000; 
        this.timeout = 30000; 
    }

    extractVideoId(url) {
        if (url.includes('youtu.be')) {
            const match = url.match(/youtu\.be\/([^?&]+)/);
            return match ? match[1] : null;
        }

        const patterns = [
            /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
            /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
            /(?:youtube\.com\/v\/)([^&\n?#]+)/,
            /(?:m\.youtube\.com\/watch\?v=)([^&\n?#]+)/,
            /(?:youtube\.com\/live\/)([^&\n?#]+)/ 
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async checkVideoAvailability(videoId) {
        try {
            const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (response.status === 200 && !response.data.includes('Video unavailable')) {
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`Video availability check failed for ${videoId}:`, error.message);
            return true;
        }
    }

    async getTranscriptWithFallbacks(videoId) {
        const strategies = [
            () => fetchTranscript(videoId),
            
            () => fetchTranscript(videoId, { lang: 'en' }),
            
            () => fetchTranscript(videoId, { lang: 'en-US' }),
            
            () => fetchTranscript(videoId, { lang: 'auto' }),
            
            () => fetchTranscript(videoId, { country: 'US' })
        ];

        let lastError = null;

        for (let i = 0; i < strategies.length; i++) {
            try {
                console.log(`Trying strategy ${i + 1} for video ${videoId}`);
                const transcript = await strategies[i]();
                
                if (transcript && transcript.length > 0) {
                    console.log(`Strategy ${i + 1} succeeded for video ${videoId}`);
                    return transcript;
                }
            } catch (error) {
                console.log(`Strategy ${i + 1} failed for video ${videoId}:`, error.message);
                lastError = error;
                

                if (i < strategies.length - 1) {
                    await this.sleep(1000);
                }
            }
        }

        throw lastError || new Error('All transcript strategies failed');
    }

    async getTranscript(videoId) {
        const isAvailable = await this.checkVideoAvailability(videoId);
        if (!isAvailable) {
            return {
                success: false,
                videoId,
                error: 'Video is unavailable (private, deleted, or restricted)',
                transcript: null
            };
        }

        let lastError = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`Attempt ${attempt}/${this.maxRetries} for video ${videoId}`);
                
                const transcript = await Promise.race([
                    this.getTranscriptWithFallbacks(videoId),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), this.timeout)
                    )
                ]);
                
                if (!transcript || transcript.length === 0) {
                    throw new Error('No transcript segments found - video may not have captions enabled');
                }

                const fullText = transcript
                    .map(item => item.text || item.content || '')
                    .filter(text => text.trim().length > 0)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (!fullText || fullText.length === 0) {
                    throw new Error('Transcript segments exist but contain no readable text');
                }

                console.log(`Successfully got transcript for video ${videoId} (${transcript.length} segments)`);
                
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
                        source: 'youtube-transcript-plus',
                        attempts: attempt
                    }
                };

            } catch (error) {
                lastError = error;
                console.error(`Attempt ${attempt} failed for video ${videoId}:`, error.message);


                if (error.message.includes('Video unavailable') ||
                    error.message.includes('private') ||
                    error.message.includes('Transcript is disabled')) {
                    break;
                }
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.log(`Waiting ${delay}ms before retry...`);
                    await this.sleep(delay);
                }
            }
        }

        let errorMessage = lastError?.message || 'Unknown error occurred';
        if (errorMessage.includes('Transcript is disabled')) {
            errorMessage = 'Transcripts/captions are disabled for this video';
        } else if (errorMessage.includes('No transcripts were found') || 
                   errorMessage.includes('No transcript segments found')) {
            errorMessage = 'No transcripts available for this video (no captions enabled)';
        } else if (errorMessage.includes('Video unavailable')) {
            errorMessage = 'Video is unavailable (private, deleted, or restricted)';
        } else if (errorMessage.includes('Timeout')) {
            errorMessage = 'Request timed out - video may be too long or server is slow';
        } else if (errorMessage.includes('Network Error') || errorMessage.includes('ENOTFOUND')) {
            errorMessage = 'Network connection issue - please try again later';
        }
        
        return {
            success: false,
            videoId,
            error: `${errorMessage} (after ${this.maxRetries} attempts)`,
            transcript: null,
            metadata: {
                attempts: this.maxRetries,
                lastError: lastError?.message
            }
        };
    }

    async scrapeVideo(url) {
        console.log(`Starting to scrape video: ${url}`);
        
        const videoId = this.extractVideoId(url);
        
        if (!videoId) {
            console.error(`Failed to extract video ID from URL: ${url}`);
            return {
                success: false,
                error: 'Invalid YouTube URL or could not extract video ID',
                url
            };
        }

        console.log(`Extracted video ID: ${videoId}`);
        
        const transcriptData = await this.getTranscript(videoId);
        console.log("Transcript result:", {
            success: transcriptData.success,
            error: transcriptData.error,
            segmentCount: transcriptData.transcript?.segmentCount || 0
        });

        // Only add to vector store if successful
        if (transcriptData.success && transcriptData.transcript?.text) {
            try {
                console.log(`Adding video ${videoId} to vector store...`);
                await addYTVideoToVectorStore({
                    videoId: videoId,
                    transcript: transcriptData.transcript.text,
                    segments: transcriptData.transcript.segments,
                    metadata: transcriptData.metadata
                });
                console.log(`Successfully added video ${videoId} to vector store`);
            } catch (error) {
                console.error(`Failed to add video ${videoId} to vector store:`, error);
                // Don't fail the entire operation, just log the error
            }
        }
        
        return {
            success: transcriptData.success,
            url,
            videoId,
            transcript: transcriptData.transcript,
            metadata: transcriptData.metadata || { source: 'enhanced' },
            error: transcriptData.error || null
        };
    }
}

export { YouTubeScraper };