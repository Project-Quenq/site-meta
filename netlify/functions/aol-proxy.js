const axios = require('axios');
const { JSDOM } = require('jsdom');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 5.1; rv:52.0) Gecko/20100101 Firefox/52.0';

exports.handler = async function(event) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

    const targetUrl = event.queryStringParameters.url;
    const siteOrigin = event.queryStringParameters.origin;

    if (!targetUrl) return { statusCode: 400, body: 'URL parameter is required.', headers };

    try {
        const response = await axios.get(targetUrl, {
            headers: { 'User-Agent': USER_AGENT },
            responseType: 'arraybuffer'
        });

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
        let mode = 'web'; 
        if (targetUrl.includes('/image')) mode = 'images';
        if (targetUrl.includes('/video')) mode = 'videos';

        const base = doc.createElement('base');
        base.href = urlObj.origin;
        doc.head.prepend(base);

        ['#sticky-hd', 'header', '#ft_wrapper', 'footer', '#ybar', '.mag-glass'].forEach(s => {
            const el = doc.querySelector(s); if (el) el.remove();
        });

        const qooqleHeader = doc.createElement('div');
        qooqleHeader.id = 'qooqle-injected-nav';
        qooqleHeader.innerHTML = `
            <style>
                #qooqle-injected-nav {
                    background-color: #fff;
                    border-bottom: 1px solid #c0c0c0;
                    padding: 8px 15px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    font-family: "MS Gothic", monospace;
                    position: sticky;
                    top: 0;
                    z-index: 10000;
                }
                #q-logo { cursor: pointer; width: 80px; height: auto; }
                .q-form { display: flex; gap: 8px; align-items: center; }
                
                .q-input { 
                    width: 320px; height: 22px; border: 2px solid; 
                    border-top-color: #808080; border-left-color: #808080; 
                    border-right-color: #d0d0d0; border-bottom-color: #d0d0d0; 
                    box-shadow: inset 1px 1px #404040, inset -1px -1px #ffffff; 
                    background-color: #ffffff; padding: 2px 5px; 
                    font-family: "MS Gothic", monospace; font-size: 12px;
                }
                
                .q-btn {
                    background-color: #c0c0c0; border: 2px solid; 
                    border-top-color: #ffffff; border-left-color: #ffffff; 
                    border-right-color: #808080; border-bottom-color: #808080; 
                    padding: 2px 12px; font-family: "MS Gothic", monospace; 
                    font-size: 12px; color: #000000; cursor: pointer; height: 28px;
                }
                .q-btn:hover {
                    border-top-color: #808080; border-left-color: #808080; 
                    border-right-color: #ffffff; border-bottom-color: #ffffff; 
                    box-shadow: inset 1px 1px #404040, inset -1px -1px #ffffff;
                }
                .q-mode-label { font-size: 11px; color: #666; text-transform: uppercase; font-weight: bold;}
            </style>

            <img src="${siteOrigin}/res/sites/iexplore/logo.png" id="q-logo" title="Back to Home">
            
            <div class="q-form">
                <span class="q-mode-label">${mode} search:</span>
                <input type="text" id="q-input" class="q-input" value="${query}">
                <button id="q-btn" class="q-btn">Search</button>
            </div>

            <script>
                (function() {
                    const input = document.getElementById('q-input');
                    const btn = document.getElementById('q-btn');
                    const logo = document.getElementById('q-logo');

                    const performSearch = () => {
                        window.parent.postMessage({ 
                            action: 'search', 
                            query: input.value, 
                            type: '${mode}'
                        }, '*');
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