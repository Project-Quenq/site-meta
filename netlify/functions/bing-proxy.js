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
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            responseType: 'arraybuffer',
            validateStatus: (status) => status < 500
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

        const base = doc.createElement('base');
        base.href = urlObj.origin;
        doc.head.prepend(base);

        const script = doc.createElement('script');
        script.src = `https://reborn-xp-api.netlify.app/.netlify/functions/interceptor`;
        doc.body.appendChild(script);

        return {
            statusCode: 200,
            body: dom.serialize(),
            headers: { ...headers, 'Content-Type': 'text/html' }
        };

    } catch (error) {
        console.error(error);
        return { 
            statusCode: 500, 
            body: `Proxy Error: ${error.message}`, 
            headers 
        };
    }
};