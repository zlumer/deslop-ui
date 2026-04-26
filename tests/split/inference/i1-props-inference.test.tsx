import * as ts from 'typescript';
import { detectPropsList } from '../../../src/extract/detectPropsList';
import { ExtractionCandidate } from '../../../src/extract/types';

function setupTest(code: string) {
    const fileName = 'test.tsx';
    const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.Latest,
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        strict: false // To ensure types default to 'any' if not explicitly typed
    };

    const host = ts.createCompilerHost(compilerOptions);
    const originalGetSourceFile = host.getSourceFile;
    host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => {
        if (name === fileName) {
            return ts.createSourceFile(name, code, languageVersion, true, ts.ScriptKind.TSX);
        }
        return originalGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
    };

    const program = ts.createProgram([fileName], compilerOptions, host);
    const sourceFile = program.getSourceFile(fileName)!;
    const typeChecker = program.getTypeChecker();

    // Find the first JSX element to use as our extraction candidate
    let targetNode: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment | undefined;
    ts.forEachChild(sourceFile, function visit(node) {
        if (!targetNode && (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))) {
            targetNode = node as any;
        }
        ts.forEachChild(node, visit);
    });

    const candidate: ExtractionCandidate = {
        node: targetNode!,
        description: 'test',
        tag: 'test',
        start: { index: 0, line: 0, character: 0 },
        end: { index: 0, line: 0, character: 0 },
        complexity: {}
    };

    const request = detectPropsList(sourceFile, typeChecker, candidate);
    const printer = ts.createPrinter();

    const getPropType = (name: string) => {
        const prop = request.props.find(p => p.name === name);
        if (!prop || !prop.typeNode) return 'any';
        return printer.printNode(ts.EmitHint.Unspecified, prop.typeNode, sourceFile);
    };

    return { getPropType };
}

describe('Prop Type Inference from Usage', () => {
    it('1. infers React.ReactNode when used as-is in DOM', () => {
        const { getPropType } = setupTest(`
            import React from 'react';
            function App() {
                let myNode: any;
                return <div>{myNode}</div>;
            }
        `);
        expect(getPropType('myNode')).toBe('React.ReactNode');
    });

    it('2. infers string | number | boolean when used in string interpolation', () => {
        const { getPropType } = setupTest(`
            function App() {
                let myPrimitive: any;
                return <div className={\`btn \${myPrimitive}\`}>Test</div>;
            }
        `);
        expect(getPropType('myPrimitive')).toBe('string | number | boolean');
    });

    it('3. infers any[] when iterated over', () => {
        const { getPropType } = setupTest(`
            function App() {
                let myList: any;
                return <div>{myList.map((item: any) => <span key={item.id}>{item.name}</span>)}</div>;
            }
        `);
        expect(getPropType('myList')).toBe('any[]');
    });

    it('4. infers object shape when properties are accessed', () => {
        const { getPropType } = setupTest(`
            function App() {
                let myObj: any;
                return <div>{myObj.firstName} {myObj.age}</div>;
            }
        `);
        // Normalize whitespace for the assertion
        const typeStr = getPropType('myObj').replace(/\s+/g, ' ');
        expect(typeStr).toContain('{ firstName: any; age: any; }');
    });

    it('5. infers from function signatures when passed as arguments', () => {
        const { getPropType } = setupTest(`
            function processData(data: string, count: number) {}
            
            function App() {
                let myArg1: any;
                let myArg2: any;
                return <button onClick={() => processData(myArg1, myArg2)}>Click</button>;
            }
        `);
        expect(getPropType('myArg1')).toBe('string');
        expect(getPropType('myArg2')).toBe('number');
    });
});
