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
            if (link && link.href) {
                e.preventDefault();
                e.stopPropagation();
                handleNav(new URL(link.href, window.location.href).href);
            }
        }, true);

        document.body.addEventListener('submit', function(e) {
            const form = e.target;
            e.preventDefault();
            e.stopPropagation();

            const formData = new FormData(form);
            const params = new URLSearchParams();
            for (const pair of formData.entries()) {
                params.append(pair[0], pair[1]);
            }

            const actionUrl = new URL(form.action || window.location.href, window.location.href);
            actionUrl.search = params.toString();
            
            handleNav(actionUrl.href);
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