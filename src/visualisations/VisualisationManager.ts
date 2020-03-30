import * as vscode from 'vscode';
import { LatexAST } from "../ast/LatexAST";
import { CodePatternDetector } from "../patterns/CodePatternDetector";
import { Visualisation } from './Visualisation';
import { IncludeGraphicsVisualisation } from './IncludeGraphicsVisualisation';
import { TabularVisualisation } from './TabularVisualisation';
import { WebviewManager } from '../webview/WebviewManager';

export class VisualisationManager {
    private document: vscode.TextDocument;
    private webviewManager: WebviewManager;
    private visualisations: Visualisation[];
    private patternDetector: CodePatternDetector;

    constructor(document: vscode.TextDocument, webviewManager: WebviewManager) {
        this.document = document;
        this.webviewManager = webviewManager;
        this.visualisations = [];
        this.patternDetector = new CodePatternDetector();

        this.initPatternDetector();
    }

    private initPatternDetector(): void {
        // Commands to detect
        this.patternDetector.commandPatterns.push(
            {
                match: node => node.name === "includegraphics",
                onMatch: node => {
                    this.visualisations.push(
                        new IncludeGraphicsVisualisation(node, this.document, this.webviewManager)
                    );
                }
            }
        );

        // Environements to detect
        this.patternDetector.environementsPatterns.push(
            {
                match: node => node.name === "tabular",
                onMatch: node => {
                    this.visualisations.push(new TabularVisualisation(node, this.document));
                }
            }
        );
    }

    getVisualisationAtPosition(position: vscode.Position): Visualisation | null {
        const result = this.visualisations.find(visualisation => {
            const start = visualisation.node.start;
            const end = visualisation.node.end;
            
            const startPos = new vscode.Position(start.line - 1, start.column - 1);
            const endPos = new vscode.Position(end.line - 1, end.column - 1);

            return position.isAfterOrEqual(startPos)
                && position.isBeforeOrEqual(endPos);
        });

        return result ?? null;
    }

    private createVisualisationsFromPatterns(ast: LatexAST): void {
        ast.visitWith(this.patternDetector);
    }

    renderAllVisualisationsAsHTML(): string {
        return this.visualisations
            .map(visualisation => visualisation.renderAsHTML())
            .join("\n");
    }

    updateVisualisations(ast: LatexAST): void {
        // Re-create the visualisations from the (new) AST
        this.visualisations = [];
        this.createVisualisationsFromPatterns(ast);

        // Update the view
        console.log("Updated visualisations:");
        console.log(this.visualisations);

        //console.log(this.renderAllVisualisationsAsHTML());
        //this.webviewPanel.webview.html = this.renderAllVisualisationsAsHTML(); 
    }
}