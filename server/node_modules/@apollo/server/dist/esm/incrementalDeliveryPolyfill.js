import { execute, } from 'graphql';
import { BadRequestError } from './internalErrorClasses.js';
import { MEDIA_TYPES } from './ApolloServer.js';
let graphqlExperimentalExecuteIncrementally = undefined;
async function tryToLoadGraphQL17() {
    if (graphqlExperimentalExecuteIncrementally !== undefined) {
        return;
    }
    const graphql = await import('graphql');
    if (graphql.version === '17.0.0-alpha.9' &&
        'experimentalExecuteIncrementally' in graphql) {
        graphqlExperimentalExecuteIncrementally = graphql
            .experimentalExecuteIncrementally;
    }
    else {
        graphqlExperimentalExecuteIncrementally = null;
    }
}
export async function executeIncrementally({ useLegacyIncremental, legacyExperimentalExecuteIncrementally, ...args }) {
    await tryToLoadGraphQL17();
    if (useLegacyIncremental) {
        if (legacyExperimentalExecuteIncrementally) {
            return legacyExperimentalExecuteIncrementally(args);
        }
        if (graphqlExperimentalExecuteIncrementally) {
            throw new BadRequestError('Apollo Server received an operation that uses incremental delivery ' +
                '(@defer or @stream) with the legacy incremental format, but the server ' +
                'does not support the legacy incremental delivery format. Add the HTTP ' +
                `header: 'Accept: ${MEDIA_TYPES.MULTIPART_MIXED_EXPERIMENTAL_ALPHA_9}' ` +
                'to use the current incremental delivery format', { extensions: { http: { status: 406 } } });
        }
    }
    if (graphqlExperimentalExecuteIncrementally) {
        return graphqlExperimentalExecuteIncrementally(args);
    }
    return execute(args);
}
//# sourceMappingURL=incrementalDeliveryPolyfill.js.map