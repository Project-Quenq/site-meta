const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'text/html'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    const query = event.queryStringParameters.q;
    if (!query) {
        return { statusCode: 400, body: 'Search query "q" is required.', headers };
    }

    try {
        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(bingUrl, { headers: { 'User-Agent': USER_AGENT } });

        const dom = new JSDOM(response.data);
        const doc = dom.window.document;

        doc.querySelector('#b_header')?.remove();
        doc.querySelector('#b_footer')?.remove();

        const head = doc.querySelector('head');
        if (head) {
            const script = doc.createElement('script');
            script.innerHTML = `
                document.addEventListener('DOMContentLoaded', () => {
                    const API_ENDPOINT = 'https://rxpappinstaller.netlify.app/.netlify/functions/metadata';

                    document.body.addEventListener('click', async (e) => {
                        const link = e.target.closest('a');
                        
                        if (link && link.href && link.href.startsWith('http') && link.target === '_blank') {
                            e.preventDefault();
                            e.stopPropagation();

                            const originalUrl = link.href;

                            const originalText = link.innerHTML;
                            link.innerHTML += ' <i>(Checking...)</i>';

                            try {
                                const apiResponse = await fetch(API_ENDPOINT, { headers: { 'target_url': originalUrl } });
                                const data = await apiResponse.json();
                                
                                const isRestricted = data.site && data.site.xframe_restricted;
                                
                                window.parent.postMessage({
                                    action: 'rebornxp_navigation_request',
                                    url: originalUrl,
                                    isRestricted: isRestricted
                                }, '*');

                            } catch (err) {
                                window.parent.postMessage({
                                    action: 'rebornxp_navigation_request',
                                    url: originalUrl,
                                    isRestricted: true
                                }, '*');
                            } finally {
                                link.innerHTML = originalText;
                            }
                        }
                    });
                });
            `;
            head.appendChild(script);

            doc.querySelectorAll('a[href^="http"]').forEach(a => {
                a.target = '_blank';
            });
        }

        return {
            statusCode: 200,
            body: dom.serialize(),
            headers
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: `Error fetching search results: ${error.message}`,
            headers
        };
    }
};