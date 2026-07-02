/**
 * XML 文本中全限定类名的扫描器（纯逻辑，无 I/O）。
 *
 * 供链接与悬浮提示共用：既能全量扫描文档得到所有类名及其范围，
 * 也能定位某个位置上的类名。
 */

import * as vscode from 'vscode';
import { JavaClassResolver } from '../../core/java/javaClassResolver';

/** 一次命中：类名及其在文档中的范围。 */
export interface ClassNameHit {
    className: string;
    range: vscode.Range;
}

export class XmlClassScanner {
    /** 用于从 XML 属性 / 文本中捕获全限定类名的正则集合。 */
    private static patterns(): RegExp[] {
        return [
            /class\s*=\s*["']([^"'\s]+(?:\.[^"'\s]+)+)["']/gi,
            /value\s*=\s*["']([^"'\s]+(?:\.[^"'\s]+)+)["']/gi,
            /name\s*=\s*["']([^"'\s]+(?:\.[^"'\s]+)+)["']/gi,
            /type\s*=\s*["']([^"'\s]+(?:\.[^"'\s]+)+)["']/gi,
            />\s*([a-zA-Z_][\w$]*\.[\w$.]*[A-Z][\w$]*)\s*</g
        ];
    }

    /** 扫描整个文档，返回去重后的所有合法类名命中。 */
    public static scan(document: vscode.TextDocument): ClassNameHit[] {
        const text = document.getText();
        const hits: ClassNameHit[] = [];
        const seen = new Set<string>();

        for (const regex of XmlClassScanner.patterns()) {
            regex.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                const className = match[1]?.trim();
                if (!className || !JavaClassResolver.isValidClassName(className)) {
                    continue;
                }

                const classIndex = match.index + match[0].indexOf(match[1]);
                const range = new vscode.Range(
                    document.positionAt(classIndex),
                    document.positionAt(classIndex + match[1].length)
                );

                const rangeKey = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
                if (seen.has(rangeKey)) {
                    continue;
                }
                seen.add(rangeKey);

                hits.push({ className, range });
            }
        }

        return hits;
    }

    /** 返回给定位置处命中的类名，用于悬浮提示；无命中返回 undefined。 */
    public static classNameAt(document: vscode.TextDocument, position: vscode.Position): ClassNameHit | undefined {
        return XmlClassScanner.scan(document).find((hit) => hit.range.contains(position));
    }
}
