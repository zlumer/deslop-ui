# Architecture Blueprint: Visual Component Refactoring CLI

This document outlines the strict architectural blueprint for a Node.js CLI tool built with TypeScript. The tool automates the refactoring of monolithic React components into a strict Atomic Design folder structure. It leverages an Abstract Syntax Tree (AST) via `ts-morph` for deterministic code manipulation and a third-party AI Agent strictly for semantic decision-making (naming and boundaries).

---

## 1. Environment & Tech Stack
*   **Target Framework:** React (JSX/TSX).
*   **Styling (MVP):** Tailwind CSS.
*   **CLI Stack:** Node.js, TypeScript.
*   **Parser/Mutator:** `ts-morph` (TypeScript Compiler API wrapper).
*   **Visual Regression:** Local dev server, Storybook, headless browser screenshots, and Resemble.js/pixelmatch (fuzzy matching).

---

## 2. Target Component Structure & Import Rules
One monolithic component is exploded into a dedicated folder containing the following sub-directories and files. A barrel file (`index.ts`) is generated at the root of the new folder to export the main component, ensuring external imports across the wider codebase remain unbroken.

### Directories and Hierarchy
1.  **`atoms/`**: 
    *   Pure UI primitives. 
    *   **Rule:** Cannot contain or import other internal components.
    *   **Rule:** Can only import Types, whitelisted external pure component libraries, and whitelisted pure hooks.
    *   **Rule:** Cannot contain layout-specific Tailwind classes (e.g., margins, absolute positioning).
2.  **`molecules/`**: Composed of atoms and/or other molecules.
3.  **`organisms/`**: Complex components composed of molecules and atoms.
4.  **`layouts/`**:
    *   Special case components that strictly define structural UI and `React.ReactNode` slots.
	*   **Rule:** Cannot contain any styling or logic beyond basic flex/grid and slot definitions.
5.  **`templates/`**:
	*   Pure view components that may contain multiple layouts/organisms/molecules/atoms but *no* impure logic or hooks.
    *   **Rule:** Instantiated *only* in the top-level Glue component to avoid deep prop-drilling of JSX nodes.
6.  **`[ComponentName].tsx` (The Glue Component)**: 
    *   The highest-level component left behind after extraction.
    *   Holds all impure business logic, state mutations, and early multiple returns.
    *   Wires data as props into the generated Layouts and Organisms.

### Purity & Whitelisting Restrictions
*   **Impure Logic:** Data fetching, side-effects, and unapproved hooks must remain in the top-level Glue component.
*   **Pure Hooks:** Context readers (e.g., i18n, theme) are allowed inside Atoms/Molecules *only* if they are re-exported from a strict, user-defined directory (e.g., `atomic-pure-hooks/`).
*   **Third-Party Components:** UI libraries (e.g., icons) must be explicitly whitelisted by the user in a configuration file before they can be imported inside Atoms.

---

## 3. The Extraction Pipeline

To ensure zero code loss and syntax integrity, the process uses parallel generation and a strict separation of concerns between AST parsing and AI semantic tagging.

### Phase 1: Pre-processing & AST Preparation
1.  **Parse:** The CLI reads the target `monolith.tsx` file and converts it to an AST using `ts-morph`.
2.  **Filter Leaves:** The AST ignores all "leaf nodes" (nodes without children, such as `<Spinner />` or `<input />`). These are already at the correct level of abstraction and remain attached to their parent node during extraction.
3.  **Inject IDs:** The AST injects a unique `data-ast-id` attribute into all viable, non-leaf JSX elements.
4.  **Isolate:** Impure logic is stripped from the payload (kept in memory by the AST).

### Phase 2: The AI ↔ AST Handshake
1.  **Send Payload:** The CLI sends the clean, native-looking JSX string (now containing `data-ast-id` markers) to the AI Agent.
2.  **AI Tagging:** The AI evaluates the JSX and returns a strict JSON array mapping IDs to destinations:
    ```json
    [
      { "id": "n2", "name": "OpenButton", "folder": "atoms" },
      { "id": "n1", "name": "ModalContainer", "folder": "organisms" }
    ]
    ```
3.  **Fallback Naming:** If the AI fails to provide names for generated props or components, the AST executes the extraction with temporary names and triggers a second AI pass specifically for renaming via `ts-morph`'s `.rename()` function.

