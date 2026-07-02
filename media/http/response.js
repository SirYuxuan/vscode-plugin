// HTTP 响应面板前端：仅渲染扩展宿主推送的数据。
(function () {
    const statusLine = document.getElementById('status-line');
    const meta = document.getElementById('meta');
    const requestSummary = document.getElementById('request-summary');
    const responseHeaders = document.getElementById('response-headers');
    const responseBody = document.getElementById('response-body');

    function renderRequest(request) {
        const lines = [`${request.method} ${request.url}`];
        for (const [key, value] of Object.entries(request.headers || {})) {
            lines.push(`${key}: ${value}`);
        }
        if (request.body) {
            lines.push('', request.body);
        }
        requestSummary.textContent = lines.join('\n');
    }

    function statusClass(status) {
        if (status >= 200 && status < 300) {
            return 'ok';
        }
        if (status >= 300 && status < 400) {
            return 'redirect';
        }
        return 'error';
    }

    function formatHeaders(headers) {
        return Object.entries(headers || {})
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
    }

    function formatBody(body, contentType) {
        if (!body) {
            return '（空响应体）';
        }
        if ((contentType || '').includes('json')) {
            try {
                return JSON.stringify(JSON.parse(body), null, 2);
            } catch (e) {
                return body;
            }
        }
        return body;
    }

    function setStatus(text, cls) {
        statusLine.textContent = text;
        statusLine.className = 'status-line' + (cls ? ' ' + cls : '');
    }

    window.addEventListener('message', (event) => {
        const message = event.data;

        if (message.type === 'loading') {
            setStatus('请求中…', '');
            meta.textContent = '';
            renderRequest(message.request);
            responseHeaders.textContent = '';
            responseBody.textContent = '';
            return;
        }

        if (message.type === 'result') {
            renderRequest(message.request);
            const result = message.result || {};

            if (!result.ok) {
                setStatus('请求失败', 'error');
                meta.textContent = `耗时 ${result.elapsedMs} ms`;
                responseHeaders.textContent = '';
                responseBody.textContent = result.error || '未知错误';
                return;
            }

            setStatus(`${result.status} ${result.statusText || ''}`.trim(), statusClass(result.status));
            const size = result.body ? new Blob([result.body]).size : 0;
            meta.textContent = `耗时 ${result.elapsedMs} ms · ${size} 字节 · ${result.contentType || '未知类型'}`;
            responseHeaders.textContent = formatHeaders(result.headers);
            responseBody.textContent = formatBody(result.body, result.contentType);
        }
    });
})();
