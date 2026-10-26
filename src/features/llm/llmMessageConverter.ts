/**
 * VS Code 聊天消息与 OpenAI 兼容 chat/completions 报文之间的转换。
 *
 * 请求只会包含文本、工具调用与（模型启用 vision 时的）图片，不会附带任何内置工具，
 * 以避免触发网关上与图像生成等能力相关的权限限制。
 */

import * as vscode from 'vscode';
import { CHARS_PER_TOKEN, IMAGE_PLACEHOLDER } from './llmConstants';
import { ChatContentPart, ChatMessage, ChatTool, ChatToolCall } from './llmTypes';

/** 消息转换结果。 */
export interface ConvertedMessages {
    readonly messages: ChatMessage[];
    /** 实际发送给服务端的图片数量。 */
    readonly sentImages: number;
    /** 因模型未启用 vision 而被替换为占位文本的图片数量。 */
    readonly omittedImages: number;
}

/** 结构上符合图片数据片段的对象（不同 VS Code 版本的类名不同，故按结构判断）。 */
interface ImageDataPart {
    readonly mimeType: string;
    readonly data: Uint8Array;
}

/**
 * 转换 VS Code 消息为 chat/completions 消息。
 * @param messages VS Code 提供的消息
 * @param vision 目标模型是否启用图片输入
 * @returns 转换后的消息及图片统计
 */
export function convertMessages(
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    vision: boolean
): ConvertedMessages {
    const result: ChatMessage[] = [];
    let sentImages = 0;
    let omittedImages = 0;

    for (const message of messages) {
        if (message.role === vscode.LanguageModelChatMessageRole.Assistant) {
            const assistant = convertAssistantMessage(message);
            if (assistant) {
                result.push(assistant);
            }
            continue;
        }

        const textParts: string[] = [];
        const contentParts: ChatContentPart[] = [];
        const toolMessages: ChatMessage[] = [];

        for (const part of message.content) {
            if (part instanceof vscode.LanguageModelToolResultPart) {
                // 工具结果必须紧跟在发起调用的 assistant 消息之后，因此先于同条消息的文本输出。
                toolMessages.push({
                    role: 'tool',
                    tool_call_id: part.callId,
                    content: toolResultToText(part)
                });
            } else if (part instanceof vscode.LanguageModelTextPart) {
                textParts.push(part.value);
                contentParts.push({ type: 'text', text: part.value });
            } else if (isImageDataPart(part)) {
                if (vision) {
                    sentImages++;
                    contentParts.push({
                        type: 'image_url',
                        image_url: { url: toDataUrl(part) }
                    });
                } else {
                    omittedImages++;
                    textParts.push(IMAGE_PLACEHOLDER);
                    contentParts.push({ type: 'text', text: IMAGE_PLACEHOLDER });
                }
            }
        }

        result.push(...toolMessages);

        if (contentParts.length === 0) {
            continue;
        }

        const hasImage = contentParts.some((part) => part.type === 'image_url');
        result.push({
            role: 'user',
            content: hasImage ? contentParts : textParts.join('')
        });
    }

    return { messages: result, sentImages, omittedImages };
}

/**
 * 转换 VS Code 工具定义为 chat/completions 工具。
 * @param tools VS Code 提供的工具
 * @returns 工具列表；没有工具时返回 undefined
 */
export function convertTools(
    tools: readonly vscode.LanguageModelChatTool[] | undefined
): ChatTool[] | undefined {
    if (!tools || tools.length === 0) {
        return undefined;
    }

    return tools.map((tool) => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            // 部分网关要求无参数工具也必须携带显式的 schema。
            parameters: tool.inputSchema ?? { type: 'object', properties: {} }
        }
    }));
}

/**
 * 粗略估算文本或消息的 token 数。
 * @param value 字符串或 VS Code 消息
 * @returns 估算的 token 数
 */
export function estimateTokens(value: string | vscode.LanguageModelChatRequestMessage): number {
    const text = typeof value === 'string' ? value : messageToPlainText(value);
    return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function convertAssistantMessage(
    message: vscode.LanguageModelChatRequestMessage
): ChatMessage | undefined {
    let text = '';
    const toolCalls: ChatToolCall[] = [];

    for (const part of message.content) {
        if (part instanceof vscode.LanguageModelTextPart) {
            text += part.value;
        } else if (part instanceof vscode.LanguageModelToolCallPart) {
            toolCalls.push({
                id: part.callId,
                type: 'function',
                function: { name: part.name, arguments: safeStringify(part.input) }
            });
        }
    }

    if (!text && toolCalls.length === 0) {
        return undefined;
    }

    return toolCalls.length > 0
        ? { role: 'assistant', content: text, tool_calls: toolCalls }
        : { role: 'assistant', content: text };
}

function toolResultToText(part: vscode.LanguageModelToolResultPart): string {
    const pieces: string[] = [];

    for (const item of part.content) {
        if (item instanceof vscode.LanguageModelTextPart) {
            pieces.push(item.value);
        } else if (isImageDataPart(item)) {
            pieces.push(IMAGE_PLACEHOLDER);
        } else {
            pieces.push(safeStringify(item));
        }
    }

    return pieces.join('');
}

function messageToPlainText(message: vscode.LanguageModelChatRequestMessage): string {
    const pieces: string[] = [];

    for (const part of message.content) {
        if (part instanceof vscode.LanguageModelTextPart) {
            pieces.push(part.value);
        } else if (part instanceof vscode.LanguageModelToolCallPart) {
            pieces.push(part.name, safeStringify(part.input));
        } else if (part instanceof vscode.LanguageModelToolResultPart) {
            pieces.push(toolResultToText(part));
        }
    }

    return pieces.join('');
}

function isImageDataPart(part: unknown): part is ImageDataPart {
    if (typeof part !== 'object' || part === null) {
        return false;
    }

    const candidate = part as Partial<ImageDataPart>;
    return (
        typeof candidate.mimeType === 'string' &&
        candidate.mimeType.startsWith('image/') &&
        candidate.data instanceof Uint8Array
    );
}

function toDataUrl(part: ImageDataPart): string {
    return `data:${part.mimeType};base64,${Buffer.from(part.data).toString('base64')}`;
}

/** 序列化任意值；循环引用等无法序列化的情况退化为 String()。 */
function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value) ?? '';
    } catch {
        return String(value);
    }
}