### Phase 3: Parallel Generation
To prevent corrupting the user's codebase in case of a failure, the CLI generates the refactored component in isolation.
1.  The CLI creates a hidden `.tmp-refactor/` directory.
2.  The AST isolates the tagged nodes and generates the interfaces and code for Atoms, Molecules, Organisms, and Layouts.
3.  The AST generates the top-level Glue component, importing the newly created fragments.

### Phase 4: Deduplication Phase
To prevent the creation of identical shared primitives (e.g., extracting the same button twice), the CLI applies three layers of deduplication before writing the final files:
1.  **Structural Hashing:** The AST normalizes the component tree (stripping variable names, text content, and dynamic props), leaving only node types and static attributes. This structure is hashed. Identical hashes are merged into a single component.
2.  **AST Similarity:** A third-party AST comparison tool verifies logical equivalence.
3.  **String Similarity:** A third-party string comparison tool serves as a final fallback.

### Phase 5: Visual Regression Verification
Because the monolith depends on global/impure hooks, direct rendering may fail in a test environment. The visual verification must operate on pure view outputs.
1.  **Baseline Extraction:** The AST extracts the DOM tree from the original monolithic component into a massive, prop-drilled "mega-component" (a pure view component stripped of state/impure hooks).
2.  **Baseline Snapshot:** The CLI generates a Storybook story for this baseline view, spins up a local dev server, and uses a headless browser to take a screenshot.
3.  **Refactor Snapshot:** The CLI repeats this process for the newly generated `.tmp-refactor/` Glue component's view layer.
4.  **Fuzzy Diff:** Resemble.js or pixelmatch compares the snapshots using fuzzy matching (allowing for minor unnoticeable layout shifts while flagging structural breaks).
5.  **Output:** An HTML report with side-by-side visual diffs is generated for human review. *Note: The CLI does not attempt to auto-fix visual bugs; it merely reports them.*

### Phase 6: Commit to File System
1.  If the generation succeeds and the user/visual diff approves, the CLI deletes the original `monolith.tsx`.
2.  The `.tmp-refactor/` directory is moved to the final component path.
3.  An `index.ts` barrel file is created to re-export the Glue component.

---

## 4. Technical Constraints & Edge Cases

The following approaches have been explicitly approved to handle React and AST specific edge cases.

### State and Event Handlers (MVP Scope)
*   **Lifting State Up:** Pushing `useState` down into newly created child components is explicitly *out of scope* for the MVP.
*   **Arrow Functions:** `useState` declarations remain in the top-level Glue component. The AST provides state updates to child components via inline arrow functions (e.g., `<Atom onClick={() => setIsOpen(true)} />`) rather than passing raw setters like `setIsOpen`.
*   **Prop Drilling Acceptance:** Heavy prop drilling is explicitly accepted for the MVP. If a complex component requires hundreds of props flowing through it to reach Atoms, the CLI will strictly drill them down.

### Layout Class Enforcement (Tailwind)
*   Atoms cannot contain layout-specific classes (e.g., `m-*`, `absolute`).
*   **Static Strings:** The AST will use string parsing/regex against string literals to identify and strip/flag these classes.
*   **Dynamic Strings:** If an Atom uses dynamic class strings (template literals or `clsx` arguments evaluating variables), the AST will blindly flag the entire node for human review, as it cannot statically verify the absence of layout properties.
*   **Contextual Classes:** The AI Agent is granted autonomy to decide how to handle contextual Tailwind classes (e.g., `group-hover`). The AI can choose to combine the `div` and `p` into one atom, hoist the classnames as props from the parent, or (as a last resort) keep the classnames between different atoms.

### Refs (`forwardRef` alternative)
*   Implementing complete AST generic tracing to generate `forwardRef` wrappers is highly complex.
*   **The `innerRef` Hack:** If a component contains a `ref`, the AST will map it to a standard prop named `innerRef`. React treats this as a standard prop (e.g., `const Atom = ({ innerRef }) => <input ref={innerRef} />`). The parent simply passes `innerRef={myRef}`.

### TypeScript Generics
*   If a monolithic component uses generics (e.g., `<T>`), the AST will query the `ts-morph` TypeChecker to identify if extracted variables rely on those type parameters.
*   The AST will extract the generic definition string and hoist it into the new child component and its Prop interface.

### Multiple Returns / Early Exits
*   If a monolith contains multiple early returns (e.g., `if (loading) return <Spinner />;`), these logic blocks are strictly classified as part of the Glue component.
*   The AST will leave them untouched at the top level of the resulting file, only refactoring the main JSX tree returned at the end of the function.