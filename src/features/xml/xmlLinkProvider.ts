import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class XmlJavaClassLinkProvider implements vscode.DocumentLinkProvider {

    public async provideDocumentLinks(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<vscode.DocumentLink[]> {

        console.log('provideDocumentLinks called for:', document.fileName);

        if (!document.fileName.toLowerCase().endsWith('.xml')) {
            console.log('Not an XML file, returning empty array');
            return [];
        }

        const text = document.getText();
        const links: vscode.DocumentLink[] = [];
        const seen = new Set<string>();
        const classCache = new Map<string, vscode.Uri | null>();

        const patterns = this.getClassNamePatterns();

        for (const regex of patterns) {
            regex.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                const rawClassName = match[1]?.trim();
                if (!rawClassName) {
                    continue;
                }

                console.log('Found potential class:', rawClassName);

                if (!this.isValidJavaClassName(rawClassName)) {
                    continue;
                }

                const className = rawClassName;

                let cachedUri = classCache.get(className);
                if (cachedUri === undefined) {
                    try {
                        cachedUri = await this.findJavaFile(className);
                    } catch (error) {
                        console.log('Error while searching class file:', className, error);
                        cachedUri = null;
                    }

                    classCache.set(className, cachedUri ?? null);
                }

                if (!cachedUri) {
                    console.log('Java file not found, skip link for:', className);
                    continue;
                }
                const classIndex = match.index + match[0].indexOf(match[1]);
                const startPos = document.positionAt(classIndex);
                const endPos = document.positionAt(classIndex + match[1].length);
                const range = new vscode.Range(startPos, endPos);

                const rangeKey = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
                if (seen.has(rangeKey)) {
                    continue;
                }
                seen.add(rangeKey);

                const link = new vscode.DocumentLink(range, cachedUri);
                (link as vscode.DocumentLink & { data?: string }).data = className;

                links.push(link);
                console.log('Created link for class:', className, 'path:', cachedUri.fsPath);
                console.log('Link range:', range.start.line, range.start.character, 'to', range.end.line, range.end.character);
            }
        }

        console.log('Total links created:', links.length);
        return links;
    }

    public async resolveDocumentLink(
        link: vscode.DocumentLink,
        token: vscode.CancellationToken
    ): Promise<vscode.DocumentLink | null> {

        console.log('resolveDocumentLink called');

        if (link.target) {
            return link;
        }

        const storedClassName = (link as vscode.DocumentLink & { data?: string }).data;
        const className = storedClassName?.trim();

        if (!className) {
            console.log('Unable to resolve class name from link');
            return null;
        }

        console.log('Resolving link for class:', className);

        const javaUri = await this.findJavaFile(className);
        if (!javaUri) {
            console.log('Java file not found during resolve for:', className);
            return null;
        }

        link.target = javaUri;
        return link;
    }

    private getClassNamePatterns(): RegExp[] {
        return [
            /class\s*=\s*["']([^"'\s]+(?:\.[^"'\s]+)+)["']/gi,
            /value\s*=\s*["']([^"'\s]+(?:\.[^"'\s]+)+)["']/gi,
            /name\s*=\s*["']([^"'\s]+(?:\.[^"'\s]+)+)["']/gi,
            /type\s*=\s*["']([^"'\s]+(?:\.[^"'\s]+)+)["']/gi,
            />\s*([a-zA-Z_][\w$]*\.[\w$.]*[A-Z][\w$]*)\s*</g
        ];
    }

    private isValidJavaClassName(className: string): boolean {
        console.log('Validating class name:', className);

        if (!className.includes('.')) {
            console.log('No dot found in class name');
            return false;
        }

        const parts = className.split('.');
        if (parts.length < 2) {
            console.log('Not enough parts in class name');
            return false;
        }

        const actualClassName = parts[parts.length - 1];
        const isValid = /^[A-Z][a-zA-Z0-9_$]*$/.test(actualClassName);
        console.log('Class name validation result:', isValid, 'for:', actualClassName);

        return isValid;
    }

    private async findJavaFile(className: string): Promise<vscode.Uri | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }

        const classPath = className.replace(/\./g, '/') + '.java';

        for (const folder of workspaceFolders) {
            const possiblePaths = [
                'src/main/java/' + classPath,
                'src/java/' + classPath,
                'src/' + classPath,
                classPath
            ];

            for (const possiblePath of possiblePaths) {
                const fullPath = path.join(folder.uri.fsPath, possiblePath);

                try {
                    await fs.promises.access(fullPath);
                    return vscode.Uri.file(fullPath);
                } catch {
                    continue;
                }
            }
        }

        const files = await vscode.workspace.findFiles(
            '**/' + className.split('.').pop() + '.java',
            '**/node_modules/**',
            10
        );

        for (const file of files) {
            const fileContent = await vscode.workspace.fs.readFile(file);
            const content = Buffer.from(fileContent).toString('utf8');

            const packageDeclaration = className.split('.').slice(0, -1).join('.');
            if (content.includes('package ' + packageDeclaration + ';')) {
                return file;
            }
        }

        return null;
    }
}
