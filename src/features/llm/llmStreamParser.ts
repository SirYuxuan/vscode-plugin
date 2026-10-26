/**
 * chat/completions 流式响应（Server-Sent Events）的增量解析器。
 *
 * 纯逻辑实现，不依赖网络与 VS Code，便于单独验证：把收到的文本块交给 {@link push}，
 * 解析出的文本与工具调用通过回调送出。
 */

import { SSE_DATA_PREFIX, SSE_DONE_MARKER } from './llmConstants';
import { ChatStreamChunk, ChatToolCallDelta } from './llmTypes';

/** 解析结果的接收方。 */
export interface StreamHandlers {
    /** 收到一段文本增量。 */
    onText(text: string): void;
    /** 一个工具调用的参数已完整收到。 */
    onToolCall(callId: string, name: string, input: object): void;
}

interface PendingToolCall {
    id: string;
    name: string;
    args: string;
}

export class ChatStreamParser {
    private buffer = '';
    private readonly pendingToolCalls = new Map<number, PendingToolCall>();

    constructor(private readonly handlers: StreamHandlers) {}

    /**
     * 送入一段新收到的文本。
     * @param text 解码后的响应片段，可以在任意位置截断
     */
    public push(text: string): void {
        this.buffer += text;

        let newlineIndex = this.buffer.indexOf('\n');
        while (newlineIndex >= 0) {
            const line = this.buffer.slice(0, newlineIndex);
            this.buffer = this.buffer.slice(newlineIndex + 1);
            this.handleLine(line);
            newlineIndex = this.buffer.indexOf('\n');
        }
    }

    /**
     * 流结束时调用：处理缓冲区剩余内容，并送出尚未发出的工具调用。
     */
    public finish(): void {
        if (this.buffer.length > 0) {
            this.handleLine(this.buffer);
            this.buffer = '';
        }

        this.flushToolCalls();
    }

    private handleLine(rawLine: string): void {
        const line = rawLine.trim();
        if (!line.startsWith(SSE_DATA_PREFIX)) {
            // 忽略空行、注释行（": keep-alive"）以及 event/id 等其他字段。
            return;
        }

        const payload = line.slice(SSE_DATA_PREFIX.length).trim();
        if (!payload || payload === SSE_DONE_MARKER) {
            return;
        }

        let chunk: ChatStreamChunk;
        try {
            chunk = JSON.parse(payload) as ChatStreamChunk;
        } catch {
            throw new Error(`无法解析服务端返回的数据块：${payload.slice(0, 200)}`);
        }

        if (chunk.error) {
            throw new Error(`服务端返回错误：${chunk.error.message ?? JSON.stringify(chunk.error)}`);
        }

        for (const choice of chunk.choices ?? []) {
            const delta = choice.delta;
            if (delta?.content) {
                this.handlers.onText(delta.content);
            }

            for (const toolCall of delta?.tool_calls ?? []) {
                this.accumulateToolCall(toolCall);
            }

            if (choice.finish_reason) {
                this.flushToolCalls();
            }
        }
    }

    private accumulateToolCall(delta: ChatToolCallDelta): void {
        const index = delta.index ?? this.pendingToolCalls.size;
        let pending = this.pendingToolCalls.get(index);

        if (!pending) {
            pending = { id: delta.id ?? '', name: '', args: '' };
            this.pendingToolCalls.set(index, pending);
        }

        if (delta.id && !pending.id) {
            pending.id = delta.id;
        }

        if (delta.function?.name) {
            pending.name += delta.function.name;
        }

        if (delta.function?.arguments) {
            pending.args += delta.function.arguments;
        }
    }

    private flushToolCalls(): void {
        const ordered = [...this.pendingToolCalls.entries()].sort(([a], [b]) => a - b);
        this.pendingToolCalls.clear();

        for (const [index, call] of ordered) {
            if (!call.name) {
                continue;
            }

            this.handlers.onToolCall(
                call.id || `call_${index}_${Date.now()}`,
                call.name,
                parseToolArguments(call)
            );
        }
    }
}

function parseToolArguments(call: PendingToolCall): object {
    if (!call.args.trim()) {
        return {};
    }

    try {
        const parsed: unknown = JSON.parse(call.args);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        }
    } catch {
        // 落入下方统一报错。
    }

    throw new Error(`工具 ${call.name} 的参数不是有效的 JSON 对象：${call.args.slice(0, 200)}`);
}
