const axios = require('axios');
const { JSDOM } = require('jsdom');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

exports.handler = async function(event) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    const targetUrl = event.queryStringParameters.url;
    if (!targetUrl) {
        return { statusCode: 400, body: 'URL parameter is required.', headers };
    }

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

        const base = doc.createElement('base');
        base.href = new URL(targetUrl).origin;
        doc.head.prepend(base);

        doc.querySelectorAll('a[target="_blank"]').forEach(a => a.removeAttribute('target'));

        const navItems = doc.querySelector('.hd_nav_item');
        if (navItems) navItems.remove();

        const logo = doc.querySelector('#logo');
        if (logo) logo.setAttribute('href', 'about:home');

        const script = doc.createElement('script');
        script.src = `https://rxpappinstaller.netlify.app/.netlify/functions/interceptor`;
        doc.body.appendChild(script);

        return {
            statusCode: 200,
            body: dom.serialize(),
            headers: { ...headers, 'Content-Type': 'text/html' }
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: `Error: ${error.message}`,
            headers
        };
    }
};