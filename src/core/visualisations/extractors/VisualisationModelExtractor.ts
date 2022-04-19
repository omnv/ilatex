import { range } from "parsimmon";
import { ArrayMap } from "../../../shared/utils/ArrayMap";
import { GridLayoutVisualisationModelProvider } from "../../../visualisations/gridlayout/model/provider";
import { IncludegraphicsVisualisationModelProvider } from "../../../visualisations/includegraphics/model/provider";
import { MathematicsVisualisationModelProvider } from "../../../visualisations/mathematics/model/provider";
import { TabularVisualisationModelProvider } from "../../../visualisations/tabular/model/provider";
import { ASTNode } from "../../ast/nodes/ASTNode";
import { CodeMapping, CodeMappingID } from "../../code-mappings/CodeMapping";
import { InteractiveLatexDocument } from "../../InteractiveLatexDocument";
import { SourceFile } from "../../source-files/SourceFile";
import { SourceFilePosition } from "../../source-files/SourceFilePosition";
import { VisualisationModel } from "../VisualisationModel";
import { VisualisationModelProvider } from "../VisualisationModelProvider";
import { VisualisationModelUtilities } from "../VisualisationModelUtilities";
import { ASTNodeCandidatesExtractor } from "./ASTNodeCandidateExtractor";


export class VisualisationModelExtractor {
    private static readonly MODEL_PROVIDERS: VisualisationModelProvider[] = [
        new MathematicsVisualisationModelProvider(),
        new GridLayoutVisualisationModelProvider(),
        new TabularVisualisationModelProvider(),
        new IncludegraphicsVisualisationModelProvider()
    ];

    private ilatexDocument: InteractiveLatexDocument;
    private astNodeCandidatesExtractor: ASTNodeCandidatesExtractor;

    constructor(ilatexDocument: InteractiveLatexDocument) {
        this.ilatexDocument = ilatexDocument;
        this.astNodeCandidatesExtractor = new ASTNodeCandidatesExtractor(VisualisationModelExtractor.MODEL_PROVIDERS);
    }

    private get modelUtilities(): VisualisationModelUtilities {
        return VisualisationModelUtilities.from(this.ilatexDocument);
    }

    private mapSourceFilesToCodeMappings(): ArrayMap<SourceFile, CodeMapping> {
        const codeMappings = this.ilatexDocument.codeMappingManager.codeMappings;
        const sourceFilesToCodeMappings = new ArrayMap<SourceFile, CodeMapping>();

        for (let codeMapping of codeMappings) {
            const sourceFile = this.ilatexDocument.sourceFileManager.getSourceFileOfCodeMapping(codeMapping);
            if (sourceFile) {
                sourceFilesToCodeMappings.add(sourceFile, codeMapping);
            }
        }

        return sourceFilesToCodeMappings;
    }

    private mapModelProvidersToCodeMappings(codeMappings: CodeMapping[]): ArrayMap<VisualisationModelProvider, CodeMapping> {
        const modelProvidersToCodeMappings = new ArrayMap<VisualisationModelProvider, CodeMapping>();

        for (let codeMapping of codeMappings) {
            for (let modelProvider of VisualisationModelExtractor.MODEL_PROVIDERS) {
                if (modelProvider.canProvideForCodeMapping(codeMapping)) {
                    modelProvidersToCodeMappings.add(modelProvider, codeMapping);
                }
            }
        }

        return modelProvidersToCodeMappings;
    }

    extractModelsForAllSourceFiles(): VisualisationModel[] {
        const extractedModels: VisualisationModel[] = [];
        const addModelWith = (
            provider: VisualisationModelProvider,
            node: ASTNode,
            codeMapping: CodeMapping,
            sourceFile: SourceFile
        ) => {
            extractedModels.push(provider.provideModelWith({
                astNode: node,
                codeMapping: codeMapping,
                sourceFile: sourceFile
            }, this.modelUtilities));
        };

        const sourceFilesToCodeMappings = this.mapSourceFilesToCodeMappings();

        for (let [sourceFile, codeMappings] of sourceFilesToCodeMappings.entries) {
            const modelProvidersToCodeMappings = this.mapModelProvidersToCodeMappings(codeMappings);
            const modelProvidersToCandidateAstNodes = this.astNodeCandidatesExtractor.runOnSourceFile(sourceFile);
            const usefulModelProvidersForCandidateAstNodes = [...modelProvidersToCandidateAstNodes.keys];
            const usefulModelProviders = [...modelProvidersToCodeMappings.keys]
                .filter(modelProvider => usefulModelProvidersForCandidateAstNodes.includes(modelProvider));

            for (let modelProvider of usefulModelProviders) {
                const codeMappings = modelProvidersToCodeMappings.getValuesOf(modelProvider);
                const astNodes = modelProvidersToCandidateAstNodes.getValuesOf(modelProvider);

                const unusedCodeMappings = new Set(codeMappings);
                const unusedAstNodes = new Set(astNodes);

                // 1. Perfect line number matches
                for (let codeMapping of codeMappings) {
                    loopOverNodes: for (let node of astNodes) {
                        // TODO: use something more robust than the initial line
                        if (node.range.from.initialLine === codeMapping.lineNumber - 1) {
                            if (!unusedAstNodes.has(node)) {
                                continue loopOverNodes;
                            }

                            addModelWith(modelProvider, node, codeMapping, sourceFile);
                            unusedCodeMappings.delete(codeMapping);
                            unusedAstNodes.delete(node);

                            break loopOverNodes;
                        }
                    }
                }

                // 2. Heurtistic for remaining code mappings/AST nodes
                if (unusedCodeMappings.size > 0 && unusedAstNodes.size > 0) {
                    const remainingCodeMappingsSortedByLineNumber = [...unusedCodeMappings]
                        .sort((cm1, cm2) => cm1.lineNumber - cm2.lineNumber);
                    const remainingAstNodesSortedByStartPosition = [...unusedAstNodes]
                        .sort((node1, node2) => SourceFilePosition.compareInAscendingOrder(node1.range.from, node2.range.from));
                    const nbApproximateMappingsToMake = Math.min(
                        remainingCodeMappingsSortedByLineNumber.length,
                        remainingAstNodesSortedByStartPosition.length
                    );

                    for (let i = 0; i < nbApproximateMappingsToMake; i++) {
                        const codeMapping = remainingCodeMappingsSortedByLineNumber[i];
                        const node = remainingAstNodesSortedByStartPosition[i];

                        addModelWith(modelProvider, node, codeMapping, sourceFile);
                        unusedCodeMappings.delete(codeMapping);
                        unusedAstNodes.delete(node);
                    }

                    if (unusedCodeMappings.size > 0) {
                        console.warn("Some visualisations may be missing: there was no more AST node to approximately pair the following code mappings with:", unusedCodeMappings);
                    }

                    if (unusedAstNodes.size > 0) {
                        console.warn("Some visualisations may be missing: there was no more code mappings to approximately pair the following AST nodes with:", unusedAstNodes);
                    }
                }
            }
        }

        return extractedModels;
    }
}