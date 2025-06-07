const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

async function crawl(webapp_url) {
    if (!webapp_url) return null;
    if (!webapp_url.toLowerCase().startsWith('https://') && !webapp_url.toLowerCase().startsWith('http://')) {
        webapp_url = 'https://' + webapp_url;
    }
    let webapp = {
        url: webapp_url,
        icon: '/images/xp/icons/ApplicationWindow.png',
        icon_data: null,
        name: 'Untitled Program',
        desc: '',
        xframe_restricted: false
    };
    try {
        const response = await axios.get(webapp_url);
        webapp.xframe_restricted = response.headers['x-frame-options'] != null;
        const dom = new JSDOM(response.data);
        const doc = dom.window.document;
        webapp.name = doc.querySelector('title')?.textContent.trim() || new URL(webapp_url).hostname;
        webapp.desc = doc.querySelector('meta[name="description"]')?.content || '';
        let iconUrl = null;
        const appleIcon = doc.querySelector('link[rel="apple-touch-icon"]');
        if (appleIcon && appleIcon.href) {
            iconUrl = new URL(appleIcon.href, webapp_url).href;
        } else {
            const shortcutIcon = doc.querySelector('link[rel="shortcut icon"]');
            if (shortcutIcon && shortcutIcon.href) {
                iconUrl = new URL(shortcutIcon.href, webapp_url).href;
            } else {
                const genericIcon = doc.querySelector('link[rel="icon"]');
                if (genericIcon && genericIcon.href) {
                    iconUrl = new URL(genericIcon.href, webapp_url).href;
                } else {
                    iconUrl = new URL('/favicon.ico', webapp_url).href;
                }
            }
        }
        if (iconUrl) {
            try {
                const iconResponse = await axios.get(iconUrl, { responseType: 'arraybuffer' });
                if (iconResponse.headers['content-type']?.startsWith('image/')) {
                    webapp.icon = iconUrl;
                    webapp.icon_data = Buffer.from(iconResponse.data).toString('base64');
                }
            } catch (e) {
                console.error('Error fetching icon:', e.message);
            }
        }
    } catch (error) {
        console.error('Error fetching webapp info:', error.message);
    }
    return webapp;
}

exports.handler = async function(event, context) {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, webapp_url'
            }
        };
    }
    let webapp_url = event.headers.webapp_url;
    if (!webapp_url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'webapp_url header is required' }),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, webapp_url'
            }
        };
    }
    console.log(webapp_url);
    let webapp = await crawl(webapp_url);
    return {
        statusCode: 200,
        body: JSON.stringify({ webapp }),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, webapp_url'
        }
    };
};