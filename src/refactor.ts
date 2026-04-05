// ============================================================================
// 1. CLI Refactor Engine Signatures
// ============================================================================

export interface AiExtractionMap {
  extractions: Array<{
    nodeId: string;
    name: string;
    folder: 'atoms' | 'molecules' | 'organisms' | 'layouts';
    isLayoutSlot?: boolean;
  }>;
}

export interface RefactorCliOptions {
  /** Path to the pure hooks directory. Defaults to '@/atomic-pure-hooks' */
  pureHooksWhitelistDir?: string;
  /** If provided, bypasses the actual LLM call and uses this deterministic map (crucial for unit tests) */
  mockAiResponse?: AiExtractionMap;
  /** If true, runs the AST transformations in memory without touching the real disk */
  inMemoryOnly?: boolean;
}

export interface FileSystemWrapper {
  /** Checks if a file or directory exists at the given path */
  exists: (path: string) => boolean;
  /** Reads the content of a file as a UTF-8 string */
  read: (filePath: string) => string;
  /** Returns an array of file/folder names directly inside the given directory */
  listDir: (dirPath: string) => string[];
  //** Returns an array of full file paths matching a glob pattern (e.g., 'src/**/*.tsx') */
  glob: (pattern: string) => string[];
}

export interface RefactorResult {
  /** True if the AST compilation and AI tagging succeeded */
  success: boolean;
  /** A wrapper around the generated files (real disk or virtual memory) */
  fs: FileSystemWrapper;
  /** Any non-fatal issues encountered (e.g., "Dynamic Tailwind class detected at UserCard.tsx:45") */
  warnings: string[];
  /** Path to the hidden temporary refactor directory (e.g., './src/components/.tmp-UserCard') */
  tmpRefactorDir: string;
}

/**
 * Executes the full AST parse -> AI Tagging -> AST Code Generation pipeline.
 * 
 * @param targetPath The relative path to the monolithic component (e.g., 'src/components/UserCard.tsx')
 * @param options Configuration for the CLI run, including AI mocking for tests.
 * @returns A promise resolving to the RefactorResult containing the FileSystem wrapper.
 */
export const runCliRefactor = async (
  targetPath: string,
  options?: RefactorCliOptions
): Promise<RefactorResult> => {
  return {
    success: false,
    fs: {
      exists: () => false,
      read: () => '',
      listDir: () => [],
      glob: () => []
    },
    warnings: [],
    tmpRefactorDir: ''
  };
};
