import type { FormattedExecutionResult, GraphQLFormattedError } from 'graphql';
interface ObjMap<T> {
    [key: string]: T;
}
export interface GraphQLExperimentalFormattedInitialIncrementalExecutionResultAlpha9<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> extends FormattedExecutionResult<TData, TExtensions> {
    data: TData;
    pending: ReadonlyArray<GraphQLExperimentalPendingResultAlpha9>;
    hasNext: boolean;
    extensions?: TExtensions;
}
export interface GraphQLExperimentalFormattedSubsequentIncrementalExecutionResultAlpha9<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> {
    hasNext: boolean;
    pending?: ReadonlyArray<GraphQLExperimentalPendingResultAlpha9>;
    incremental?: ReadonlyArray<GraphQLExperimentalFormattedIncrementalResultAlpha9<TData, TExtensions>>;
    completed?: ReadonlyArray<GraphQLExperimentalFormattedCompletedResultAlpha9>;
    extensions?: TExtensions;
}
export type GraphQLExperimentalFormattedIncrementalResultAlpha9<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> = GraphQLExperimentalFormattedIncrementalDeferResultAlpha9<TData, TExtensions> | GraphQLExperimentalFormattedIncrementalStreamResultAlpha9<TData, TExtensions>;
export interface GraphQLExperimentalFormattedIncrementalDeferResultAlpha9<TData = ObjMap<unknown>, TExtensions = ObjMap<unknown>> {
    errors?: ReadonlyArray<GraphQLFormattedError>;
    data: TData;
    id: string;
    subPath?: ReadonlyArray<string | number>;
    extensions?: TExtensions;
}
export interface GraphQLExperimentalFormattedIncrementalStreamResultAlpha9<TData = Array<unknown>, TExtensions = ObjMap<unknown>> {
    errors?: ReadonlyArray<GraphQLFormattedError>;
    items: TData;
    id: string;
    subPath?: ReadonlyArray<string | number>;
    extensions?: TExtensions;
}
export interface GraphQLExperimentalPendingResultAlpha9 {
    id: string;
    path: ReadonlyArray<string | number>;
    label?: string;
}
export interface GraphQLExperimentalFormattedCompletedResultAlpha9 {
    id: string;
    errors?: ReadonlyArray<GraphQLFormattedError>;
}
export {};
//# sourceMappingURL=incrementalDeliveryPolyfillAlpha9.d.ts.map