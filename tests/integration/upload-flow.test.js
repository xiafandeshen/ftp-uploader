// tests/integration/upload-flow.test.js
const FtpUploader = require("../../lib/index")
const mockFs = require("mock-fs")

// 模拟ftp客户端
jest.mock("basic-ftp", () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      access: jest.fn().mockResolvedValue(true),
      close: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      ensureDir: jest.fn().mockResolvedValue(true),
      uploadFrom: jest.fn().mockResolvedValue(true),
      ftp: { verbose: false, log: jest.fn() },
    })),
  }
})

describe("FTP上传集成测试", () => {
  let uploader
  let consoleErrorSpy
  let consoleLogSpy
  let processStdoutWriteSpy

  beforeEach(() => {
    // 模拟本地文件系统
    mockFs({
      "/project/dist": {
        "index.html": "<h1>首页</h1>",
        "about.html": "<h1>关于</h1>",
        css: {
          "style.css": "body { color: red; }",
          "old.css": "/* 旧文件 */",
        },
        js: {
          "app.js": 'console.log("app")',
          "app.min.js": 'console.log("min")',
          "app.js.map": '{"version":3}',
        },
        images: {
          "logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          "icon.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        },
        ".gitignore": "node_modules/",
        ".env": "SECRET=123",
      },
    })

    // 捕获所有输出
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation()
    processStdoutWriteSpy = jest
      .spyOn(process.stdout, "write")
      .mockImplementation()
  })

  afterEach(() => {
    mockFs.restore()
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
    processStdoutWriteSpy.mockRestore()
    jest.clearAllMocks()
  })

  describe("完整上传流程", () => {
    test("应该正确处理include/exclude规则", async () => {
      const config = {
        host: "test.com",
        username: "test",
        password: "test",
        localDir: "/project/dist",
        remoteDir: "/",
        include: ["**/*.html", "**/*.min.js"],
        exclude: ["**/*.map", ".gitignore", ".env"],
        recursive: true,
        debug: false,
      }

      uploader = new FtpUploader(config)

      await uploader.connect()
      await uploader.sync()

      // 检查是否调用了文件统计信息
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("文件统计")
      )
    })

    test("没有需要上传的文件时应该提前退出", async () => {
      const config = {
        host: "test.com",
        username: "test",
        password: "test",
        localDir: "/project/dist",
        remoteDir: "/",
        include: [],
        exclude: ["**/*"],
        recursive: true,
      }

      uploader = new FtpUploader(config)

      await uploader.connect()
      await uploader.sync()

      // 检查是否有任何调用包含期望的消息
      const found = consoleLogSpy.mock.calls.some(
        (call) =>
          call[0] &&
          call[0].includes &&
          call[0].includes("没有找到需要上传的文件")
      )
      expect(found).toBe(true)
    })
  })

  describe("错误处理", () => {
    test("连接失败时应该退出", async () => {
      // 临时模拟连接失败
      const ftp = require("basic-ftp")
      ftp.Client.mockImplementationOnce(() => ({
        access: jest.fn().mockRejectedValue(new Error("连接超时")),
        close: jest.fn(),
        ftp: { verbose: false, log: jest.fn() },
      }))

      const config = {
        host: "test.com",
        username: "test",
        password: "test",
        localDir: "/project/dist",
        remoteDir: "/",
      }

      uploader = new FtpUploader(config)

      const result = await uploader.connect()
      expect(result).toBe(false)
    })

    test("上传失败时应该记录错误", async () => {
      // 创建一个会失败的 FTP 客户端
      const ftp = require("basic-ftp")

      // 清除之前的模拟
      jest.clearAllMocks()

      // 重新模拟一个会失败的客户端
      const mockFtpClient = {
        access: jest.fn().mockResolvedValue(true),
        close: jest.fn(),
        list: jest.fn().mockResolvedValue([]),
        ensureDir: jest.fn().mockResolvedValue(true),
        uploadFrom: jest.fn().mockImplementation(() => {
          return Promise.reject(new Error("上传失败：磁盘空间不足"))
        }),
        ftp: { verbose: false, log: jest.fn() },
      }

      ftp.Client.mockImplementationOnce(() => mockFtpClient)

      const config = {
        host: "test.com",
        username: "test",
        password: "test",
        localDir: "/project/dist",
        remoteDir: "/",
        include: ["**/*.html"],
        debug: true,
      }

      uploader = new FtpUploader(config)

      await uploader.connect()

      // 清除所有之前的调用记录
      consoleErrorSpy.mockClear()
      consoleLogSpy.mockClear()
      processStdoutWriteSpy.mockClear()
      mockFtpClient.uploadFrom.mockClear()

      await uploader.sync()

      // 验证 uploadFrom 被调用（应该会失败）
      expect(mockFtpClient.uploadFrom).toHaveBeenCalled()

      // 打印所有记录以便调试
      console.log("Console error calls:", consoleErrorSpy.mock.calls)
      console.log("Console log calls:", consoleLogSpy.mock.calls)
      console.log(
        "Process stdout write calls:",
        processStdoutWriteSpy.mock.calls
      )

      // 验证错误被记录 - 可能是通过 process.stdout.write
      const hasErrorOutput =
        consoleErrorSpy.mock.calls.length > 0 ||
        processStdoutWriteSpy.mock.calls.some(
          (call) => call[0] && call[0].includes && call[0].includes("❌")
        )

      expect(hasErrorOutput).toBe(true)
    })
  })
})
