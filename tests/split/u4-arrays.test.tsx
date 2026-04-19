import { describe, expect } from 'vitest';
import * as ts from 'typescript';
import { performRefactoring } from '../../src/extract/performRefactoring';
import { detectPropsList } from '../../src/extract/detectPropsList';
import { detectComponents } from '../../src/extract/detectComponents';
import { RefactorDecisions } from '../../src/extract/types';
import { sft } from './utils';

const INPUT_CODE = `type Product = { id: string; name: string; price: number };
/* Target: Extract <li> into \`ProductListItem\` */
export const ProductList = ({ products }: { products: Product[] }) => {
return (
<ul>
{products.map((product) => (
<li key={product.id} className="list-item">
<strong>{product.name}</strong>- \${product.price.toFixed(2)}
</li>
))}
</ul>
);
};`;

const OUTPUT_CODE = `type Product = { id: string; name: string; price: number };
interface ProductListItemProps {
product: Product;
}
const ProductListItem = ({ product }: ProductListItemProps) => (
<li className="list-item">
<strong>{product.name}</strong>- \${product.price.toFixed(2)}
</li>
);
/* Target: Extract <li> into \`ProductListItem\` */
export const ProductList = ({ products }: { products: Product[] }) => {
return (
<ul>
{products.map((product) => (
<ProductListItem key={product.id} product={product} />
))}
</ul>
);
};`;

describe('[4-arrays]', () =>
{
	sft('should extract <li> into ProductListItem', INPUT_CODE, OUTPUT_CODE, ({
		inputCode,
		sourceFile,
		typeChecker,
	}) =>
	{
		// Find the text offsets for: <li ...>...</li>
		const liStart = inputCode.lastIndexOf('<li');
		const liEnd = inputCode.indexOf('</li>') + '</li>'.length;
		const selection = { start: liStart, end: liEnd };

		// -------------------------------------------------------------------
		// STEP 1: Detect Components
		// -------------------------------------------------------------------
		const candidates = detectComponents(sourceFile, selection);
		
		// Assertions for Step 1
		expect(candidates.length).toBeGreaterThanOrEqual(1);
		const liCandidate = candidates.find(c => c.description.includes('<li'))!;
		expect(liCandidate).toBeDefined();
		expect(liCandidate.node.kind).toBe(ts.SyntaxKind.JsxElement);
		expect(liCandidate.description).toContain('<li');

		// -------------------------------------------------------------------
		// STEP 2: Detect Props and Context
		// -------------------------------------------------------------------
		const decisionsRequest = detectPropsList(
			sourceFile,
			typeChecker,
			liCandidate
		);

		// Assertions for Step 2
		// Since the <li> uses the external variable `product` from the map callback, props should be detected
		expect(decisionsRequest.props).toHaveLength(1);
		expect(decisionsRequest.props.map(p => p.name)).toEqual(expect.arrayContaining(['product']));
		expect(decisionsRequest.hasChildren).toBe(true);

		// -------------------------------------------------------------------
		// STEP 3: Perform Refactor
		// -------------------------------------------------------------------
		const decisions = {
			componentName: 'ProductListItem',
			hardcodeChildren: true,
			selectedProps: ['product'] // Pass detected props
		} satisfies RefactorDecisions;

		const result = performRefactoring(
			sourceFile,
			decisionsRequest,
			decisions
		);

		// Assertions for Step 3
		expect(result.newComponentAst.kind).toBe(ts.SyntaxKind.VariableStatement); // const ProductListItem = ...
		expect(result.replacementAst.kind).toBe(ts.SyntaxKind.JsxSelfClosingElement); // <ProductListItem />

		return result;
	});
});
