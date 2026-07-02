// 开发者工具台前端：纯 UI，计算全部通过 postMessage 交给扩展宿主。
// 新增工具时，在 TOOLS 里加一项，并在扩展侧 toolRegistry.ts 登记同名 handler。
(function () {
    const vscode = acquireVsCodeApi();

    /**
     * 工具清单。
     * - id:        与扩展侧 registry 的键一致
     * - name:      左侧导航显示名
     * - input:     是否需要输入区
     * - controls:  顶部控件（select / text / number）
     */
    const TOOLS = [
        {
            id: 'jsonYaml',
            name: 'JSON / YAML',
            input: true,
            inputPlaceholder: '粘贴 JSON 或 YAML…',
            controls: [
                {
                    type: 'select',
                    key: 'action',
                    label: '操作',
                    options: [
                        ['format-json', '格式化 JSON'],
                        ['minify-json', '压缩 JSON'],
                        ['json-to-yaml', 'JSON → YAML'],
                        ['yaml-to-json', 'YAML → JSON']
                    ]
                }
            ]
        },
        {
            id: 'base64',
            name: 'Base64',
            input: true,
            controls: [
                {
                    type: 'select',
                    key: 'action',
                    label: '操作',
                    options: [
                        ['encode', '编码'],
                        ['decode', '解码']
                    ]
                }
            ]
        },
        { id: 'jwt', name: 'JWT 解码', input: true, inputPlaceholder: '粘贴 JWT…', controls: [] },
        {
            id: 'hash',
            name: 'Hash',
            input: true,
            controls: [
                {
                    type: 'select',
                    key: 'algo',
                    label: '算法',
                    options: [
                        ['md5', 'MD5'],
                        ['sha1', 'SHA-1'],
                        ['sha256', 'SHA-256'],
                        ['sha512', 'SHA-512']
                    ]
                }
            ]
        },
        {
            id: 'timestamp',
            name: '时间戳',
            input: true,
            inputPlaceholder: '输入时间戳或日期，留空取当前时间',
            controls: [
                {
                    type: 'select',
                    key: 'unit',
                    label: '数字单位',
                    options: [
                        ['ms', '毫秒'],
                        ['s', '秒']
                    ]
                }
            ]
        },
        {
            id: 'url',
            name: 'URL',
            input: true,
            controls: [
                {
                    type: 'select',
                    key: 'action',
                    label: '操作',
                    options: [
                        ['encode', '编码'],
                        ['decode', '解码'],
                        ['parse', '解析']
                    ]
                }
            ]
        },
        {
            id: 'uuid',
            name: 'UUID',
            input: false,
            controls: [{ type: 'number', key: 'count', label: '数量', default: '1' }]
        },
        {
            id: 'regex',
            name: '正则测试',
            input: true,
            inputPlaceholder: '待匹配的文本…',
            controls: [
                { type: 'text', key: 'pattern', label: '正则', placeholder: '如 \\d+' },
                { type: 'text', key: 'flags', label: 'flags', default: 'g' }
            ]
        }
    ];

    const nav = document.getElementById('tool-nav');
    const header = document.getElementById('tool-header');
    const controlsEl = document.getElementById('tool-controls');
    const inputEl = document.getElementById('tool-input');
    const outputEl = document.getElementById('tool-output');
    const noteEl = document.getElementById('tool-note');

    let activeTool = TOOLS[0];
    let requestId = 0;
    let latestId = 0;
    let debounceTimer;

    // 构建左侧导航
    for (const tool of TOOLS) {
        const btn = document.createElement('button');
        btn.textContent = tool.name;
        btn.dataset.id = tool.id;
        btn.addEventListener('click', () => selectTool(tool));
        nav.appendChild(btn);
    }

    function selectTool(tool) {
        activeTool = tool;
        for (const btn of nav.querySelectorAll('button')) {
            btn.classList.toggle('active', btn.dataset.id === tool.id);
        }
        header.textContent = tool.name;
        renderControls(tool);
        inputEl.classList.toggle('hidden', !tool.input);
        inputEl.value = '';
        inputEl.placeholder = tool.inputPlaceholder || '在此输入…';
        setOutput('', false);
        noteEl.textContent = '';
        run();
    }

    function renderControls(tool) {
        controlsEl.innerHTML = '';
        for (const control of tool.controls) {
            const wrap = document.createElement('div');
            wrap.className = 'control';

            const label = document.createElement('label');
            label.textContent = control.label;
            wrap.appendChild(label);

            let field;
            if (control.type === 'select') {
                field = document.createElement('select');
                for (const [value, text] of control.options) {
                    const opt = document.createElement('option');
                    opt.value = value;
                    opt.textContent = text;
                    field.appendChild(opt);
                }
            } else {
                field = document.createElement('input');
                field.type = control.type === 'number' ? 'number' : 'text';
                if (control.placeholder) {
                    field.placeholder = control.placeholder;
                }
                if (control.default !== undefined) {
                    field.value = control.default;
                }
            }

            field.dataset.key = control.key;
            field.addEventListener('input', run);
            field.addEventListener('change', run);
            wrap.appendChild(field);
            controlsEl.appendChild(wrap);
        }
    }

    function collectOptions() {
        const options = {};
        for (const field of controlsEl.querySelectorAll('[data-key]')) {
            options[field.dataset.key] = field.value;
        }
        return options;
    }

    function run() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            requestId += 1;
            latestId = requestId;
            vscode.postMessage({
                type: 'run',
                id: requestId,
                tool: activeTool.id,
                input: activeTool.input ? inputEl.value : '',
                options: collectOptions()
            });
        }, 150);
    }

    function setOutput(text, isError) {
        outputEl.textContent = text;
        outputEl.classList.toggle('error', !!isError);
    }

    inputEl.addEventListener('input', run);

    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type !== 'result' || message.id !== latestId) {
            return;
        }
        const result = message.result || {};
        if (result.ok) {
            setOutput(result.output || '', false);
            noteEl.textContent = result.note || '';
        } else {
            setOutput(result.error || '出错', true);
            noteEl.textContent = '';
        }
    });

    selectTool(activeTool);
})();
