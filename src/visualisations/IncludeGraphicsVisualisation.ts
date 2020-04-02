import * as vscode from "vscode";
import * as path from "path";
import { Visualisation } from "./Visualisation";
import { ASTCommandNode, ASTParameterNode, ASTParameterListNode, ASTParameterAssignmentNode } from "../ast/LatexASTNode";
import { WebviewManager } from "../webview/WebviewManager";
import { LatexLength } from "../utils/LatexLength";
import { LatexASTVisitorAdapter } from "../ast/visitors/LatexASTVisitorAdapter";

interface GraphicsOptions {
    width?: LatexLength;
    height?: LatexLength;
    scale?: number;
    trim?: LatexLength[];
    clip?: boolean;
}

interface Graphics {
    path: string;
    options: GraphicsOptions;
}

class GraphicsOptionsSetter extends LatexASTVisitorAdapter {
    private options: GraphicsOptions;

    constructor(options: GraphicsOptions) {
        super();
        this.options = options;
    }

    protected visitParameterNode(node: ASTParameterNode): void {
        const parameter = node.value;
        if (parameter === "clip") {
            this.options.clip = true;
        }
    }

    protected visitParameterAssignmentNode(node: ASTParameterAssignmentNode): void {
        const key = node.value.key.value.trim();
        const value = node.value.value.value.trim();

        if (key === "width") {
            this.options.width = new LatexLength(value);
        }
        else if (key === "height") {
            this.options.height = new LatexLength(value);
        }
        else if (key === "scale") {
            this.options.scale = parseFloat(value);
        }
        else if (key === "trim") {
            this.options.trim = value
                .split(/\s+/)
                .map(lengthText => new LatexLength(lengthText));
        }
        else if (key === "clip") {
            this.options.clip = value.trim().toLowerCase() === "true";
        }
    }
}

export class IncludeGraphicsVisualisation extends Visualisation<ASTCommandNode> {
    readonly name = "includegraphics";

    private document: vscode.TextDocument;
    private webviewManager: WebviewManager;

    private webviewImageUri: vscode.Uri | null;;
    private graphics: Graphics;

    constructor(node: ASTCommandNode, document: vscode.TextDocument, webviewManager: WebviewManager) {
        super(node);
        
        this.document = document;
        this.webviewManager = webviewManager;

        this.webviewImageUri = null;
        this.graphics = {
            path: "",
            options: {}
        };

        this.extractGraphics();
        this.prepareWebviewImage();
        this.initProps();
    }

    protected initProps(): void {
        super.initProps();

        // Add the original path of the image
        this.props["data-img-path"] = this.graphics.path;

        // Add the dimensions of the image
        // TODO: compute the actual dimensions of the image
        this.props["data-img-width"] = "256";
        this.props["data-img-height"] = "256";

        // Add node location information
        this.props["data-loc-start"] = `${this.node.start.line};${this.node.start.column}`;
        this.props["data-loc-end"] = `${this.node.end.line};${this.node.end.column}`;

        // Add graphics option information
        // TODO: what to do when the length cannot be converted?
        const options = this.graphics.options;

        if (options.width?.canBeConverted) {
            this.props[`data-opt-width`] = options.width.px.toString();
        }

        if (options.height?.canBeConverted) {
            this.props[`data-opt-height`] = options.height.px.toString();
        }

        if (options.scale !== undefined) {
            this.props[`data-opt-scale`] = options.scale.toString();
        }

        if (options.trim !== undefined) {
            this.props[`data-opt-trim-left`] = options.trim[0].px.toString();
            this.props[`data-opt-trim-bottom`] = options.trim[1].px.toString();
            this.props[`data-opt-trim-right`] = options.trim[2].px.toString();
            this.props[`data-opt-trim-top`] = options.trim[3].px.toString();
        }

        if (options.clip !== undefined) {
            this.props[`data-opt-clip`] = options.clip ? "true" : "false";
        }

        // Enable the selection of the associated block of code on click
        this.props["class"] += " selectable";
    }

    private extractGraphicsPath(node: ASTParameterNode): void {
        this.graphics.path = node.value;
    }

    private extractGraphicsOptions(node: ASTParameterListNode): void {
        const optionsSetter = new GraphicsOptionsSetter(this.graphics.options);
        node.visitWith(optionsSetter);
    }
    
    private extractGraphics(): void {
        const hasOptionNode = this.node.value.parameters[0].length === 1;
        
        // Extract the options (if any)
        if (hasOptionNode) {
            const optionsParameterNode = this.node.value.parameters[0][0] as ASTParameterListNode;
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
        this.webviewImageUri = this.webviewManager.adaptURI(vscode.Uri.file(imagePath));
    }

    renderContentAsHTML(): string {
        return `
            <p class="text"></p>
            <div class="frame">
                <img
                    class="ghost"
                    src="${this.webviewImageUri}"
                />
                <div class="inner">
                    <img
                        class="image"
                        src="${this.webviewImageUri}"
                    />
                </div>
                <div class="resize"></div>
            </div>
        `;
    }
}