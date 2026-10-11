import { fakePromise, fakeRejectPromise } from '@whatwg-node/promise-helpers';
export function observableToAsyncIterable(observable) {
    const pullQueue = [];
    const pushQueue = [];
    let listening = true;
    const subscriptionRef = {};
    const emptyQueue = () => {
        if (listening) {
            listening = false;
            subscriptionRef.current?.unsubscribe();
            for (const resolve of pullQueue) {
                resolve({ value: undefined, done: true });
            }
            pullQueue.length = 0;
            pushQueue.length = 0;
        }
    };
    const pushValue = (value) => {
        if (pullQueue.length !== 0) {
            // It is safe to use the ! operator here as we check the length.
            pullQueue.shift()({ value, done: false });
        }
        else {
            pushQueue.push({ value, done: false });
        }
    };
    const pushError = (error) => {
        if (pullQueue.length !== 0) {
            // It is safe to use the ! operator here as we check the length.
            pullQueue.shift()({ value: { errors: [error] }, done: false });
        }
        else {
            pushQueue.push({ value: { errors: [error] }, done: false });
        }
    };
    const pushDone = () => {
        if (pullQueue.length !== 0) {
            // It is safe to use the ! operator here as we check the length.
            pullQueue.shift()({ value: undefined, done: true });
            // Release queues/subscription after signaling done to the pending consumer.
            emptyQueue();
        }
        else {
            pushQueue.push({ value: undefined, done: true });
        }
    };
    const pullValue = () => new Promise(resolve => {
        if (pushQueue.length !== 0) {
            const element = pushQueue.shift();
            // either {value: {errors: [...]}} or {value: ...}
            if (element.done) {
                // Release references before delivering the done signal.
                emptyQueue();
            }
            resolve(element);
        }
        else {
            pullQueue.push(resolve);
        }
    });
    subscriptionRef.current = observable.subscribe({
        next(value) {
            return pushValue(value);
        },
        error(err) {
            return pushError(err);
        },
        complete() {
            return pushDone();
        },
    });
    // complete() may run synchronously inside subscribe() before it returns;
    // unsubscribe the returned subscription in that case.
    if (!listening) {
        subscriptionRef.current.unsubscribe();
    }
    return {
        next() {
            // return is a defined method, so it is safe to call it.
            return listening ? pullValue() : this.return();
        },
        return() {
            emptyQueue();
            return fakePromise({ value: undefined, done: true });
        },
        throw(error) {
            emptyQueue();
            return fakeRejectPromise(error);
        },
        [Symbol.asyncIterator]() {
            return this;
        },
    };
}
