/**
 * Minimal ambient typings for `graphology-types`.
 *
 * `graphology` (and sigma / @react-sigma) declare their types against the
 * `graphology-types` peer package, which is not installed in this workspace.
 * Without it, `DirectedGraph` collapses to an empty class and every method
 * access fails to type-check. This shim declares the subset of the real
 * package's surface that the notes feature uses (graph construction,
 * traversal, attribute access) plus the aliases the vendored declaration
 * files import (`Attributes`, `GraphOptions`, `EdgeMapper`).
 */
declare module 'graphology-types' {
  export type Attributes = Record<string, any>;

  export interface GraphOptions {
    allowSelfLoops?: boolean;
    multi?: boolean;
    type?: 'mixed' | 'directed' | 'undirected';
  }

  export type EdgeMapper<
    T,
    NodeAttributes extends Attributes = Attributes,
    EdgeAttributes extends Attributes = Attributes,
  > = (
    edge: string,
    attributes: EdgeAttributes,
    source: string,
    target: string,
    sourceAttributes: NodeAttributes,
    targetAttributes: NodeAttributes,
    undirected: boolean,
  ) => T;

  export type NodeIterationCallback<NodeAttributes extends Attributes = Attributes> = (
    node: string,
    attributes: NodeAttributes,
  ) => void;

  export type EdgeIterationCallback<
    NodeAttributes extends Attributes = Attributes,
    EdgeAttributes extends Attributes = Attributes,
  > = (
    edge: string,
    attributes: EdgeAttributes,
    source: string,
    target: string,
    sourceAttributes: NodeAttributes,
    targetAttributes: NodeAttributes,
    undirected: boolean,
  ) => void;

  export abstract class AbstractGraph<
    NodeAttributes extends Attributes = Attributes,
    EdgeAttributes extends Attributes = Attributes,
    GraphAttributes extends Attributes = Attributes,
  > {
    constructor(options?: GraphOptions);

    readonly order: number;
    readonly size: number;
    readonly type: 'mixed' | 'directed' | 'undirected';

    addNode(node: unknown, attributes?: NodeAttributes): string;
    hasNode(node: unknown): boolean;
    addEdge(source: unknown, target: unknown, attributes?: EdgeAttributes): string;
    addDirectedEdge(source: unknown, target: unknown, attributes?: EdgeAttributes): string;
    hasEdge(source: unknown, target?: unknown): boolean;
    degree(node: unknown): number;

    getNodeAttribute<Name extends keyof NodeAttributes>(
      node: unknown,
      name: Name,
    ): NodeAttributes[Name];
    getNodeAttributes(node: unknown): NodeAttributes;
    setNodeAttribute<Name extends keyof NodeAttributes>(
      node: unknown,
      name: Name,
      value: NodeAttributes[Name],
    ): this;
    getEdgeAttribute<Name extends keyof EdgeAttributes>(
      edge: unknown,
      name: Name,
    ): EdgeAttributes[Name];
    setEdgeAttribute<Name extends keyof EdgeAttributes>(
      edge: unknown,
      name: Name,
      value: EdgeAttributes[Name],
    ): this;
    getAttribute<Name extends keyof GraphAttributes>(name: Name): GraphAttributes[Name];

    forEachNode(callback: NodeIterationCallback<NodeAttributes>): void;
    forEachEdge(callback: EdgeIterationCallback<NodeAttributes, EdgeAttributes>): void;
    nodes(): string[];
    edges(): string[];
    clear(): void;
  }

  export default AbstractGraph;
}
