"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeIncrementally = executeIncrementally;
const graphql_1 = require("graphql");
const internalErrorClasses_js_1 = require("./internalErrorClasses.js");
const ApolloServer_js_1 = require("./ApolloServer.js");
let graphqlExperimentalExecuteIncrementally = undefined;
async function tryToLoadGraphQL17() {
    if (graphqlExperimentalExecuteIncrementally !== undefined) {
        return;
    }
    const graphql = await Promise.resolve().then(() => __importStar(require('graphql')));
    if (graphql.version === '17.0.0-alpha.9' &&
        'experimentalExecuteIncrementally' in graphql) {
        graphqlExperimentalExecuteIncrementally = graphql
            .experimentalExecuteIncrementally;
    }
    else {
        graphqlExperimentalExecuteIncrementally = null;
    }
}
async function executeIncrementally({ useLegacyIncremental, legacyExperimentalExecuteIncrementally, ...args }) {
    await tryToLoadGraphQL17();
    if (useLegacyIncremental) {
        if (legacyExperimentalExecuteIncrementally) {
            return legacyExperimentalExecuteIncrementally(args);
        }
        if (graphqlExperimentalExecuteIncrementally) {
            throw new internalErrorClasses_js_1.BadRequestError('Apollo Server received an operation that uses incremental delivery ' +
                '(@defer or @stream) with the legacy incremental format, but the server ' +
                'does not support the legacy incremental delivery format. Add the HTTP ' +
                `header: 'Accept: ${ApolloServer_js_1.MEDIA_TYPES.MULTIPART_MIXED_EXPERIMENTAL_ALPHA_9}' ` +
                'to use the current incremental delivery format', { extensions: { http: { status: 406 } } });
        }
    }
    if (graphqlExperimentalExecuteIncrementally) {
        return graphqlExperimentalExecuteIncrementally(args);
    }
    return (0, graphql_1.execute)(args);
}
//# sourceMappingURL=incrementalDeliveryPolyfill.js.map