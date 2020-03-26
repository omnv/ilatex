import * as vscode from "vscode";
import * as path from "path";
import { Visualisation } from "./Visualisation";
import { ASTCommandNode, ASTParameterNode, ASTParameterAssignmentsNode } from "../ast/LatexASTNode";

interface GraphicsOptions {
    width?: string;
    height?: string;
    scale?: string;
    trim?: string;
}

interface Graphics {
    path: string;
    options: GraphicsOptions;
}

interface WebviewImage {
    uri: vscode.Uri | null;
    width: string;
    height: string;
}

export class IncludeGraphicsVisualisation implements Visualisation {
    private node: ASTCommandNode;
    private document: vscode.TextDocument;
    private webview: vscode.Webview;

    private graphics: Graphics;
    private webviewImage: WebviewImage;
    
    
    constructor(node: ASTCommandNode, document: vscode.TextDocument, webview: vscode.Webview) {
        this.node = node;
        this.document = document;
        this.webview = webview;

        this.graphics = {
            path: "",
            options: {}
        };

        this.webviewImage = {
            uri: null,
            width: "",
            height: ""
        };

        this.extractGraphics();
        this.prepareWebviewImage();
    }

    private extractGraphicsPath(node: ASTParameterNode): void {
        this.graphics.path = node.value;
    }

    private extractGraphicsOptions(node: ASTParameterAssignmentsNode): void {
        for (let paramAssignmentNode of node.value) {
            const acceptedKeys: (keyof GraphicsOptions)[] = [
                "width", "height", "scale", "trim"
            ];

            const key = paramAssignmentNode.value.key.value.trim();
            const keyIndex = (acceptedKeys as string[]).indexOf(key);
            
            if (keyIndex >= 0) {
                const value = paramAssignmentNode.value.value.value.trim();
                this.graphics.options[acceptedKeys[keyIndex]] = value;
            }
        }
    }
    
    // TODO: refactor by allowing visitors to visit any AST subtree
    private extractGraphics(): void {
        const hasOptionNode = this.node.value.parameters[0].length === 1;
        
        // Extract the options (if any)
        if (hasOptionNode) {
            const optionsParameterNode = this.node.value.parameters[0][0] as ASTParameterAssignmentsNode;
            this.extractGraphicsOptions(optionsParameterNode);
        }

        // Extract the path
        const pathParametetIndex = hasOptionNode ? 1 : 0;
        const pathParameterNode = this.node.value.parameters[pathParametetIndex][0] as ASTParameterNode;

        this.extractGraphicsPath(pathParameterNode);
    }

    private prepareWebviewImage(): void {
        const documentPath = this.document.uri.path;
        const lastSlashIndex = documentPath.lastIndexOf("/");
        const documentDirectoryPath = documentPath.slice(0, lastSlashIndex);

        const imagePath = path.resolve(documentDirectoryPath, this.graphics.path);
        this.webviewImage.uri = this.webview.asWebviewUri(vscode.Uri.file(imagePath));

        // TODO: get the standard dimensions of the image
        // TODO: adapt the units if need be
        this.webviewImage.width = this.graphics.options.width ?? "256px";
        this.webviewImage.height = this.graphics.options.height ?? "256px";
    }

    renderAsHTML(): string {
        const styleProperties: Record<string, string> = {
            "width": this.webviewImage.width,
            "height": this.webviewImage.height,
        };

        return `
            <div class="ilatex-includegraphics" style="border: 1px dashed black;">
                <img
                    src="${this.webviewImage.uri}"
                    style="${
                        Object.keys(styleProperties)
                            .map(prop => `${prop}: ${styleProperties[prop]};`)
                            .join("")
                    }"
                />
            </div>
        `;
    }
}