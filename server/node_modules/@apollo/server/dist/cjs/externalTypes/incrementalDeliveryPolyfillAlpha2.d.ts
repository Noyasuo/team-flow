import type { FormattedExecutionResult, GraphQLFormattedError } from 'graphql';
interface ObjMap<T> {
    [key: string]: T;
}
export interface GraphQLExperimentalFormattedInitialIncrementalExecutionResultAlpha2<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> extends FormattedExecutionResult<TData, TExtensions> {
    hasNext: boolean;
    incremental?: ReadonlyArray<GraphQLExperimentalFormattedIncrementalResultAlpha2<TData, TExtensions>>;
    extensions?: TExtensions;
}
export interface GraphQLExperimentalFormattedSubsequentIncrementalExecutionResultAlpha2<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> {
    hasNext: boolean;
    incremental?: ReadonlyArray<GraphQLExperimentalFormattedIncrementalResultAlpha2<TData, TExtensions>>;
    extensions?: TExtensions;
}
export type GraphQLExperimentalFormattedIncrementalResultAlpha2<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> = GraphQLExperimentalFormattedIncrementalDeferResultAlpha2<TData, TExtensions> | GraphQLExperimentalFormattedIncrementalStreamResultAlpha2<TData, TExtensions>;
export interface GraphQLExperimentalFormattedIncrementalDeferResultAlpha2<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> extends FormattedExecutionResult<TData, TExtensions> {
    path?: ReadonlyArray<string | number>;
    label?: string;
}
export interface GraphQLExperimentalFormattedIncrementalStreamResultAlpha2<TData = Array<unknown>, TExtensions = ObjMap<unknown>> {
    errors?: ReadonlyArray<GraphQLFormattedError>;
    items?: TData | null;
    path?: ReadonlyArray<string | number>;
    label?: string;
    extensions?: TExtensions;
}
export {};
//# sourceMappingURL=incrementalDeliveryPolyfillAlpha2.d.ts.map