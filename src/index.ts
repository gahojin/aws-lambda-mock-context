import type { ClientContext, CognitoIdentity, Context } from 'aws-lambda'
import { v1 as uuidv1, v4 as uuidv4 } from 'uuid'

type Options = {
  region?: string
  account?: string
  alias?: string
  functionName?: string
  functionVersion?: string
  memoryLimitInMB?: string
  identity?: CognitoIdentity
  clientContext?: ClientContext
  timeout?: number
}

interface MockContext extends Context {
  Promise: Promise<any>
}

type Deferred = {
  promise: Promise<unknown>
  resolve: (value: unknown) => void
  reject: (reason?: any) => void
}
const defer = (): Deferred => {
  const deferred: Partial<Deferred> = {}
  const promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
  })
  return {
    promise,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    resolve: deferred.resolve!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    reject: deferred.reject!,
  }
}

const lambdaTimeout = (context: MockContext, timeout: number): NodeJS.Timeout => {
  return setTimeout(() => {
    if (Math.round(context.getRemainingTimeInMillis() / 1000) === 0) {
      context.fail(new Error(`Task timed out after ${timeout}.00 seconds`))
    }
  }, timeout * 1000)
}

export default <E = Record<string, any>>(options?: Options, overrides?: E): MockContext & E => {
  const id = uuidv1()
  const stream = uuidv4().replace(/-/g, '')

  const opts = {
    region: 'us-west-1',
    account: '123456789012',
    functionName: 'aws-lambda-mock-context',
    functionVersion: '$LATEST',
    memoryLimitInMB: '128',
    timeout: 3,
    ...options,
  }

  const deferred = defer()

  const d = new Date()
  const logDate = [d.getFullYear(), `0${d.getMonth() + 1}`.slice(-2), `0${d.getDate()}`.slice(-2)].join('/')
  const start = d.getTime()
  let end: number | null = null
  let timeout: NodeJS.Timeout | null = null

  // https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/nodejs-context.html
  const context: MockContext = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: opts.functionName,
    functionVersion: opts.functionVersion,
    invokedFunctionArn: `arn:aws:lambda:${opts.region}:${opts.account}:function:${opts.functionName}:${opts.alias || opts.functionVersion}`,
    memoryLimitInMB: opts.memoryLimitInMB,
    awsRequestId: id,
    logGroupName: `/aws/lambda/${opts.functionName}`,
    logStreamName: `${logDate}/[${opts.functionVersion}]/${stream}`,
    identity: opts.identity,
    clientContext: opts.clientContext,
    getRemainingTimeInMillis: () => {
      const endTime = end || Date.now()
      const remainingTime = opts.timeout * 1000 - (endTime - start)

      return Math.max(0, remainingTime)
    },
    succeed: (messageOrObject) => {
      end = Date.now()

      deferred.resolve(messageOrObject)
    },
    fail: (error) => {
      end = Date.now()

      deferred.reject(typeof error === 'string' ? new Error(error) : error)
    },
    done: (error, result) => {
      if (timeout) {
        clearTimeout(timeout)
      }

      if (error) {
        context.fail(error)
        return
      }

      context.succeed(result)
    },
    Promise: deferred.promise,
  }

  // Lambda Timeout
  if (opts.timeout > 0) {
    timeout = lambdaTimeout(context, opts.timeout)
  }

  return Object.assign(context, overrides)
}
