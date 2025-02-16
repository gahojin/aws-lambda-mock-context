import context, { resetGlobalOptions, setGlobalOptions } from '.'

type InvokeAsyncOptions = {
  ms?: number
  timeout?: number
  handleTimeout?: boolean
}

type Method = 'succeed' | 'fail' | 'done'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const invokeAsync = (method: Method, result: string | Error | [Error | undefined, unknown], options?: InvokeAsyncOptions) => {
  const opts = {
    ms: 500,
    timeout: 3,
    ...options,
  }

  const ctx = context({
    timeout: opts.timeout,
    handleTimeout: opts.handleTimeout,
  })

  setTimeout(() => {
    if (Array.isArray(result)) {
      ctx[method](...result)
      return
    }

    ctx[method](result)
  }, opts.ms)

  return ctx.Promise
}

describe('mockContext', () => {
  beforeEach(() => {
    resetGlobalOptions()
  })

  test('succeed', async () => {
    await expect(invokeAsync('succeed', 'baz')).resolves.toEqual('baz')
    await expect(invokeAsync('done', [undefined, 'baz'])).resolves.toEqual('baz')
  })

  test('fail', async () => {
    await expect(invokeAsync('fail', 'promise fail')).rejects.toThrow('promise fail')
    await expect(invokeAsync('fail', new Error('promise fail'))).rejects.toThrow('promise fail')
    await expect(invokeAsync('done', new Error('promise fail'))).rejects.toThrow('promise fail')
  })

  test('result', () => {
    const ctx = context()

    expect(ctx.functionName).toEqual('aws-lambda-mock-context')
    expect(ctx.functionVersion).toEqual('$LATEST')
    expect(ctx.memoryLimitInMB).toEqual('128')
    expect(ctx.logGroupName).toEqual('/aws/lambda/aws-lambda-mock-context')
    expect(ctx.invokedFunctionArn).toEqual('arn:aws:lambda:us-west-1:123456789012:function:aws-lambda-mock-context:$LATEST')

    ctx.succeed('result')
  })

  test('options', () => {
    const ctx = context({
      region: 'eu-west-1',
      account: '210987654321',
      functionName: 'test',
      functionVersion: '1',
      memoryLimitInMB: '512',
      alias: 'production',
    })

    expect(ctx.functionName).toEqual('test')
    expect(ctx.functionVersion).toEqual('1')
    expect(ctx.memoryLimitInMB).toEqual('512')
    expect(ctx.logGroupName).toEqual('/aws/lambda/test')
    expect(ctx.invokedFunctionArn).toEqual('arn:aws:lambda:eu-west-1:210987654321:function:test:production')

    ctx.succeed('result')
  })

  test('remaining time', async () => {
    const ctx = context()

    await delay(1000)

    const ms = ctx.getRemainingTimeInMillis()

    expect(ctx.getRemainingTimeInMillis()).toBeWithin(1950, 2050)

    await delay(10)

    expect(ctx.getRemainingTimeInMillis() < ms).toBeTrue()

    ctx.succeed(undefined)

    const msAfterSuccess = ctx.getRemainingTimeInMillis()

    await delay(100)

    expect(ctx.getRemainingTimeInMillis()).toEqual(msAfterSuccess)
  })

  test('set function timeout', async () => {
    const ctx = context({
      timeout: 10,
    })

    await delay(1000)

    expect(ctx.getRemainingTimeInMillis()).toBeWithin(8950, 9050)

    ctx.succeed('result')
  })

  test('timeout throws error', async () => {
    await expect(invokeAsync('succeed', 'foo', { ms: 2000, timeout: 1, handleTimeout: true })).rejects.toThrow('Task timed out after 1.00 seconds')
  })

  test('extended context', () => {
    const ctx = context(
      {
        region: 'eu-west-1',
        account: '210987654321',
        functionName: 'test',
        functionVersion: '1',
        memoryLimitInMB: '512',
        alias: 'production',
      },
      {
        foo: 'bar',
        a: {
          b: 'c',
        },
      },
    )

    expect(ctx.foo).toEqual('bar')
    expect(ctx.a).toEqual({ b: 'c' })
  })

  test('global options', async () => {
    setGlobalOptions({ timeout: 10, handleTimeout: true })
    const ctx = context()

    await delay(1000)

    expect(ctx.getRemainingTimeInMillis()).toBeWithin(8950, 9050)

    await expect(invokeAsync('succeed', 'foo', { ms: 2000, timeout: 1 })).rejects.toThrow('Task timed out after 1.00 seconds')

    // no timeout error
    await expect(invokeAsync('succeed', 'foo', { ms: 2000, timeout: 1, handleTimeout: false })).resolves.toEqual('foo')
  }, 10000)
})
