// 全局测试设置
jest.setTimeout(30000)

// 模拟控制台输出，但保留部分用于调试
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}

// 在每个测试后清理mock
afterEach(() => {
  jest.clearAllMocks()
})
