const axios = require('axios');
const { JSDOM } = require('jsdom');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

exports.handler = async function(event) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

    const targetUrl = event.queryStringParameters.url;
    if (!targetUrl) return { statusCode: 400, body: 'URL parameter is required.', headers };

    try {
        const response = await axios.get(targetUrl, {
            headers: { 
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://search.aol.com/'
            },
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        if (response.status >= 400) {
            const rawBody = response.data.toString('utf-8');
            console.log(`[AOL Proxy] Upstream Error: ${response.status} ${response.statusText}`);
            console.log(`[AOL Proxy] Target: ${targetUrl}`);
            console.log(`[AOL Proxy] Response Body:`, rawBody);

            return {
                statusCode: response.status,
                headers: { ...headers, 'Content-Type': response.headers['content-type'] || 'text/html' },
                body: rawBody
            };
        }

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
            return {
                statusCode: 200,
                headers: { ...headers, 'Content-Type': contentType },
                body: Buffer.from(response.data).toString('base64'),
                isBase64Encoded: true
            };
        }

        const html = response.data.toString('utf-8');
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const urlObj = new URL(targetUrl);
        const query = urlObj.searchParams.get('q') || '';
        let currentType = 'web';
        if (targetUrl.includes('/image')) currentType = 'images';
        if (targetUrl.includes('/video')) currentType = 'videos';

        const base = doc.createElement('base');
        base.href = urlObj.origin;
        doc.head.prepend(base);

        ['#sticky-hd', 'header', '#ft_wrapper', 'footer', '.mag-glass', '#ybar', '#header'].forEach(s => {
            const el = doc.querySelector(s);
            if (el) el.remove();
        });

        doc.querySelectorAll('a[target="_blank"]').forEach(a => a.removeAttribute('target'));

        const qooqleHeader = doc.createElement('div');
        qooqleHeader.id = 'qooqle-results-navbar';
        qooqleHeader.innerHTML = `
            <style>
                #qooqle-results-navbar {
                    background: #ffffff;
                    padding: 8px 15px;
                    font-family: "MS Gothic", monospace;
                    display: flex;
                    align-items: center;
                }
                #q-logo {
                    width: 100px;
                    cursor: pointer;
                    margin-right: 20px;
                }
                .q-form-container {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .q-input {
                    width: 350px;
                    height: 22px;
                    border: 2px solid;
                    border-top-color: #808080;
                    border-left-color: #808080;
                    border-right-color: #d0d0d0;
                    border-bottom-color: #d0d0d0;
                    box-shadow: inset 1px 1px #404040, inset -1px -1px #ffffff;
                    background-color: #ffffff;
                    padding: 2px 5px;
                    font-family: "MS Gothic", monospace;
                    font-size: 12px;
                    outline: none;
                }
                .q-btn {
                    background-color: #c0c0c0;
                    border: 2px solid;
                    border-top-color: #ffffff;
                    border-left-color: #ffffff;
                    border-right-color: #808080;
                    border-bottom-color: #808080;
                    padding: 0 10px;
                    height: 28px;
                    font-family: "MS Gothic", monospace;
                    font-size: 12px;
                    color: #000;
                    cursor: pointer;
                    text-align: center;
                    display: flex;
                    align-items: center;
                }
                .q-btn:hover {
                    border-top-color: #808080;
                    border-left-color: #808080;
                    border-right-color: #ffffff;
                    border-bottom-color: #ffffff;
                    box-shadow: inset 1px 1px #404040, inset -1px -1px #ffffff;
                }
                .mode-indicator {
                    font-size: 10px;
                    color: #666;
                    margin-left: 10px;
                    text-transform: uppercase;
                }
            </style>
            <img src="https://xp.quenq.com/res/sites/iexplore/logo.png" id="q-logo" alt="Qooqle">
            <div class="q-form-container">
                <input type="text" id="q-search-input" class="q-input" value="${query.replace(/"/g, '&quot;')}">
                <button id="q-search-btn" class="q-btn">Search</button>
                <span class="mode-indicator">Mode: ${currentType}</span>
            </div>
            <script>
                (function() {
                    const input = document.getElementById('q-search-input');
                    const btn = document.getElementById('q-search-btn');
                    const logo = document.getElementById('q-logo');
                    const currentType = "${currentType}";

                    const performSearch = () => {
                        const q = input.value.trim();
                        if (q) {
                            window.parent.postMessage({
                                action: 'search',
                                query: q,
                                type: currentType
                            }, '*');
                        }
                    };

                    btn.onclick = performSearch;
                    input.onkeypress = (e) => { if(e.key === 'Enter') performSearch(); };

                    logo.onclick = () => {
                        window.parent.postMessage({ action: 'navigate_to', url: 'about:home' }, '*');
                    };
                })();
            </script>
        `;
        doc.body.prepend(qooqleHeader);

        const script = doc.createElement('script');
        script.src = `https://reborn-xp-api.netlify.app/.netlify/functions/interceptor`;
        doc.body.appendChild(script);

        return {
            statusCode: 200,
            body: dom.serialize(),
            headers: { ...headers, 'Content-Type': 'text/html' }
        };

    } catch (error) {
        return { statusCode: 500, body: `Error: ${error.message}`, headers };
    }
};