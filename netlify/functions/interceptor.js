exports.handler = async function(event) {
    const script = `
        document.body.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href) {
                e.preventDefault();
                e.stopPropagation();
                
                const absoluteUrl = new URL(link.href, window.location.href).href;

                window.parent.postMessage({
                    action: 'navigate_to',
                    url: absoluteUrl
                }, '*');
            }
        }, true);
    `;

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/javascript',
            'Access-Control-Allow-Origin': '*'
        },
        body: script
    };
};