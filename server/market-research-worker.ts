import { chromium } from 'playwright';
import googleTrends from 'google-trends-api';
import { MarketReport, GoogleTrendsData } from '../types';

// --- Google Trends ---

export async function fetchGoogleTrends(keyword: string): Promise<GoogleTrendsData | null> {
    try {
        const results = await googleTrends.interestOverTime({ keyword: keyword });
        const data = JSON.parse(results);
        
        if (!data.default || !data.default.timelineData) return null;

        const timeline = data.default.timelineData.map((item: any) => ({
            month: item.formattedAxisTime, // e.g. "Dec 2023"
            value: item.value[0]
        }));

        // Get related queries if possible (separate call usually, but let's try to infer or skip for now to keep it simple, 
        // actually google-trends-api has relatedQueries method)
        const relatedRes = await googleTrends.relatedQueries({ keyword: keyword });
        const relatedData = JSON.parse(relatedRes);
        const related = relatedData.default?.rankedList?.[0]?.rankedKeyword?.slice(0, 5).map((item: any) => ({
             query: item.query,
             value: item.value // interest level
        })) || [];

        return {
            interestOverTime: timeline,
            relatedQueries: related
        };

    } catch (e) {
        console.error("Google Trends Error:", e);
        return null;
    }
}

// --- Amazon Scraping ---

export interface ScrapedBook {
    title: string;
    author: string;
    price: string;
    rating: string;
    reviewCount: string;
    url: string;
    imgUrl: string;
}

export async function fetchAmazonCompetitors(keyword: string): Promise<ScrapedBook[]> {
    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
             userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });
        const page = await context.newPage();
        
        // Amazon Search URL
        const query = encodeURIComponent(keyword + " books");
        await page.goto(`https://www.amazon.com/s?k=${query}&i=stripbooks`, { waitUntil: 'domcontentloaded' });

        // Wait a bit purely for anti-bot
        await page.waitForTimeout(2000);

        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('.s-result-item[data-component-type="s-search-result"]');
            const data: any[] = [];
            
            items.forEach(item => {
                if (data.length >= 6) return; // Limit to 6

                const titleEl = item.querySelector('h2 a span');
                const authorEl = item.querySelector('.a-row .a-size-base'); // Heuristic
                const priceEl = item.querySelector('.a-price .a-offscreen');
                const ratingEl = item.querySelector('i[class*="a-star-small"] span'); // "4.5 out of 5 stars"
                const reviewCountEl = item.querySelector('span[aria-label$="stars"] + span span'); // Adjacent to stars usually? No, it's usually link next to it.
                // Better review count selector:
                const reviewCountLink = item.querySelector('a[href*="#customerReviews"] span');
                const imgEl = item.querySelector('.s-image');

                if (titleEl) {
                    data.push({
                        title: titleEl.textContent?.trim(),
                        author: authorEl ? authorEl.textContent?.trim() : 'Unknown', // This selector is flaky
                        price: priceEl ? priceEl.textContent?.trim() : 'N/A',
                        rating: ratingEl ? ratingEl.textContent?.trim() : 'N/A',
                        reviewCount: reviewCountLink ? reviewCountLink.textContent?.trim() : '0',
                        url: '', // We can get href if needed
                        imgUrl: imgEl ? (imgEl as HTMLImageElement).src : ''
                    });
                }
            });
            return data;
        });

        return results;

    } catch (e) {
        console.error("Amazon Scraping Error:", e);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

export async function fetchAmazonSuggestions(keyword: string): Promise<string[]> {
    try {
        // Amazon Autocomplete API (public endpoint used by browser)
        const response = await fetch(`https://completion.amazon.com/api/2017/suggestions?session-id=123-4567890-123456&customer-id=&request-id=12345&page-type=Search&lop=en_US&site-variant=desktop&client-info=amazon-search-ui&mid=ATVPDKIKX0DER&alias=aps&b2b=0&fresh=0&ks=65&prefix=${encodeURIComponent(keyword)}&event=onKeyPress&limit=11&fb=1&suggestion-type=KEYWORD`);
        const data = await response.json();
        
        // Format: { suggestions: [ { value: "keyword" }, ... ] }
        if (data.suggestions) {
            return data.suggestions.map((s: any) => s.value);
        }
        return [];
    } catch (e) {
        console.error("Amazon Suggestions Error:", e);
        return [];
    }
}
