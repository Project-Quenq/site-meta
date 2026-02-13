exports.handler = async function(event) {
    const script = `
        function handleNav(url) {
            window.parent.postMessage({
                action: 'navigate_to',
                url: url
            }, '*');
        }

        document.body.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            
            if (!link) return;

            if (e.defaultPrevented) return;

            const hrefAttr = link.getAttribute('href');
            if (!hrefAttr || hrefAttr.startsWith('#') || hrefAttr.startsWith('javascript:')) return;

            if (link.href) {
                e.preventDefault();
                e.stopPropagation();
                handleNav(new URL(link.href, window.location.href).href);
            }
        });
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