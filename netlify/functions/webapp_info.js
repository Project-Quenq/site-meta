const axios = require('axios');
const { getPreviewFromContent } = require('link-preview-js');

async function crawl(webapp_url) {
    if (!webapp_url) return null;
    if (!webapp_url.toLowerCase().startsWith('https://') && !webapp_url.toLowerCase().startsWith('http://')) {
        webapp_url = 'https://' + webapp_url;
    }
    let webapp = {
        url: webapp_url,
        icon: '/images/xp/icons/ApplicationWindow.png',
        name: 'Untitled Program',
        desc: '',
        xframe_restricted: false
    };
    try {
        let response = await axios.get(webapp_url);
        response.url = response.config.url;
        if (response.headers['x-frame-options'] != null) {
            webapp.xframe_restricted = true;
        }
        let data = await getPreviewFromContent(response);
        if (data.siteName && data.siteName.trim() !== '') {
            webapp.name = data.siteName;
        } else if (data.title && data.title.trim() !== '') {
            webapp.name = data.title;
        }
        if (data.favicons && data.favicons.length >= 1) {
            webapp.icon = data.favicons[data.favicons.length - 1];
        }
        webapp.desc = data.description || '';
    } catch (error) {
        console.error('Error fetching webapp info:', error);
    }
    return webapp;
}

exports.handler = async function(event, context) {
    // Handle CORS preflight requests
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

    // Get webapp_url from headers
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
