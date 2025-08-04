import { getMockAllInvoices } from './mock-api.js';

const CACHE_KEY = 'stampThreadCache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Manages fetching and caching of thread and invoice data.
 * It uses a mock API for now, but is designed to be swapped with
 * a real API client.
 */
export class ThreadDataManager {
    constructor(apiClient) {
        this.apiClient = apiClient;
        console.log('[ThreadDataManager] Initialized.');
    }

    /**
     * Retrieves data for a list of thread IDs, utilizing a cache to minimize requests.
     * @param {string[]} threadIds - An array of Gmail thread IDs.
     * @returns {Promise<object>} A promise that resolves to a map of threadId -> threadData.
     */
    async getThreadData(threadIds) {
        console.log('[ThreadDataManager] getThreadData called for:', threadIds);
        const cache = await this._getCache();
        const now = Date.now();
        const threadsToFetch = [];
        const threadsFromCache = {};

        for (const id of threadIds) {
            if (cache[id] && (now - cache[id].timestamp < CACHE_TTL_MS)) {
                threadsFromCache[id] = cache[id].data;
            } else {
                threadsToFetch.push(id);
            }
        }

        console.log(`[ThreadDataManager] From cache: ${Object.keys(threadsFromCache).length}, To fetch: ${threadsToFetch.length}`);

        if (threadsToFetch.length === 0) {
            return threadsFromCache;
        }

        // --- REAL API CALL ---
        let newlyFetchedData = {};
        
        if (this.apiClient) {
            try {
                console.log(`[ThreadDataManager] Making API call to /api/finops/threads/batch-analysis with ${threadsToFetch.length} thread IDs`);
                const response = await this.apiClient.makeAuthenticatedRequest('/api/finops/threads/batch-analysis', {
                    method: 'POST',
                    body: JSON.stringify({ threadIds: threadsToFetch })
                });
                
                const apiResponse = await response.json();
                console.log(`[ThreadDataManager] API response received:`, apiResponse);
                
                // Transform the new API response format to our expected format
                newlyFetchedData = this._transformApiResponse(apiResponse);
                console.log(`[ThreadDataManager] Transformed data:`, newlyFetchedData);
            } catch (error) {
                console.error('[ThreadDataManager] API call failed:', error);
                // Return empty object on error - this means no labels will be applied
                newlyFetchedData = {};
            }
        } else {
            console.warn('[ThreadDataManager] No API client available, returning empty data');
            newlyFetchedData = {};
        }
        // --- END API CALL ---

        // Update cache with new data
        for (const id in newlyFetchedData) {
            cache[id] = {
                data: newlyFetchedData[id],
                timestamp: now
            };
        }
        await this._setCache(cache);

        return { ...threadsFromCache, ...newlyFetchedData };
    }

    /**
     * Transforms the new API response format to our expected format.
     * @param {object} apiResponse - The raw API response
     * @returns {object} Transformed data in our expected format
     */
    _transformApiResponse(apiResponse) {
        const transformedData = {};
        console.log('[TRANSFORM] Starting API response transformation.', { apiResponse });

        if (apiResponse && Array.isArray(apiResponse.results)) {
            console.log(`[TRANSFORM] Found ${apiResponse.results.length} results to process.`);
            apiResponse.results.forEach(result => {
                if (result.status === 'success' && result.thread_id && result.data) {
                    const threadId = result.thread_id;
                    console.log(`[TRANSFORM] Processing successful result for thread: ${threadId}`, { data: result.data });
                    transformedData[threadId] = {
                        threadId: threadId,
                        threadLabels: result.data.thread_labels || [],
                        processedEntities: result.data.processed_entities || [],
                        entities: result.data.entities || []
                    };
                } else {
                    console.warn('[TRANSFORM] Skipping a result due to failure status or missing data.', { result });
                }
            });
        } else {
            console.warn('[TRANSFORM] API response is not in the expected format (missing or invalid "results" array).', { apiResponse });
        }
        
        console.log('[TRANSFORM] Transformation complete.', { transformedData });
        return transformedData;
    }

    /**
     * Retrieves all invoices for the Invoice Tracker view.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of all invoices.
     */
    async getAllInvoices() {
        console.log('[ThreadDataManager] getAllInvoices called.');
        // --- MOCK API CALL ---
        return getMockAllInvoices();
        // --- END MOCK ---
    }

    /**
     * Private helper to get the cache from chrome.storage.local.
     */
    async _getCache() {
        try {
            const result = await chrome.storage.local.get([CACHE_KEY]);
            return result[CACHE_KEY] || {};
        } catch (error) {
            console.error('[ThreadDataManager] Error reading from cache:', error);
            return {};
        }
    }

    /**
     * Private helper to save the cache to chrome.storage.local.
     */
    async _setCache(cacheData) {
        try {
            await chrome.storage.local.set({ [CACHE_KEY]: cacheData });
        } catch (error) {
            console.error('[ThreadDataManager] Error writing to cache:', error);
        }
    }
} 