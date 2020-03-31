import * as vscode from "vscode";
import * as path from "path";
import { Visualisation } from "./Visualisation";
import { ASTCommandNode, ASTParameterNode, ASTParameterAssignmentsNode } from "../ast/LatexASTNode";
import { WebviewManager } from "../webview/WebviewManager";
import { LatexLength } from "../utils/LatexLength";

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

export class IncludeGraphicsVisualisation extends Visualisation<ASTCommandNode> {
    readonly name = "includegraphics";

    private document: vscode.TextDocument;
    private webviewManager: WebviewManager;

    private graphics: Graphics;
    private webviewImage: WebviewImage;

    constructor(node: ASTCommandNode, document: vscode.TextDocument, webviewManager: WebviewManager) {
        super(node);
        
        this.document = document;
        this.webviewManager = webviewManager;

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
        this.initProps();
    }

    protected initProps(): void {
        super.initProps();

        // Add node location information
        this.props["data-loc-start"] = `${this.node.start.line};${this.node.start.column}`;
        this.props["data-loc-end"] = `${this.node.end.line};${this.node.end.column}`;

        // Enable the selection of the associated block of code on click
        this.props["class"] += " selectable";
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
        this.webviewImage.uri = this.webviewManager.adaptURI(vscode.Uri.file(imagePath));

        // TODO: get the standard dimensions of the image (for default values)
        const widthLength = new LatexLength(this.graphics.options.width ?? "");
        const heightLength = new LatexLength(this.graphics.options.height ?? "");

        // TODO: handle non-convertible units (e.g. 0.5\textlength)
        const widthInPixels = widthLength.canBeConverted ? widthLength.px : "256px";
        const heightInPixels = heightLength.canBeConverted ? heightLength.px : "256px";

        this.webviewImage.width = `${widthInPixels}px`;
        this.webviewImage.height = `${heightInPixels}px`;
    }

    renderContentAsHTML(): string {
        const styleProperties: Record<string, string> = {
            "width": this.webviewImage.width,
            "height": this.webviewImage.height,
        };

        const styleAttrValue = Object.keys(styleProperties)
            .map(prop => `${prop}: ${styleProperties[prop]};`)
            .join("");

        return `
            <p class="text"></p>
            <div class="frame">
                <img
                    class="ghost"
                    src="${this.webviewImage.uri}"
                    style="${styleAttrValue}"
                />
                <div class="inner">
                    <img
                        class="image"
                        src="${this.webviewImage.uri}"
                        style="${styleAttrValue}"
                    />
                </div>
                <div class="resize"></div>
            </div>
            
        `;
    }
}